import type { IndexFilter } from '../beatmap/types';
import { easingFromId } from '../easing';

export interface FilterEntry {
  element: number;
  durationOrder: number;
  distributionOrder: number;
}

export interface ConvertedIndexFilter {
  entries: FilterEntry[];
  count: number;
  visibleCount: number;
  limitsDuration: boolean;
  limitsDistribution: boolean;
}

class DotNetRandom {
  private readonly seedArray = Array.from({ length: 56 }, () => 0);
  private inext = 0;
  private inextp = 21;

  constructor(seed: number) {
    const subtraction = seed === -2147483648 ? 2147483647 : Math.abs(seed);
    let mj = 161803398 - subtraction;
    if (mj < 0) mj += 2147483647;
    this.seedArray[55] = mj;
    let mk = 1;
    for (let i = 1; i < 55; i += 1) {
      const ii = (21 * i) % 55;
      this.seedArray[ii] = mk;
      mk = mj - mk;
      if (mk < 0) mk += 2147483647;
      mj = this.seedArray[ii] ?? 0;
    }
    for (let k = 1; k < 5; k += 1) {
      for (let i = 1; i < 56; i += 1) {
        let value = (this.seedArray[i] ?? 0) - (this.seedArray[1 + ((i + 30) % 55)] ?? 0);
        if (value < 0) value += 2147483647;
        this.seedArray[i] = value;
      }
    }
  }

  next(max: number) {
    this.inext += 1;
    if (this.inext >= 56) this.inext = 1;
    this.inextp += 1;
    if (this.inextp >= 56) this.inextp = 1;
    let value = (this.seedArray[this.inext] ?? 0) - (this.seedArray[this.inextp] ?? 0);
    if (value === 2147483647) value -= 1;
    if (value < 0) value += 2147483647;
    this.seedArray[this.inext] = value;
    return Math.floor((value / 2147483647) * max);
  }
}

function shuffle(values: number[], seed: number) {
  const random = new DotNetRandom(seed);
  const shuffled: number[] = [];
  for (const value of values) {
    const index = random.next(shuffled.length + 1);
    if (index === shuffled.length) shuffled.push(value);
    else {
      shuffled.push(shuffled[index] ?? 0);
      shuffled[index] = value;
    }
  }
  return shuffled;
}

function enumerate(
  start: number,
  step: number,
  count: number,
  groupSize: number,
  chunkSize: number,
  filter: IndexFilter,
): ConvertedIndexFilter {
  let elements = Array.from({ length: count }, (_, index) => start + index * step);
  if (filter.random !== 0 && (filter.random & 1) === 0) elements = shuffle(elements, filter.seed);

  const visibleCount = filter.limit === 0 || filter.limit === 1 ? count : Math.ceil(count * filter.limit);
  let ids = Array.from({ length: count }, (_, index) => index);
  if (visibleCount > 0) {
    if ((filter.random & 2) !== 0) {
      const random = new DotNetRandom(filter.seed);
      let picked = 0;
      ids = ids.map((id, index) => {
        if (random.next(count - index) >= visibleCount - picked) return -1;
        picked += 1;
        return id;
      });
    } else {
      ids = ids.map((id, index) => (index < visibleCount ? id : -1));
    }
  }

  const limitsDuration = (filter.limitAffectsType & 1) !== 0;
  const limitsDistribution = (filter.limitAffectsType & 2) !== 0;
  const entries: FilterEntry[] = [];
  let limitedOrder = 0;
  for (let i = 0; i < count; i += 1) {
    const order = ids[i] ?? -1;
    if (order === -1) continue;
    const elementIndex = elements[i] ?? 0;
    for (let localChunkIndex = 0; localChunkIndex < chunkSize; localChunkIndex += 1) {
      const element = elementIndex * chunkSize + localChunkIndex;
      if (element >= groupSize) break;
      entries.push({
        element,
        durationOrder: limitsDuration ? limitedOrder : order,
        distributionOrder: limitsDistribution ? limitedOrder : order,
      });
    }
    limitedOrder += 1;
  }
  return { entries, count, visibleCount, limitsDuration, limitsDistribution };
}

export function convertIndexFilter(filter: IndexFilter, groupSize: number): ConvertedIndexFilter | null {
  const chunkSize = filter.chunks === 0 ? 1 : Math.ceil(groupSize / filter.chunks);
  const offsetSize = Math.ceil(groupSize / chunkSize);
  if (filter.type === 1) {
    const offset = Math.ceil(offsetSize / filter.param0);
    if (filter.reverse === 1) {
      const start = offsetSize - offset * filter.param1 - 1;
      const end = Math.max(0, start - offset + 1);
      return enumerate(start, end > start ? 1 : -1, Math.abs(end - start) + 1, groupSize, chunkSize, filter);
    }
    const start = offset * filter.param1;
    const end = Math.min(offsetSize - 1, start + offset - 1);
    return enumerate(start, end < start ? -1 : 1, Math.abs(end - start) + 1, groupSize, chunkSize, filter);
  }
  if (filter.type !== 2) return null;
  const offsetStep = offsetSize - filter.param0;
  if (offsetStep <= 0) return null;
  const count = filter.param1 === 0 ? 1 : Math.ceil(offsetStep / filter.param1);
  const start = filter.reverse === 1 ? offsetSize - 1 - filter.param0 : filter.param0;
  const step = filter.reverse === 1 ? -filter.param1 : filter.param1;
  return enumerate(start, step, count, groupSize, chunkSize, filter);
}

export function beatDistributionStep(
  filter: ConvertedIndexFilter,
  type: number,
  distribution: number,
  lastRelativeBeat: number,
) {
  const count = filter.limitsDuration ? filter.visibleCount : filter.count;
  const value = type === 1 ? Math.max(distribution - lastRelativeBeat, 0) : distribution;
  return type === 1 ? value / Math.max(count - 1, 1) : value;
}

export function valueDistributionOffset(
  filter: ConvertedIndexFilter,
  order: number,
  type: number,
  distribution: number,
  easing: number,
) {
  const count = filter.limitsDistribution ? filter.visibleCount : filter.count;
  const ease = easingFromId(easing);
  return type === 1 ? distribution * ease(order / Math.max(count - 1, 1)) : distribution * ease(order / count) * count;
}
