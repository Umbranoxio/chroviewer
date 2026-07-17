import { createFileRoute } from '@tanstack/react-router';

import { proxyRemoteSource } from '../../server/source-proxy';

export const Route = createFileRoute('/api/source')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const result = await proxyRemoteSource(new URL(request.url).searchParams.get('url'));
        return result.isOk()
          ? result.value
          : new Response(result.error.message, {
              status: result.error.status,
              headers: { 'cache-control': 'no-store', 'content-type': 'text/plain; charset=utf-8' },
            });
      },
    },
  },
});
