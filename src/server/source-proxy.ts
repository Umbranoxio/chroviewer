import { lookup } from 'node:dns/promises';
import { BlockList, isIP } from 'node:net';

import { Result, TaggedError } from 'better-result';

const maxSourceBytes = 256 * 1024 * 1024;
const maxRedirects = 5;
const redirectStatuses = new Set([301, 302, 303, 307, 308]);
const blockedIpv4Addresses = new BlockList();
const blockedIpv6Addresses = new BlockList();

for (const [network, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.88.99.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
] as const) {
  blockedIpv4Addresses.addSubnet(network, prefix, 'ipv4');
}

for (const [network, prefix] of [
  ['::', 128],
  ['::1', 128],
  ['::ffff:0:0', 96],
  ['64:ff9b:1::', 48],
  ['100::', 64],
  ['2001::', 32],
  ['2001:2::', 48],
  ['2001:db8::', 32],
  ['fc00::', 7],
  ['fe80::', 10],
  ['ff00::', 8],
] as const) {
  blockedIpv6Addresses.addSubnet(network, prefix, 'ipv6');
}

class SourceProxyError extends TaggedError('SourceProxyError')<{
  message: string;
  status: number;
  cause?: unknown;
}>() {}

function proxyError(message: string, status: number, cause?: unknown) {
  return new SourceProxyError({ message, status, cause });
}

export function isPublicSourceAddress(address: string) {
  const version = isIP(address);
  if (version === 4) return !blockedIpv4Addresses.check(address, 'ipv4');
  if (version === 6) return !blockedIpv6Addresses.check(address, 'ipv6');
  return false;
}

async function validateSourceUrl(value: string) {
  return Result.gen(async function* () {
    if (value.length === 0 || value.length > 4096) return Result.err(proxyError('Invalid source URL', 400));
    const url = yield* Result.try({
      try: () => new URL(value),
      catch: (cause) => proxyError('Invalid source URL', 400, cause),
    });
    if (url.protocol !== 'https:' || url.username !== '' || url.password !== '') {
      return Result.err(proxyError('Only public HTTPS source URLs are allowed', 400));
    }
    const hostname = url.hostname.replace(/^\[|\]$/g, '');
    if (
      hostname === 'localhost' ||
      hostname.endsWith('.localhost') ||
      hostname.endsWith('.local') ||
      hostname.endsWith('.internal') ||
      hostname.endsWith('.home.arpa')
    ) {
      return Result.err(proxyError('Private source addresses are not allowed', 403));
    }
    const addresses = yield* Result.await(
      Result.tryPromise({
        try: () => lookup(hostname, { all: true, verbatim: true }),
        catch: (cause) => proxyError('Source hostname could not be resolved', 502, cause),
      }),
    );
    if (addresses.length === 0 || addresses.some(({ address }) => !isPublicSourceAddress(address))) {
      return Result.err(proxyError('Private source addresses are not allowed', 403));
    }
    return Result.ok(url);
  });
}

function proxiedResponse(response: Response) {
  const contentLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength > maxSourceBytes) {
    void response.body?.cancel();
    return Result.err(proxyError('Source file is too large', 413));
  }

  const headers = new Headers({
    'cache-control': 'no-store',
    'content-type': response.headers.get('content-type') ?? 'application/octet-stream',
    'x-content-type-options': 'nosniff',
  });
  if (response.body === null || !response.ok) {
    void response.body?.cancel();
    return Result.ok(new Response(null, { status: response.status, statusText: response.statusText, headers }));
  }

  let received = 0;
  const body = response.body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        received += chunk.byteLength;
        if (received > maxSourceBytes) {
          controller.error(proxyError('Source file is too large', 413));
          return;
        }
        controller.enqueue(chunk);
      },
    }),
  );
  return Result.ok(new Response(body, { status: response.status, statusText: response.statusText, headers }));
}

export async function proxyRemoteSource(value: string | null) {
  if (value === null) return Result.err(proxyError('Missing source URL', 400));
  return Result.gen(async function* () {
    let source = value;
    for (let redirects = 0; redirects <= maxRedirects; redirects += 1) {
      const url = yield* Result.await(validateSourceUrl(source));
      const response = yield* Result.await(
        Result.tryPromise({
          try: () =>
            fetch(url, {
              headers: { accept: 'application/octet-stream, application/zip, */*' },
              redirect: 'manual',
              signal: AbortSignal.timeout(120_000),
            }),
          catch: (cause) => proxyError('Source request failed', 502, cause),
        }),
      );
      if (!redirectStatuses.has(response.status)) return proxiedResponse(response);
      const location = response.headers.get('location');
      void response.body?.cancel();
      if (location === null) return Result.err(proxyError('Source redirect was missing its destination', 502));
      const redirected = yield* Result.try({
        try: () => new URL(location, url).toString(),
        catch: (cause) => proxyError('Source redirect was invalid', 502, cause),
      });
      source = redirected;
    }
    return Result.err(proxyError('Source redirected too many times', 502));
  });
}
