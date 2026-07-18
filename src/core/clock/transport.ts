export interface TransportState {
  playing: boolean;
  rate: number;
  anchorNow: number;
  anchorSongTime: number;
  start: number;
  end: number;
}

export function createTransport(): TransportState {
  return { playing: false, rate: 1, anchorNow: 0, anchorSongTime: 0, start: 0, end: 0 };
}

export function songTimeAt(state: TransportState, now: number): number {
  return state.playing ? state.anchorSongTime + (now - state.anchorNow) * state.rate : state.anchorSongTime;
}

export function transportPlay(state: TransportState, now: number): TransportState {
  return state.playing ? state : { ...state, playing: true, anchorNow: now };
}

export function transportPause(state: TransportState, now: number): TransportState {
  return state.playing ? { ...state, playing: false, anchorSongTime: songTimeAt(state, now) } : state;
}

export function transportSeek(state: TransportState, now: number, songTime: number): TransportState {
  return { ...state, anchorNow: now, anchorSongTime: songTime };
}

export function transportSetRate(state: TransportState, now: number, rate: number): TransportState {
  return { ...state, rate, anchorNow: now, anchorSongTime: songTimeAt(state, now) };
}
