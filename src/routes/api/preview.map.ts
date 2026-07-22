import { createFileRoute } from '@tanstack/react-router';

import { renderMapPreview } from '../../server/preview-image';

const errorHeaders = { 'cache-control': 'no-store', 'content-type': 'text/plain; charset=utf-8' };

export const Route = createFileRoute('/api/preview/map')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const mapKey = url.searchParams.get('mapKey');
        if (mapKey === null || !/^[0-9a-f]{1,16}$/i.test(mapKey)) {
          return new Response('mapKey is required', { status: 400, headers: errorHeaders });
        }
        const result = await renderMapPreview(mapKey.toLowerCase(), url.origin);
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
