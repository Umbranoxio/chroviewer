import type { EventBox, EventBoxGroup } from '../beatmap/types';
import {
  beatDistributionStep,
  convertIndexFilter,
  valueDistributionOffset,
  type ConvertedIndexFilter,
  type FilterEntry,
} from './gls-distribution';

export interface ExpandedGlsEvent<T, B = EventBox<T>> {
  element: number;
  axis: number;
  jsonTime: number;
  distributionOffset: number;
  event: T;
  box: B;
}

interface GroupState<T, B extends EventBox<T>> {
  group: EventBoxGroup<B>;
  box: B;
  filter: ConvertedIndexFilter;
  entry: FilterEntry;
  axis: number;
  localJsonTime: number;
}

export function expandGlsEvents<T extends { relativeJsonTime: number }, B extends EventBox<T>>(
  groups: EventBoxGroup<B>[],
  groupSize: number,
  axisForBox: (box: B) => number = () => 0,
): ExpandedGlsEvent<T, B>[] {
  const states = new Map<string, GroupState<T, B>[]>();
  for (const group of groups) {
    const taken = new Set<string>();
    for (const box of group.boxes) {
      if (box.events.length === 0) continue;
      const filter = convertIndexFilter(box.indexFilter, groupSize);
      if (filter === null) continue;
      const lastEvent = box.events[box.events.length - 1];
      if (lastEvent === undefined) continue;
      const beatStep = beatDistributionStep(
        filter,
        box.beatDistributionType,
        box.beatDistribution,
        lastEvent.relativeJsonTime,
      );
      const axis = axisForBox(box);
      for (const entry of filter.entries) {
        const key = `${String(axis)}:${String(entry.element)}`;
        if (taken.has(key)) continue;
        taken.add(key);
        const state = {
          group,
          box,
          filter,
          entry,
          axis,
          localJsonTime: group.jsonTime + beatStep * entry.durationOrder,
        };
        const targetStates = states.get(key);
        if (targetStates === undefined) states.set(key, [state]);
        else targetStates.push(state);
      }
    }
  }

  const expanded: ExpandedGlsEvent<T, B>[] = [];
  for (const targetStates of states.values()) {
    targetStates.sort((a, b) => a.localJsonTime - b.localJsonTime);
    targetStates.forEach((state, stateIndex) => {
      const nextTime = targetStates[stateIndex + 1]?.localJsonTime ?? Number.POSITIVE_INFINITY;
      const beatStep = state.localJsonTime - state.group.jsonTime;
      const offset = valueDistributionOffset(
        state.filter,
        state.entry.distributionOrder,
        state.box.distributionType,
        state.box.distribution,
        state.box.easing,
      );
      state.box.events.forEach((event, eventIndex) => {
        const jsonTime = state.group.jsonTime + event.relativeJsonTime + beatStep;
        if (jsonTime > nextTime) return;
        expanded.push({
          element: state.entry.element,
          axis: state.axis,
          jsonTime,
          distributionOffset: eventIndex === 0 && state.box.affectFirst !== 1 ? 0 : offset,
          event,
          box: state.box,
        });
      });
    });
  }
  return expanded.sort((a, b) => a.jsonTime - b.jsonTime);
}
