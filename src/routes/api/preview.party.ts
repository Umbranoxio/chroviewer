import { createFileRoute } from '@tanstack/react-router';

import { renderPartyPreview } from '../../server/preview-image';

const errorHeaders = { 'cache-control': 'no-store', 'content-type': 'text/plain; charset=utf-8' };

function scoreSaberAvatarUrl(value: string | null) {
  if (value === null || value.length > 512 || !URL.canParse(value)) return null;
  const url = new URL(value);
  return url.protocol === 'https:' && url.hostname === 'cdn.scoresaber.com' && url.pathname.startsWith('/avatars/')
    ? url.toString()
    : null;
}

export const Route = createFileRoute('/api/preview/party')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const playerId = url.searchParams.get('playerId');
        if (playerId === null || !/^\d{1,20}$/.test(playerId)) {
          return new Response('playerId is required', { status: 400, headers: errorHeaders });
        }
        const rawName = url.searchParams.get('name');
        const playerName = rawName !== null && rawName.trim() !== '' && rawName.length <= 64 ? rawName : null;
        const avatarUrl = scoreSaberAvatarUrl(url.searchParams.get('avatar'));
        const result = await renderPartyPreview(playerId, url.origin, { playerName, avatarUrl });
        if (result.isErr()) {
          return new Response(result.error.message, { status: result.error.status, headers: errorHeaders });
        }
        return new Response(result.value.data, {
          headers: {
            'cache-control': result.value.degraded
              ? 'public, max-age=60, s-maxage=60, stale-while-revalidate=300'
              : 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800, stale-if-error=604800',
            'content-type': 'image/png',
            'x-content-type-options': 'nosniff',
          },
        });
      },
    },
  },
});
