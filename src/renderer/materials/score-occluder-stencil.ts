import { AlwaysStencilFunc, KeepStencilOp, type Material, NotEqualStencilFunc, ReplaceStencilOp } from 'three';

const SCORE_OCCLUDER_BIT = 0x20;

// Environment stencil materials use the other bits, so they neither see nor overwrite score occluder marks.
export const ENVIRONMENT_STENCIL_MASK = 0xff & ~SCORE_OCCLUDER_BIT;

export function writeScoreOccluderStencil<T extends Material>(material: T) {
  material.stencilWrite = true;
  material.stencilRef = SCORE_OCCLUDER_BIT;
  material.stencilWriteMask = SCORE_OCCLUDER_BIT;
  material.stencilFuncMask = SCORE_OCCLUDER_BIT;
  material.stencilFunc = AlwaysStencilFunc;
  material.stencilFail = KeepStencilOp;
  material.stencilZFail = KeepStencilOp;
  material.stencilZPass = ReplaceStencilOp;
  return material;
}

export function hideBehindScoreOccluders<T extends Material>(material: T) {
  material.stencilWrite = true;
  material.stencilRef = SCORE_OCCLUDER_BIT;
  material.stencilWriteMask = 0;
  material.stencilFuncMask = SCORE_OCCLUDER_BIT;
  material.stencilFunc = NotEqualStencilFunc;
  material.stencilFail = KeepStencilOp;
  material.stencilZFail = KeepStencilOp;
  material.stencilZPass = KeepStencilOp;
  return material;
}
