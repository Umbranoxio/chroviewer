import { createFileRoute } from '@tanstack/react-router';
import { createIsomorphicFn } from '@tanstack/react-start';
import { getRequestUrl } from '@tanstack/react-start/server';

import { viewerSearchSchema } from '../modules/viewer/viewer-search';

const requestOrigin = createIsomorphicFn()
  .server(() => getRequestUrl().origin)
  .client(() => window.location.origin);

export const Route = createFileRoute('/')({
  ssr: false,
  validateSearch: viewerSearchSchema,
  head: ({ match }) => {
    const scoreId = match.search.scoreId;
    if (scoreId === undefined) return {};
    const image = new URL(`/api/preview/replay?scoreId=${scoreId}`, requestOrigin()).toString();
    const alt = 'ScoreSaber replay score card';
    return {
      meta: [
        { property: 'og:title', content: 'ScoreSaber Replay' },
        { property: 'og:description', content: 'Watch this replay in your browser' },
        { name: 'description', content: 'Watch this replay in your browser' },
        { property: 'og:image', content: image },
        { property: 'og:image:width', content: '1200' },
        { property: 'og:image:height', content: '630' },
        { property: 'og:image:type', content: 'image/png' },
        { property: 'og:image:alt', content: alt },
        { name: 'twitter:card', content: 'summary_large_image' },
        { name: 'twitter:title', content: 'ScoreSaber Replay' },
        { name: 'twitter:image', content: image },
        { name: 'twitter:image:alt', content: alt },
      ],
    };
  },
});
