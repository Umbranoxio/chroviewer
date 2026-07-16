import type { Chain } from '../beatmap/types';
import { cutDirectionEuler, gridPosition } from './grid';

export interface ChainLink {
  x: number;
  y: number;
  t: number;
  rotationDeg: number;
}

const degToRad = Math.PI / 180;
const radToDeg = 180 / Math.PI;

const signedAngleFromDown = (x: number, y: number) => Math.atan2(x, -y) * radToDeg;

export function chainLinks(chain: Chain): ChainLink[] {
  const head = gridPosition(chain.posX, chain.posY);
  const tail = gridPosition(chain.tailPosX, chain.tailPosY);
  const tailRel = { x: tail.x - head.x, y: tail.y - head.y };

  const headEuler = cutDirectionEuler(chain.cutDirection);
  const zRads = degToRad * headEuler;
  const headDirection = { x: Math.sin(zRads), y: -Math.cos(zRads) };

  const interMult = Math.hypot(tailRel.x, tailRel.y) / 2;
  const interPoint = { x: headDirection.x * interMult, y: headDirection.y * interMult };

  const path = { x: tailRel.x + 1.5, y: tailRel.y };
  const headPointsToTail = Math.abs(signedAngleFromDown(path.x, path.y) - headEuler) < 0.01;

  const gameSquish = chain.squish < 0.001 ? 1 : chain.squish;
  const n = chain.sliceCount - 1;

  const links: ChainLink[] = [];
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    const tSquish = t * gameSquish;

    if (headPointsToTail) {
      links.push({ x: tailRel.x * tSquish, y: tailRel.y * tSquish, t, rotationDeg: headEuler });
    } else {
      const u = 1 - tSquish;
      const x = 2 * u * tSquish * interPoint.x + tSquish * tSquish * tailRel.x;
      const y = 2 * u * tSquish * interPoint.y + tSquish * tSquish * tailRel.y;
      const dx = 2 * u * interPoint.x + 2 * tSquish * (tailRel.x - interPoint.x);
      const dy = 2 * u * interPoint.y + 2 * tSquish * (tailRel.y - interPoint.y);
      links.push({ x, y, t, rotationDeg: 90 + Math.atan2(dy, dx) * radToDeg });
    }
  }

  return links;
}
