import { createLazyFileRoute, useSearch } from '@tanstack/react-router';

import { ViewerShell } from '../modules/viewer/viewer-shell';

export const Route = createLazyFileRoute('/')({
  component: ViewerRoute,
});

function ViewerRoute() {
  const search = useSearch({ from: '/' });
  return <ViewerShell key={search.party === undefined ? 'viewer' : `party:${search.party}`} />;
}
