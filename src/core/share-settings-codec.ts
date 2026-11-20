import type { ShareField, ShareLayout, ShareSettingsCategory } from './share-layout-source';
import { frozenShareLayouts } from './share-layouts';
import type { ViewerSettings } from './viewer-settings';

export { SHARE_CATEGORIES, type ShareField, type ShareLayout, type ShareSettingsCategory } from './share-layout-source';

export const SHARE_LAYOUTS: ReadonlyMap<number, ShareLayout> = new Map(
  (frozenShareLayouts as readonly Omit<ShareLayout, 'version'>[]).map((layout, version) => [
    version,
    { ...layout, version },
  ]),
);

function latestLayout(): ShareLayout {
  const version = Math.max(...SHARE_LAYOUTS.keys());
  const layout = SHARE_LAYOUTS.get(version);
  if (layout === undefined) throw new Error('No share layout found in share-layouts/');
  return layout;
}

const MAX_GOLOMB_PREFIX = 8;
const COLOR_VALUES = 1n << 24n;
const EPSILON = 1e-9;

// base81 characters pool
const ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-._~!$&'()*+,;=:@/?";
const BASE = BigInt(ALPHABET.length);
const FINAL_BASE = 62n;
const ALPHABET_INDEX = new Map(ALPHABET.split('').map((char, index) => [char, BigInt(index)]));

class Writer {
  private readonly digits: [bigint, bigint][] = [];
  push(digit: bigint, radix: bigint) {
    if (radix > 1n) this.digits.push([digit, radix]);
  }
  pushExpGolomb(value: number) {
    const bits = (value + 1).toString(2);
    for (let index = 1; index < bits.length; index++) this.push(0n, 2n);
    for (const bit of bits) this.push(bit === '1' ? 1n : 0n, 2n);
  }
  toBigInt() {
    let value = 0n;
    for (let index = this.digits.length - 1; index >= 0; index--) {
      const [digit, radix] = this.digits[index] ?? [0n, 1n];
      value = value * radix + digit;
    }
    return value;
  }
}

class Reader {
  constructor(private value: bigint) {}
  pop(radix: bigint) {
    if (radix <= 1n) return 0n;
    const digit = this.value % radix;
    this.value /= radix;
    return digit;
  }
  popExpGolomb() {
    let zeros = 0;
    while (this.pop(2n) === 0n) {
      if (++zeros > MAX_GOLOMB_PREFIX) return undefined;
    }
    let value = 1;
    for (let index = 0; index < zeros; index++) value = value * 2 + Number(this.pop(2n));
    return value - 1;
  }
  get done() {
    return this.value === 0n;
  }
}

function bigintToFragment(value: bigint) {
  let text = '';
  let rest = value;
  while (rest >= FINAL_BASE) {
    text += ALPHABET[Number(rest % BASE)];
    rest /= BASE;
  }
  return text + ALPHABET[Number(rest)];
}

function fragmentToBigint(text: string): bigint | undefined {
  if (text.length === 0) return undefined;
  let value = 0n;
  for (let index = text.length - 1; index >= 0; index--) {
    const digit = ALPHABET_INDEX.get(text.charAt(index));
    if (digit === undefined) return undefined;
    if (index === text.length - 1 && digit >= FINAL_BASE) return undefined;
    value = value * BASE + digit;
  }
  return value;
}

const binomialCache = new Map<string, bigint>();
function binomial(n: number, k: number): bigint {
  if (k < 0 || k > n) return 0n;
  const cacheKey = `${n},${k}`;
  const cached = binomialCache.get(cacheKey);
  if (cached !== undefined) return cached;
  let result = 1n;
  const kk = Math.min(k, n - k);
  for (let index = 1; index <= kk; index++) result = (result * BigInt(n - kk + index)) / BigInt(index);
  binomialCache.set(cacheKey, result);
  return result;
}

function subsetRank(sortedIndices: readonly number[]) {
  let rank = 0n;
  sortedIndices.forEach((value, position) => {
    rank += binomial(value, position + 1);
  });
  return rank;
}

