import type { WatchPartyMap } from '../live/generated/proto/scoresaber/live/v1/watch_party_pb';
import type { DifficultyRow } from '../viewer/viewer-types';

export function isWatchPartyBeatSaverId(input: string) {
  return /^[0-9a-f]{1,16}$/i.test(input.trim());
}

export function selectWatchPartySetRow(rows: DifficultyRow[]) {
  return (
    rows.find((row) => row.difficulty !== undefined && row.infoDifficulty?.characteristic === 'Standard') ??
    rows.find((row) => row.difficulty !== undefined && row.infoDifficulty !== undefined)
  );
}

export function watchPartyMapKey(map: WatchPartyMap) {
  return [map.hash.toLowerCase(), map.characteristic.toLowerCase(), normalizeWatchPartyDifficulty(map.difficulty)].join(
    ':',
  );
}

export function selectAuthoritativeWatchPartyRow(rows: DifficultyRow[], map: WatchPartyMap) {
  const characteristic = map.characteristic.toLowerCase();
  const difficulty = normalizeWatchPartyDifficulty(map.difficulty);
  return rows.find(
    (row) =>
      row.difficulty !== undefined &&
      row.infoDifficulty?.characteristic.toLowerCase() === characteristic &&
      normalizeWatchPartyDifficulty(row.infoDifficulty.difficulty) === difficulty,
  );
}

export function normalizeWatchPartyDifficulty(value: string) {
  return value.toLowerCase().replace('+', 'plus');
}
