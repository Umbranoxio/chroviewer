import {
  eulerFromQuaternion,
  quaternionFromEuler,
  sampleRotation,
  type PointSampleContext,
  type Vector3Tuple,
} from './point-definition';

interface SmoothState {
  songBpmTime: number;
  values: number[];
}

export class HeckBaseProviderRuntime implements PointSampleContext {
  private readonly smooth = new Map<string, SmoothState>();

  constructor(
    private readonly raw: (name: string, songBpmTime: number) => readonly number[] | undefined,
    private readonly secondsAt: (songBpmTime: number) => number,
  ) {}

  baseProvider(name: string, songBpmTime: number) {
    const [base = '', ...modifiers] = name.split('.');
    const values = this.raw(base, songBpmTime);
    if (values === undefined) return undefined;
    let result = [...values];
    let key = base;
    let rotation = base.endsWith('Rotation');
    for (const modifier of modifiers) {
      key += `.${modifier}`;
      if (modifier.startsWith('s')) {
        const multiplier = Number.parseFloat(modifier.slice(1).replace('_', '.'));
        if (!Number.isFinite(multiplier)) continue;
        result = this.smoothed(key, result, songBpmTime, multiplier, rotation);
        continue;
      }
      result = Array.from(modifier).map((component) => result['xyzw'.indexOf(component)] ?? 0);
      rotation = false;
    }
    return result;
  }

  reset() {
    this.smooth.clear();
  }

  private smoothed(key: string, source: readonly number[], songBpmTime: number, multiplier: number, rotation: boolean) {
    const state = this.smooth.get(key);
    if (state === undefined || songBpmTime < state.songBpmTime || state.values.length !== source.length) {
      const values = [...source];
      this.smooth.set(key, { songBpmTime, values });
      return values;
    }
    if (songBpmTime === state.songBpmTime) return state.values;
    const delta = this.secondsAt(songBpmTime) - this.secondsAt(state.songBpmTime);
    const amount = Math.min(Math.max(delta * multiplier, 0), 1);
    if (rotation && state.values.length === 3 && source.length === 3) {
      const previous: Vector3Tuple = [state.values[0] ?? 0, state.values[1] ?? 0, state.values[2] ?? 0];
      const next: Vector3Tuple = [source[0] ?? 0, source[1] ?? 0, source[2] ?? 0];
      const value = sampleRotation(
        [
          { value: quaternionFromEuler(previous), time: 0 },
          { value: quaternionFromEuler(next), time: 1 },
        ],
        amount,
      );
      state.values = value === undefined ? [...source] : [...eulerFromQuaternion(value)];
    } else {
      state.values = state.values.map((value, index) => value + ((source[index] ?? 0) - value) * amount);
    }
    state.songBpmTime = songBpmTime;
    return state.values;
  }
}
