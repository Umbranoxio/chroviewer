import { CubeTexture, DataTexture, RGBAFormat, SRGBColorSpace } from 'three';

const SIZE = 64;
const AMBIENT = 0.413373;
const SHARPNESS = 36;
const WEIGHTS = new Float64Array([
  -0.120359, -0.212779, 0.216416, 0.014717, -0.345155, -0.303347, 0.12347, 0.051956, -0.351459, 0.512714, -0.390895,
  -0.334204, -0.104837, 0.532789, -0.507393, -0.146037, 0.016789, -0.146423, 0.54633, 0.204202, -0.398798, -0.179359,
  0.110967, 0.284367, 0.492313, 0.270396, -0.643415, -0.032007, 0.15666, -0.394332, -0.610698, -0.987238, -0.379035,
  0.202217, -0.484096, -0.240792, -0.443087, 0.571539, -0.510763, 0.942351, -0.166705, -0.099989, 1.167008, 0.235898,
  0.573406, 0.360982, 0.300876, 0.29868, 0.07493, -0.130845, 0.233643, 0.858657, -0.320344, 0.534522, 0.130727,
  -0.427199, -0.69807, -0.156433, -0.46722, -0.566215, -0.769108, 0.612567, 0.358619, -0.273959, -0.416452, 0.099788,
  -0.547193, -0.580336, 0.069249, 1.049067, 0.613877, -0.390491, 0.664949, 0.770099, -0.932636, -0.204845, 0.648757,
  0.274461, -0.481616, 0.099034, 0.3698, 0.286012, -1.26406, -1.054425, 0.400953, -0.56686, -0.378825, 0.299245,
  0.130587, -0.224661, -0.55568, 0.094599, 0.630096, -0.319858, -0.781028, 0.714333, 0.611359, -0.554732, -0.072863,
  0.169146, 0.342127, 0.286802, -0.483455, 0.172477, 0.595802, -0.238695, -0.103427, 0.193349, 0.235437, 0.045081,
  0.164577, -0.162771, 0.324634, -0.278089, -0.102137, 0.23849, 0.474806, -0.038462, 0.307076, 0.151498, 0.341714,
  -0.470387, -0.152355, 0.359081, 0.471887, -0.2451, 0.051753, 0.311008, 0.534168, -0.909735, -0.217823, 0.087887,
  0.451669, -0.360106, -0.008281, 0.039871, 0.278093, -0.150069, 0.008227, 0.194186, 0.106659, -0.544044, 0.721572,
  0.328676, -0.15247, -0.238691, 0.522558, -0.101075, 0.00277, -0.374025, 1.179301, 0.513164, -0.439885, -0.018163,
  0.523901, -0.027352, 0.203403, -0.336552, -0.110696, 0.1841, 0.128455, -0.15622, 0.438423, -0.365259, 0.021774,
  0.3613, -0.440055, -0.57376, 0.509923, -0.065228, -0.238348, -0.828984, -0.558537, 0.083312, -0.548813, -0.214584,
  0.136854, -0.39239, 0.360858, 0.701823, 0.579652, -0.102383, -0.058924, -0.363517, 0.058927, 0.195883, 0.41886,
  0.333778, -0.057378, -0.20762, -0.064634, 0.317427, 0.180563, -0.300464, 0.065236, 0.344262, 0.319836, -0.245216,
  -0.026658, -0.328135, -1.185681, -0.079192, -0.317793, -0.532315, -0.078332, -0.242453, 0.459962, -0.101017,
  -0.199025, -0.32874, -0.198373, 0.339457, 0.562534, 0.416825, -0.344397, 0.993446, 0.34728, 0.488895, -0.095694,
  -0.506467, 0.706965, 0.9232, 0.537545, -0.332881, 0.053277, -0.62793, 0.961659, 0.248078, -0.290023, -0.30402,
  -0.720698, 0.712095, 0.385183, 0.04284, -0.810732, -0.430514, 0.12543, -0.268766, 0.883186, -0.821591, -0.586105,
  -0.315998, -0.15584, -0.058728, -0.13733, -0.181979, -0.161907, 0.415992, 0.561601, -0.171864, 0.235507, -0.434118,
  -0.091373, -0.256457, 0.193219, -0.266878,
]);

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const TERMS = Array.from(WEIGHTS, (weight, index) => {
  const y = 1 - (2 * (index + 0.5)) / WEIGHTS.length;
  const radius = Math.sqrt(1 - y * y);
  const angle = index * GOLDEN_ANGLE;
  return { x: Math.cos(angle) * radius, y, z: Math.sin(angle) * radius, weight };
});

function reflectionValue(x: number, y: number, z: number) {
  let value = AMBIENT;
  for (const term of TERMS) {
    const dot = x * term.x + y * term.y + z * term.z;
    value += term.weight * Math.exp(SHARPNESS * (dot - 1));
  }
  return Math.min(Math.max(value, 24 / 255), 1);
}

function faceDirection(face: number, u: number, v: number) {
  switch (face) {
    case 0:
      return [1, -v, -u] as const;
    case 1:
      return [-1, -v, u] as const;
    case 2:
      return [u, 1, v] as const;
    case 3:
      return [u, -1, -v] as const;
    case 4:
      return [u, -v, 1] as const;
    default:
      return [-u, -v, -1] as const;
  }
}

function createFace(face: number) {
  const data = new Uint8Array(SIZE * SIZE * 4);
  for (let y = 0; y < SIZE; y++) {
    const v = ((y + 0.5) / SIZE) * 2 - 1;
    for (let x = 0; x < SIZE; x++) {
      const u = ((x + 0.5) / SIZE) * 2 - 1;
      const direction = faceDirection(face, u, v);
      const inverseLength = 1 / Math.hypot(...direction);
      const value = Math.round(
        reflectionValue(direction[0] * inverseLength, direction[1] * inverseLength, direction[2] * inverseLength) * 255,
      );
      const offset = (y * SIZE + x) * 4;
      data[offset] = value;
      data[offset + 1] = value;
      data[offset + 2] = value;
      data[offset + 3] = 255;
    }
  }
  return new DataTexture(data, SIZE, SIZE, RGBAFormat);
}

export function createNoteReflection() {
  const reflection = new CubeTexture<DataTexture>(Array.from({ length: 6 }, (_, face) => createFace(face)));
  reflection.name = 'NoteReflection';
  reflection.colorSpace = SRGBColorSpace;
  reflection.generateMipmaps = true;
  reflection.needsUpdate = true;
  return reflection;
}
