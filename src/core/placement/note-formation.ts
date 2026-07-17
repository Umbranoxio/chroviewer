import { songBpmTimeToSeconds } from '../beatmap/bpm';
import { NoteType, type Difficulty, type Note } from '../beatmap/types';
import { beatSaberNumberSchema } from '../beatmap/value-schema';
import { cutDirectionEuler, directionalize, gridPosition, LANE_SIZE } from './grid';

const rowTolerance = 0.001;
const noCutDirection = 9;

export interface NoteFormation {
  startLineIndex: number;
  startLineLayer: number;
  flipYSide: number;
  rotationDeg: number;
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

function noteRotation(note: Note, majorVersion: number) {
  if (majorVersion === 2 && note.customData?._cutDirection !== undefined) {
    return beatSaberNumberSchema.parse(note.customData._cutDirection);
  }
  return directionalize(note.cutDirection, note.angleOffset);
}

function notePosition(note: Note) {
  const position = gridPosition(note.posX, note.posY);
  const coordinates = note.customData?._position ?? note.customData?.coordinates;
  if (!Array.isArray(coordinates)) return position;
  const x = beatSaberNumberSchema.safeParse(coordinates[0]);
  const y = beatSaberNumberSchema.safeParse(coordinates[1]);
  return {
    x: x.success ? (x.data + 0.5) * LANE_SIZE : position.x,
    y: y.success ? y.data * LANE_SIZE : position.y,
  };
}

function applyWindowRotations(formedNotes: FormedNote[], majorVersion: number) {
  for (const color of [NoteType.Red, NoteType.Blue]) {
    const colorNotes = formedNotes.filter(({ note }) => !note.customFake && note.type === color);
    for (const pair of collectTimeBands(colorNotes, (entry) => entry.note.jsonTime)) {
      if (pair.length !== 2) continue;
      const first = pair[0];
      const second = pair[1];
      if (first === undefined || second === undefined) continue;

      const firstDirection = first.note.cutDirection;
      const secondDirection = second.note.cutDirection;
      const hasPrecisionDirection =
        firstDirection >= 1000 || firstDirection <= -1000 || secondDirection >= 1000 || secondDirection <= -1000;
      const firstCoordinates = first.note.customData?._position ?? first.note.customData?.coordinates;
      const secondCoordinates = second.note.customData?._position ?? second.note.customData?.coordinates;
      if (
        firstDirection !== secondDirection &&
        firstDirection !== 8 &&
        secondDirection !== 8 &&
        !hasPrecisionDirection &&
        !Array.isArray(firstCoordinates) &&
        !Array.isArray(secondCoordinates)
      ) {
        continue;
      }

      const [guide, companion] = firstDirection === 8 ? [second, first] : [first, second];
      const guidePosition = notePosition(guide.note);
      const companionPosition = notePosition(companion.note);
      const lineAngle =
        (Math.atan2(guidePosition.y - companionPosition.y, guidePosition.x - companionPosition.x) * 180) / Math.PI;
      const cutAxisAngle = guide.note.cutDirection === 8 ? 90 : cutDirectionEuler(guide.note.cutDirection) - 90;
      const windowAngle = ((((lineAngle - cutAxisAngle + 90) % 180) + 180) % 180) - 90;

      if (guide.note.cutDirection === 8 && companion.note.cutDirection === 8) {
        guide.formation.rotationDeg = windowAngle;
        companion.formation.rotationDeg = windowAngle;
      } else if (Math.abs(windowAngle) <= 40) {
        guide.formation.rotationDeg = noteRotation(guide.note, majorVersion) - guide.note.angleOffset + windowAngle;
        const diagonalDot =
          companion.note.cutDirection === 8 && (guide.note.cutDirection < 0 || guide.note.cutDirection > 3);
        companion.formation.rotationDeg =
          noteRotation(companion.note, majorVersion) -
          companion.note.angleOffset +
          windowAngle +
          (diagonalDot ? 45 : 0);
      }
    }
  }
}

export function buildNoteFormation(difficulty: Difficulty, songBpm: number) {
  const majorVersion = Number.parseInt(difficulty.version, 10);
  const formedNotes: FormedNote[] = difficulty.notes.map((note) => ({
    note,
    time: songBpmTimeToSeconds(note.songBpmTime, songBpm),
    formation: {
      startLineIndex: note.posX,
      startLineLayer: note.posY,
      flipYSide: 0,
      rotationDeg: noteRotation(note, majorVersion),
    },
  }));
  const movementTimeline: TimelineEntry[] = formedNotes.map((formed) => ({ time: formed.time, formed }));
  for (const slider of [...difficulty.arcs, ...difficulty.chains]) {
    movementTimeline.push({ time: songBpmTimeToSeconds(slider.songBpmTime, songBpm) });
  }

  for (const band of collectTimeBands(movementTimeline, (entry) => entry.time)) {
    applyLayerRanks(band.flatMap((entry) => (entry.formed === undefined ? [] : [entry.formed])));
  }
  applyWindowRotations(formedNotes, majorVersion);

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
