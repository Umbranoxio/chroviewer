import { createFileRoute } from '@tanstack/react-router';
import { createIsomorphicFn } from '@tanstack/react-start';
import { getRequestUrl } from '@tanstack/react-start/server';
import { Result } from 'better-result';

import { viewerSearchSchema } from '../modules/viewer/viewer-search';
import { getReplayPreviewTitle } from '../server/replay-preview-metadata.functions';

const requestOrigin = createIsomorphicFn()
  .server(() => getRequestUrl().origin)
  .client(() => window.location.origin);

const defaultImage = 'https://scoresaber.com/ScoreSaber-iOS-Default-1024x1024@1x.png';

export const Route = createFileRoute('/')({
  ssr: false,
  validateSearch: viewerSearchSchema,
  head: async ({ match }) => {
    const scoreId = match.search.scoreId;
    if (scoreId === undefined) {
      return {
        meta: [
          { title: 'ScoreSaber Watch' },
          { property: 'og:site_name', content: 'ScoreSaber' },
          { property: 'og:title', content: 'ScoreSaber Watch' },
          { property: 'og:image', content: defaultImage },
          { property: 'og:image:width', content: '1024' },
          { property: 'og:image:height', content: '1024' },
          { property: 'og:image:type', content: 'image/png' },
          { property: 'og:image:alt', content: 'ScoreSaber logo' },
          { name: 'twitter:card', content: 'summary' },
          { name: 'twitter:site', content: '@ScoreSaber' },
          { name: 'twitter:title', content: 'ScoreSaber Watch' },
          { name: 'twitter:image', content: defaultImage },
          { name: 'twitter:image:alt', content: 'ScoreSaber logo' },
        ],
      };
    }
    const titleResult = await Result.tryPromise({
      try: () => getReplayPreviewTitle({ data: { scoreId } }),
      catch: (cause) => cause,
    });
    const title = titleResult.isOk() ? titleResult.value : 'ScoreSaber Replay';
    const description = 'ChroViewer web replay';
    const image = new URL(`/api/preview/replay?scoreId=${scoreId}`, requestOrigin()).toString();
    const alt = 'ScoreSaber replay score card';
    return {
      meta: [
        { title },
        { property: 'og:site_name', content: 'ScoreSaber - ChroViewer' },
        { property: 'og:title', content: title },
        { property: 'og:description', content: description },
        { name: 'description', content: description },
        { property: 'og:image', content: image },
        { property: 'og:image:width', content: '1200' },
        { property: 'og:image:height', content: '630' },
        { property: 'og:image:type', content: 'image/png' },
        { property: 'og:image:alt', content: alt },
        { name: 'twitter:card', content: 'summary_large_image' },
        { name: 'twitter:title', content: title },
        { name: 'twitter:description', content: description },
        { name: 'twitter:image', content: image },
        { name: 'twitter:image:alt', content: alt },
      ],
    };
  },
});