function subsetUnrank(rank: bigint, n: number, k: number) {
  const indices: number[] = [];
  let rest = rank;
  let upper = n - 1;
  for (let position = k; position >= 1; position--) {
    let candidate = upper;
    while (candidate >= position - 1 && binomial(candidate, position) > rest) candidate--;
    if (candidate < position - 1) return undefined;
    rest -= binomial(candidate, position);
    indices.push(candidate);
    upper = candidate - 1;
  }
  if (rest !== 0n) return undefined;
  return indices.reverse();
}

function gridSize(field: Extract<ShareField, { kind: 'num' }>) {
  return Math.round((field.max - field.min) / field.step) + 1;
}

function gridIndex(field: Extract<ShareField, { kind: 'num' }>, value: number) {
  return Math.min(Math.max(Math.round((value - field.min) / field.step), 0), gridSize(field) - 1);
}

function gridValue(field: Extract<ShareField, { kind: 'num' }>, index: number) {
  return Math.round((field.min + index * field.step) * 1e9) / 1e9;
}

function numDefault(field: Extract<ShareField, { kind: 'num' }>, defaultValue: number) {
  const index = gridIndex(field, defaultValue);
  return { index, onGrid: Math.abs(gridValue(field, index) - defaultValue) < EPSILON };
}

function colorInt(hex: string) {
  return BigInt(Number.parseInt(hex.slice(1, 7), 16));
}

function colorHex(value: bigint) {
  return `#${value.toString(16).padStart(6, '0')}`;
}

function colorReferences(earlier: readonly bigint[], fallback: bigint) {
  return [...new Set(earlier)].filter((value) => value !== fallback);
}

function isChanged(field: ShareField, value: unknown): boolean {
  const fallback = field.default;
  switch (field.kind) {
    case 'bool':
      return typeof value === 'boolean' && value !== fallback;
    case 'enum':
      return typeof value === 'string' && value !== fallback && field.values.includes(value);
    case 'color':
      return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) && value.toLowerCase() !== fallback;
    case 'num': {
      if (typeof value !== 'number' || !Number.isFinite(value) || typeof fallback !== 'number') return false;
      const { index, onGrid } = numDefault(field, fallback);
      return onGrid ? gridIndex(field, value) !== index : Math.abs(value - fallback) > EPSILON;
    }
  }
}

function fieldsFor(layout: ShareLayout, mask: number) {
  return layout.fields.filter((field) => (mask & (1 << layout.categories.indexOf(field.category))) !== 0);
}

function maskOf(layout: ShareLayout, categories: readonly string[]) {
  let mask = 0;
  for (const category of categories) {
    const index = layout.categories.indexOf(category);
    if (index !== -1) mask |= 1 << index;
  }
  return mask;
}

export function encodeShareSettings(
  settings: ViewerSettings,
  categories: readonly ShareSettingsCategory[],
  resetOthers: boolean,
  layout: ShareLayout = latestLayout(),
): string | undefined {
  const mask = maskOf(layout, categories);
  if (mask === 0) return undefined;
  const fields = fieldsFor(layout, mask);
  const changed: number[] = [];
  fields.forEach((field, index) => {
    if (isChanged(field, settings[field.key])) changed.push(index);
  });
  if (changed.length === 0 && !resetOthers) return undefined;

  const writer = new Writer();
  if (layout.version === 0) writer.push(0n, 2n);
  else {
    writer.push(1n, 2n);
    writer.pushExpGolomb(layout.version - 1);
  }
  writer.push(BigInt(mask), 1n << BigInt(layout.categories.length));
  writer.push(resetOthers ? 1n : 0n, 2n);
  writer.pushExpGolomb(changed.length);
  writer.push(subsetRank(changed), binomial(fields.length, changed.length));

  const changedSet = new Set(changed);
  const colorValues: bigint[] = [];
  fields.forEach((field, index) => {
    const value = settings[field.key];
    const isFieldChanged = changedSet.has(index);
    if (field.kind === 'color') {
      const fallback = colorInt(String(field.default));
      const current = isFieldChanged && typeof value === 'string' ? colorInt(value) : fallback;
      if (isFieldChanged) {
        const references = colorReferences(colorValues, fallback);
        const reference = references.indexOf(current);
        writer.push(BigInt(reference + 1), BigInt(references.length + 1));
        if (reference === -1) writer.push(current > fallback ? current - 1n : current, COLOR_VALUES - 1n);
      }
      colorValues.push(current);
      return;
    }
    if (!isFieldChanged) return;
    switch (field.kind) {
      case 'bool':
        return;
      case 'enum': {
        const values = field.values;
        const fallbackIndex = values.indexOf(String(field.default));
        const valueIndex = values.indexOf(String(value));
        const radix = BigInt(values.length - (fallbackIndex === -1 ? 0 : 1));
        const digit = fallbackIndex !== -1 && valueIndex > fallbackIndex ? valueIndex - 1 : valueIndex;
        writer.push(BigInt(digit), radix);
        return;
      }
      case 'num': {
        const { index: fallbackIndex, onGrid } = numDefault(field, Number(field.default));
        const q = gridIndex(field, Number(value));
        const size = gridSize(field);
        if (onGrid) writer.push(BigInt(q > fallbackIndex ? q - 1 : q), BigInt(size - 1));
        else writer.push(BigInt(q), BigInt(size));
      }
    }
  });

  return bigintToFragment(writer.toBigInt());
}

