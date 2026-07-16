export interface FogParams {
  autoExposureLimit: number;
  offset: number;
  height: number;
  startY: number;
  attenuation: number;
}

export const GAME_FOG_PARAMS: FogParams = {
  autoExposureLimit: 1000,
  offset: 0,
  height: 10,
  startY: -300,
  attenuation: 0.002,
};

export const LIGHT_EMISSIVE_FOG_MIN = 0.06;
export const LIGHT_EMISSIVE_FOG_FULL = 0.35;
