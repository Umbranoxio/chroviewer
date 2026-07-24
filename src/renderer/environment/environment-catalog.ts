export interface EnvironmentCatalogEntry {
  id: string;
  title: string;
}

export const environmentCatalog: readonly EnvironmentCatalogEntry[] = [
  { id: 'DefaultEnvironment', title: 'The First' },
  { id: 'OriginsEnvironment', title: 'Origins' },
  { id: 'TriangleEnvironment', title: 'Triangle' },
  { id: 'NiceEnvironment', title: 'Nice' },
  { id: 'BigMirrorEnvironment', title: 'Big Mirror' },
  { id: 'DragonsEnvironment', title: 'Dragons' },
  { id: 'KDAEnvironment', title: 'KDA' },
  { id: 'MonstercatEnvironment', title: 'Monstercat' },
  { id: 'CrabRaveEnvironment', title: 'Crab Rave' },
  { id: 'PanicEnvironment', title: 'Panic' },
  { id: 'RocketEnvironment', title: 'Rocket' },
  { id: 'GreenDayGrenadeEnvironment', title: 'Green Day Grenade' },
  { id: 'GreenDayEnvironment', title: 'Green Day' },
  { id: 'TimbalandEnvironment', title: 'Timbaland' },
  { id: 'FitBeatEnvironment', title: 'Fit Beat' },
  { id: 'LinkinParkEnvironment', title: 'Linkin Park' },
  { id: 'GlassDesertEnvironment', title: 'Glass Desert' },
  { id: 'BTSEnvironment', title: 'BTS' },
  { id: 'KaleidoscopeEnvironment', title: 'Kaleidoscope' },
  { id: 'InterscopeEnvironment', title: 'Interscope' },
  { id: 'GagaEnvironment', title: 'Gaga' },
  { id: 'SkrillexEnvironment', title: 'Skrillex' },
  { id: 'HalloweenEnvironment', title: 'Spooky' },
  { id: 'WeaveEnvironment', title: 'Weave' },
  { id: 'EDMEnvironment', title: 'EDM' },
  { id: 'TheSecondEnvironment', title: 'The Second' },
  { id: 'LizzoEnvironment', title: 'Lizzo' },
  { id: 'TheWeekndEnvironment', title: 'The Weeknd' },
  { id: 'Dragons2Environment', title: 'Dragons 2.0' },
  { id: 'LatticeEnvironment', title: 'Lattice' },
  { id: 'DaftPunkEnvironment', title: 'Daft Punk' },
  { id: 'HipHopEnvironment', title: 'Hip Hop Mixtape' },
  { id: 'ColliderEnvironment', title: 'Collider' },
  { id: 'GridEnvironment', title: 'Cube' },
];

const environmentIds = new Set([...environmentCatalog.map(({ id }) => id), 'BillieEnvironment']);

export function resolveEnvironmentId(id: string) {
  return environmentIds.has(id) ? id : 'DefaultEnvironment';
}
