import { DataTexture, LinearFilter, RGBAFormat } from 'three';

const SIZE = 16;
const TILES = 4;
const PADDED_SIZE = SIZE + 2;
const ATLAS_SIZE = PADDED_SIZE * TILES;
const PERMUTATION = [
  151, 160, 137, 91, 90, 15, 131, 13, 201, 95, 96, 53, 194, 233, 7, 225, 140, 36, 103, 30, 69, 142, 8, 99, 37, 240, 21,
  10, 23, 190, 6, 148, 247, 120, 234, 75, 0, 26, 197, 62, 94, 252, 219, 203, 117, 35, 11, 32, 57, 177, 33, 88, 237, 149,
  56, 87, 174, 20, 125, 136, 171, 168, 68, 175, 74, 165, 71, 134, 139, 48, 27, 166, 77, 146, 158, 231, 83, 111, 229,
  122, 60, 211, 133, 230, 220, 105, 92, 41, 55, 46, 245, 40, 244, 102, 143, 54, 65, 25, 63, 161, 1, 216, 80, 73, 209,
  76, 132, 187, 208, 89, 18, 169, 200, 196, 135, 130, 116, 188, 159, 86, 164, 100, 109, 198, 173, 186, 3, 64, 52, 217,
  226, 250, 124, 123, 5, 202, 38, 147, 118, 126, 255, 82, 85, 212, 207, 206, 59, 227, 47, 16, 58, 17, 182, 189, 28, 42,
  223, 183, 170, 213, 119, 248, 152, 2, 44, 154, 163, 70, 221, 153, 101, 155, 167, 43, 172, 9, 129, 22, 39, 253, 19, 98,
  108, 110, 79, 113, 224, 232, 178, 185, 112, 104, 218, 246, 97, 228, 251, 34, 242, 193, 238, 210, 144, 12, 191, 179,
  162, 241, 81, 51, 145, 235, 249, 14, 239, 107, 49, 192, 214, 31, 181, 199, 106, 157, 184, 84, 204, 176, 115, 121, 50,
  45, 127, 4, 150, 254, 138, 236, 205, 93, 222, 114, 67, 29, 24, 72, 243, 141, 128, 195, 78, 66, 215, 61, 156, 180,
];
const PERMUTATION_TABLE = [...PERMUTATION, ...PERMUTATION];

function fade(value: number) {
  return value * value * value * (value * (value * 6 - 15) + 10);
}

function gradient(hash: number, x: number, y: number, z: number) {
  switch (hash & 0xf) {
    case 0:
      return x + y;
    case 1:
      return -x + y;
    case 2:
      return x - y;
    case 3:
      return -x - y;
    case 4:
      return x + z;
    case 5:
      return -x + z;
    case 6:
      return x - z;
    case 7:
      return -x - z;
    case 8:
      return y + z;
    case 9:
      return -y + z;
    case 10:
      return y - z;
    case 11:
      return -y - z;
    case 12:
      return y + x;
    case 13:
      return -y + z;
    case 14:
      return y - x;
    default:
      return -y - z;
  }
}

function lerp(a: number, b: number, amount: number) {
  return a + amount * (b - a);
}

function increment(value: number, repeat: number) {
  value += 1;
  return repeat > 0 ? value % repeat : value;
}

function perlin3d(x: number, y: number, z: number, repeat: number) {
  if (repeat > 0) {
    x %= repeat;
    y %= repeat;
    z %= repeat;
  }
  const xi = Math.trunc(x) & 0xff;
  const yi = Math.trunc(y) & 0xff;
  const zi = Math.trunc(z) & 0xff;
  const xf = x - Math.trunc(x);
  const yf = y - Math.trunc(y);
  const zf = z - Math.trunc(z);
  const u = fade(xf);
  const v = fade(yf);
  const w = fade(zf);
  const hash = (dx: number, dy: number, dz: number) =>
    PERMUTATION_TABLE[(PERMUTATION_TABLE[(PERMUTATION_TABLE[dx] ?? 0) + dy] ?? 0) + dz] ?? 0;
  const x1 = increment(xi, repeat);
  const y1 = increment(yi, repeat);
  const z1 = increment(zi, repeat);
  const near = lerp(gradient(hash(xi, yi, zi), xf, yf, zf), gradient(hash(x1, yi, zi), xf - 1, yf, zf), u);
  const nearY = lerp(gradient(hash(xi, y1, zi), xf, yf - 1, zf), gradient(hash(x1, y1, zi), xf - 1, yf - 1, zf), u);
  const far = lerp(gradient(hash(xi, yi, z1), xf, yf, zf - 1), gradient(hash(x1, yi, z1), xf - 1, yf, zf - 1), u);
  const farY = lerp(
    gradient(hash(xi, y1, z1), xf, yf - 1, zf - 1),
    gradient(hash(x1, y1, z1), xf - 1, yf - 1, zf - 1),
    u,
  );
  return (lerp(lerp(near, nearY, v), lerp(far, farY, v), w) + 1) * 0.5;
}

function noiseAtlasData() {
  const data = new Uint8Array(ATLAS_SIZE * ATLAS_SIZE * 4);
  for (let z = 0; z < SIZE; z += 1) {
    for (let atlasLocalY = 0; atlasLocalY < PADDED_SIZE; atlasLocalY += 1) {
      for (let atlasLocalX = 0; atlasLocalX < PADDED_SIZE; atlasLocalX += 1) {
        const x = (atlasLocalX + SIZE - 1) % SIZE;
        const y = (atlasLocalY + SIZE - 1) % SIZE;
        const noise = perlin3d((6 * x) / SIZE, (6 * y) / SIZE, (6 * z) / SIZE, 6);
        const value = Math.round(Math.min(Math.max((noise - 0.5) * 1.8 + 0.5, 0), 1) * 255);
        const atlasX = (z % TILES) * PADDED_SIZE + atlasLocalX;
        const atlasY = Math.floor(z / TILES) * PADDED_SIZE + atlasLocalY;
        const offset = (atlasX + atlasY * ATLAS_SIZE) * 4;
        data.fill(value, offset, offset + 4);
      }
    }
  }
  return data;
}

let texture: DataTexture | undefined;

export function worldNoiseTexture() {
  if (texture !== undefined) return texture;
  texture = new DataTexture(noiseAtlasData(), ATLAS_SIZE, ATLAS_SIZE, RGBAFormat);
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}
