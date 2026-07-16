import type { QueryClient } from '@tanstack/react-query';
import { createRouter, defaultParseSearch } from '@tanstack/react-router';

import { createQueryClient } from './app/query-client';
import { routeTree } from './routeTree.gen';

type RouterSearchValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | RouterSearchValue[]
  | { readonly [key: string]: RouterSearchValue };

export interface RouterContext {
  queryClient: QueryClient;
}

const searchKeyAliases: Record<string, string> = {
  map: 'map',
  scoreid: 'scoreId',
  ssscoreid: 'scoreId',
  difficulty: 'difficulty',
  beat: 'beat',
  autoplay: 'autoplay',
  lightshow: 'lightshow',
  settings: 'settings',
  playerid: 'playerId',
  tournamentid: 'tournamentId',
  roomid: 'roomId',
  matchid: 'matchId',
  watcherplayerid: 'watcherPlayerId',
  authtoken: 'authToken',
};

const stringSearchAliases: Record<string, string[]> = {
  map: ['map'],
  scoreId: ['scoreid', 'ssscoreid'],
  playerId: ['playerid'],
  tournamentId: ['tournamentid'],
  roomId: ['roomid'],
  matchId: ['matchid'],
  watcherPlayerId: ['watcherplayerid'],
  authToken: ['authtoken'],
};

export function parseUrlSearch(search: string) {
  const raw: Record<string, unknown> = defaultParseSearch(search);
  const parsed: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    const canonical = searchKeyAliases[key.toLowerCase()];
    if (canonical === undefined) {
      parsed[key] = value;
      continue;
    }
    const direct = key.toLowerCase() === canonical.toLowerCase();
    if (parsed[canonical] === undefined || direct) parsed[canonical] = value;
  }
  const searchParams = new URLSearchParams(search);
  for (const [canonical, aliases] of Object.entries(stringSearchAliases)) {
    const entry = [...searchParams].find(([key]) => aliases.includes(key.toLowerCase()));
    if (entry !== undefined) parsed[canonical] = entry[1];
  }
  return parsed;
}

function stringifyUrlSearch(search: Record<string, RouterSearchValue>) {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(search)) appendSearchValue(searchParams, key, value);
  const next = searchParams.toString();
  return next === '' ? '' : `?${next}`;
}

function appendSearchValue(searchParams: URLSearchParams, key: string, value: RouterSearchValue) {
  if (value === null || value === undefined || value === '') return;
  if (Array.isArray(value)) {
    for (const item of value) appendSearchValue(searchParams, key, item);
    return;
  }
  searchParams.append(key, typeof value === 'object' ? JSON.stringify(value) : String(value));
}

export function getRouter() {
  const queryClient = createQueryClient();

  return createRouter({
    routeTree,
    context: { queryClient },
    defaultPreload: 'intent',
    defaultPreloadDelay: 30,
    defaultViewTransition: false,
    scrollRestoration: true,
    parseSearch: parseUrlSearch,
    stringifySearch: stringifyUrlSearch,
  });
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
