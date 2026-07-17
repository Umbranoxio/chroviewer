interface Boundary {
  position: number;
  index: number;
}

function boundaryIndex(boundaries: readonly Boundary[], position: number, inclusive: boolean) {
  let low = 0;
  let high = boundaries.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    const boundary = boundaries[middle];
    if (boundary !== undefined && (boundary.position < position || (inclusive && boundary.position === position))) {
      low = middle + 1;
    } else {
      high = middle;
    }
  }
  return low;
}

function numberIndex(values: readonly number[], value: number) {
  let low = 0;
  let high = values.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if ((values[middle] ?? Infinity) < value) low = middle + 1;
    else high = middle;
  }
  return low;
}

export class ActiveWindowIndex {
  private readonly starts: Boundary[];
  private readonly ends: Boundary[];
  private readonly endInclusive: boolean;
  private readonly started: Uint8Array;
  private readonly expired: Uint8Array;
  private readonly active: Uint8Array;
  private readonly activeIndices: number[] = [];
  private startCursor = 0;
  private endCursor = 0;
  private initialized = false;

  constructor(
    length: number,
    startAt: (index: number) => number,
    endAt: (index: number) => number,
    endInclusive: boolean,
  ) {
    this.starts = Array.from({ length }, (_, index) => ({ position: startAt(index), index }));
    this.ends = Array.from({ length }, (_, index) => ({ position: endAt(index), index }));
    const byPosition = (left: Boundary, right: Boundary) => left.position - right.position || left.index - right.index;
    this.starts.sort(byPosition);
    this.ends.sort(byPosition);
    this.endInclusive = endInclusive;
    this.started = new Uint8Array(length);
    this.expired = new Uint8Array(length);
    this.active = new Uint8Array(length);
  }

  at(position: number): readonly number[] {
    const startCursor = boundaryIndex(this.starts, position, true);
    const endCursor = boundaryIndex(this.ends, position, !this.endInclusive);
    const changes = Math.abs(startCursor - this.startCursor) + Math.abs(endCursor - this.endCursor);
    const rebuild = !this.initialized || changes > Math.max(this.activeIndices.length * 2, 64);
    this.moveStartCursor(startCursor, !rebuild);
    this.moveEndCursor(endCursor, !rebuild);
    if (rebuild) this.rebuild();
    this.initialized = true;
    return this.activeIndices;
  }

  get current(): readonly number[] {
    return this.activeIndices;
  }

  private moveStartCursor(cursor: number, sync: boolean) {
    while (this.startCursor < cursor) {
      const boundary = this.starts[this.startCursor++];
      if (boundary !== undefined) this.setStarted(boundary.index, true, sync);
    }
    while (this.startCursor > cursor) {
      const boundary = this.starts[--this.startCursor];
      if (boundary !== undefined) this.setStarted(boundary.index, false, sync);
    }
  }

  private moveEndCursor(cursor: number, sync: boolean) {
    while (this.endCursor < cursor) {
      const boundary = this.ends[this.endCursor++];
      if (boundary !== undefined) this.setExpired(boundary.index, true, sync);
    }
    while (this.endCursor > cursor) {
      const boundary = this.ends[--this.endCursor];
      if (boundary !== undefined) this.setExpired(boundary.index, false, sync);
    }
  }

  private rebuild() {
    this.activeIndices.length = 0;
    for (let index = 0; index < this.active.length; index++) {
      const active = this.started[index] === 1 && this.expired[index] === 0;
      this.active[index] = active ? 1 : 0;
      if (active) this.activeIndices.push(index);
    }
  }

  private setStarted(index: number, value: boolean, sync: boolean) {
    this.started[index] = value ? 1 : 0;
    if (sync) this.sync(index);
  }

  private setExpired(index: number, value: boolean, sync: boolean) {
    this.expired[index] = value ? 1 : 0;
    if (sync) this.sync(index);
  }

  private sync(index: number) {
    const active = this.started[index] === 1 && this.expired[index] === 0;
    if (active === (this.active[index] === 1)) return;
    this.active[index] = active ? 1 : 0;
    const position = numberIndex(this.activeIndices, index);
    if (active) this.activeIndices.splice(position, 0, index);
    else this.activeIndices.splice(position, 1);
  }
}
