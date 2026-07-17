export function uint32PrefixEqual(left: Uint32Array, right: Uint32Array, count: number) {
  if (count > left.length || count > right.length) return false;
  for (let index = 0; index < count; index++) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}
