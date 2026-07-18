import '../styles.css';

import type { ReactNode } from 'react';

import { QueryClientProvider } from '@tanstack/react-query';
import { HeadContent, Outlet, Scripts, createRootRouteWithContext } from '@tanstack/react-router';

import { defaultLocale } from '../i18n/config';
import { AppIntlProvider } from '../i18n/provider';
import type { RouterContext } from '../router';

export const Route = createRootRouteWithContext<RouterContext>()({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { httpEquiv: 'Content-Type', content: 'text/html; charset=utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1.0, viewport-fit=cover' },
      { name: 'theme-color', content: '#facc15', 'data-react-helmet': 'true' },
    ],
    links: [
      {
        rel: 'icon',
        href: 'TemplateData/favicon-32x32.png',
        sizes: '32x32',
        type: 'image/png',
      },
      {
        rel: 'icon',
        href: 'TemplateData/favicon-16x16.png',
        sizes: '16x16',
        type: 'image/png',
      },
      {
        rel: 'apple-touch-icon',
        href: 'TemplateData/apple-touch-icon.png',
        sizes: '180x180',
        type: 'image/png',
      },
      {
        rel: 'preload',
        href: '/fonts/geist-latin-400-normal.woff2',
        as: 'font',
        type: 'font/woff2',
        crossOrigin: 'anonymous',
      },
      {
        rel: 'preload',
        href: '/fonts/geist-latin-500-normal.woff2',
        as: 'font',
        type: 'font/woff2',
        crossOrigin: 'anonymous',
      },
      {
        rel: 'preload',
        href: '/fonts/geist-latin-600-normal.woff2',
        as: 'font',
        type: 'font/woff2',
        crossOrigin: 'anonymous',
      },
    ],
  }),
  component: RootComponent,
});

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <RootDocument>
      <AppIntlProvider initialLocale={defaultLocale}>
        <QueryClientProvider client={queryClient}>
          <Outlet />
        </QueryClientProvider>
      </AppIntlProvider>
    </RootDocument>
  );
}

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en-us">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}