export interface DecodedShareSettings {
  categories: string[];
  resetOthers: boolean;
  patch: Partial<ViewerSettings>;
}

export function decodeShareSettings(
  code: string,
  layouts: ReadonlyMap<number, ShareLayout> = SHARE_LAYOUTS,
): DecodedShareSettings | undefined {
  let text = code.startsWith('#') ? code.slice(1) : code;
  if (text.includes('%')) {
    try {
      text = decodeURIComponent(text);
    } catch {
      return undefined;
    }
  }
  if (text.length > 512) return undefined;
  const value = fragmentToBigint(text);
  if (value === undefined) return undefined;

  const reader = new Reader(value);
  const laterVersion = reader.pop(2n) === 1n ? reader.popExpGolomb() : -1;
  const layout = laterVersion === undefined ? undefined : layouts.get(laterVersion + 1);
  if (layout === undefined) return undefined;
  const mask = Number(reader.pop(1n << BigInt(layout.categories.length)));
  if (mask === 0) return undefined;
  const resetOthers = reader.pop(2n) === 1n;
  const fields = fieldsFor(layout, mask);
  const k = reader.popExpGolomb();
  if (k === undefined || k > fields.length) return undefined;
  const changed = subsetUnrank(reader.pop(binomial(fields.length, k)), fields.length, k);
  if (changed === undefined) return undefined;
  const changedSet = new Set(changed);

  const patch: Record<string, unknown> = {};
  const colorValues: bigint[] = [];
  for (const [index, field] of fields.entries()) {
    const fallback = field.default;
    if (!changedSet.has(index)) {
      if (field.kind === 'color') colorValues.push(colorInt(String(fallback)));
      if (resetOthers) patch[field.key] = fallback;
      continue;
    }
    switch (field.kind) {
      case 'bool':
        patch[field.key] = fallback !== true;
        break;
      case 'enum': {
        const values = field.values;
        const fallbackIndex = values.indexOf(String(fallback));
        const radix = values.length - (fallbackIndex === -1 ? 0 : 1);
        const digit = Number(reader.pop(BigInt(radix)));
        patch[field.key] = values[fallbackIndex !== -1 && digit >= fallbackIndex ? digit + 1 : digit];
        break;
      }
      case 'num': {
        const { index: fallbackIndex, onGrid } = numDefault(field, Number(fallback));
        const size = gridSize(field);
        const digit = Number(reader.pop(BigInt(onGrid ? size - 1 : size)));
        patch[field.key] = gridValue(field, onGrid && digit >= fallbackIndex ? digit + 1 : digit);
        break;
      }
      case 'color': {
        const fallbackInt = colorInt(String(fallback));
        const references = colorReferences(colorValues, fallbackInt);
        const selector = Number(reader.pop(BigInt(references.length + 1)));
        let current: bigint;
        if (selector > 0) current = references[selector - 1] ?? fallbackInt;
        else {
          const digit = reader.pop(COLOR_VALUES - 1n);
          current = digit >= fallbackInt ? digit + 1n : digit;
        }
        colorValues.push(current);
        patch[field.key] = colorHex(current);
        break;
      }
    }
  }
  if (!reader.done) return undefined;

  return {
    categories: layout.categories.filter((_, index) => (mask & (1 << index)) !== 0),
    resetOthers,
    patch: patch as Partial<ViewerSettings>,
  };
}
