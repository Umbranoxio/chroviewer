import { createFileRoute } from '@tanstack/react-router';

import { viewerSearchSchema } from '../modules/viewer/viewer-search';

export const Route = createFileRoute('/')({
  ssr: false,
  validateSearch: viewerSearchSchema,
});
