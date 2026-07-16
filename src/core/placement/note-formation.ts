import { songBpmTimeToSeconds } from '../beatmap/bpm';
import { NoteType, type Difficulty, type Note } from '../beatmap/types';

const rowTolerance = 0.001;
const noCutDirection = 9;

export interface NoteFormation {
  startLineIndex: number;
  startLineLayer: number;
  flipYSide: number;
}

export interface FormedNote {
  note: Note;
  time: number;
  formation: NoteFormation;
}

interface TimelineEntry {
  time: number;
  formed?: FormedNote;
}

function collectTimeBands<T>(items: T[], timeOf: (item: T) => number) {
  const sorted = [...items].sort((left, right) => timeOf(left) - timeOf(right));
  const bands: T[][] = [];
  let anchor = Number.NEGATIVE_INFINITY;

  for (const item of sorted) {
    const time = timeOf(item);
    let band = bands[bands.length - 1];
    if (band === undefined || time > anchor + rowTolerance) {
      band = [];
      bands.push(band);
      anchor = time;
    }
    band.push(item);
  }
  return bands;
}

function applyLayerRanks(entries: FormedNote[]) {
  const ordered = [...entries].sort(
    (left, right) => left.note.posX - right.note.posX || left.note.posY - right.note.posY,
  );
  let column = Number.NaN;
  let rank = 0;

  for (const entry of ordered) {
    if (entry.note.posX !== column) {
      column = entry.note.posX;
      rank = 0;
    }
    entry.formation.startLineLayer = rank;
    rank += 1;
  }
}

function sliderEndpointTimes(difficulty: Difficulty, songBpm: number) {
  return [...difficulty.arcs, ...difficulty.chains].flatMap((slider) => [
    songBpmTimeToSeconds(slider.songBpmTime, songBpm),
    songBpmTimeToSeconds(slider.tailSongBpmTime, songBpm),
  ]);
}

function isNearSlider(time: number, endpoints: number[]) {
  return endpoints.some((endpoint) => Math.abs(endpoint - time) < rowTolerance);
}

function setCrossedStart(entry: FormedNote, counterpart: FormedNote) {
  const xDifference = entry.note.posX - counterpart.note.posX;
  const yDifference = entry.note.posY - counterpart.note.posY;
  const laneSide = xDifference > 0 ? 1 : -1;
  entry.formation.startLineIndex = counterpart.note.posX;
  entry.formation.flipYSide = xDifference * yDifference < 0 ? -laneSide : laneSide;
}

export function buildNoteFormation(difficulty: Difficulty, songBpm: number) {
  const formedNotes: FormedNote[] = difficulty.notes.map((note) => ({
    note,
    time: songBpmTimeToSeconds(note.songBpmTime, songBpm),
    formation: { startLineIndex: note.posX, startLineLayer: note.posY, flipYSide: 0 },
  }));
  const movementTimeline: TimelineEntry[] = formedNotes.map((formed) => ({ time: formed.time, formed }));
  for (const slider of [...difficulty.arcs, ...difficulty.chains]) {
    movementTimeline.push({ time: songBpmTimeToSeconds(slider.songBpmTime, songBpm) });
  }

  for (const band of collectTimeBands(movementTimeline, (entry) => entry.time)) {
    applyLayerRanks(band.flatMap((entry) => (entry.formed === undefined ? [] : [entry.formed])));
  }

  const endpoints = sliderEndpointTimes(difficulty, songBpm);
  const colorNotes = formedNotes.filter(
    ({ note }) => (note.type === NoteType.Red || note.type === NoteType.Blue) && note.cutDirection !== noCutDirection,
  );
  for (const pair of collectTimeBands(colorNotes, (entry) => entry.time)) {
    const first = pair[0];
    const second = pair[1];
    if (
      pair.length !== 2 ||
      first === undefined ||
      second === undefined ||
      first.note.type === second.note.type ||
      isNearSlider(first.time, endpoints)
    ) {
      continue;
    }

    const red = first.note.type === NoteType.Red ? first : second;
    const blue = first.note.type === NoteType.Blue ? first : second;
    if (red.note.posX <= blue.note.posX) continue;
    setCrossedStart(red, blue);
    setCrossedStart(blue, red);
  }

  return formedNotes;
}
