export function blueNoiseData(size = 64) {
  const length = size * size;
  const white = new Float32Array(length);
  let state = 0x6d2b79f5;
  for (let i = 0; i < length; i++) {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    white[i] = (state >>> 0) / 0xffffffff;
  }

  const score = new Float32Array(length);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let neighbors = 0;
      for (let oy = -1; oy <= 1; oy++) {
        for (let ox = -1; ox <= 1; ox++) {
          if (ox === 0 && oy === 0) continue;
          const nx = (x + ox + size) % size;
          const ny = (y + oy + size) % size;
          neighbors += white[ny * size + nx] ?? 0;
        }
      }
      const index = y * size + x;
      score[index] = (white[index] ?? 0) - neighbors / 8;
    }
  }

  const order = Array.from({ length }, (_, index) => index);
  order.sort((a, b) => (score[a] ?? 0) - (score[b] ?? 0));
  const data = new Uint8Array(length * 4);
  for (let rank = 0; rank < length; rank++) {
    const index = order[rank] ?? 0;
    const value = Math.round((rank * 255) / Math.max(length - 1, 1));
    const offset = index * 4;
    data[offset] = value;
    data[offset + 1] = value;
    data[offset + 2] = value;
    data[offset + 3] = 255;
  }
  return data;
}
