import { createFileRoute } from '@tanstack/react-router';

import { renderReplayPreview } from '../../server/replay-preview';

const errorHeaders = { 'cache-control': 'no-store', 'content-type': 'text/plain; charset=utf-8' };

export const Route = createFileRoute('/api/preview/replay')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const scoreId = url.searchParams.get('scoreId');
        if (scoreId === null || !/^\d{1,20}$/.test(scoreId)) {
          return new Response('scoreId is required', { status: 400, headers: errorHeaders });
        }
        const result = await renderReplayPreview(scoreId, url.origin);
        if (result.isErr()) {
          return new Response(result.error.message, { status: result.error.status, headers: errorHeaders });
        }
        return new Response(result.value, {
          headers: {
            'cache-control': 'public, max-age=600, s-maxage=600, stale-while-revalidate=86400',
            'content-type': 'image/png',
            'x-content-type-options': 'nosniff',
          },
        });
      },
    },
  },
});
