import { createLazyFileRoute } from '@tanstack/react-router';

import { ViewerShell } from '../modules/viewer/viewer-shell';

export const Route = createLazyFileRoute('/')({
  component: ViewerShell,
});
