import type { BasicEvent } from '../../core/beatmap/types';
import { customLightIds } from '../../core/lighting/basic-light';
import type { MapRenderData } from '../../core/placement/map-render-data';
import type { EnvironmentLightBinding, LoadedEnvironment } from '../environment/environment-runtime';

interface LightBindingRoute {
  eventType: number;
  targetedEvents: BasicEvent[];
  hash: number;
}

interface EnvironmentLightEventCache {
  byType: Map<number, MapRenderData['lightEvents']>;
  byBinding: Map<EnvironmentLightBinding, MapRenderData['lightEvents']>;
  byBindingKey: Map<string, MapRenderData['lightEvents']>;
}

const EVENT_SEQUENCE_HASH_OFFSET = 2_166_136_261;
const EVENT_SEQUENCE_HASH_PRIME = 16_777_619;

export function lightBindingKey(binding: EnvironmentLightBinding) {
  const remap = binding.lightIdRemap.map(([source, target]) => `${String(source)}:${String(target)}`).join(',');
  return `${String(binding.eventType)}|${String(binding.lightId)}|${remap}`;
}

function sameEventSequence(left: MapRenderData['lightEvents'], right: MapRenderData['lightEvents']) {
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index++) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}

function mergeEventSequences(
  untargeted: MapRenderData['lightEvents'],
  targeted: MapRenderData['lightEvents'],
  eventOrder: ReadonlyMap<BasicEvent, number>,
) {
  if (untargeted.length === 0) return targeted;
  if (targeted.length === 0) return untargeted;
  const events: BasicEvent[] = [];
  const targetedEvents = targeted.values();
  let nextTargeted = targetedEvents.next();
  for (const untargetedEvent of untargeted) {
    while (
      !nextTargeted.done &&
      (eventOrder.get(nextTargeted.value) ?? Number.POSITIVE_INFINITY) <
        (eventOrder.get(untargetedEvent) ?? Number.POSITIVE_INFINITY)
    ) {
      events.push(nextTargeted.value);
      nextTargeted = targetedEvents.next();
    }
    events.push(untargetedEvent);
  }
  while (!nextTargeted.done) {
    events.push(nextTargeted.value);
    nextTargeted = targetedEvents.next();
  }
  return events;
}

export function rebuildEnvironmentLightEventCache(
  data: MapRenderData | null,
  environment: LoadedEnvironment | null,
  cache: EnvironmentLightEventCache,
) {
  cache.byType.clear();
  cache.byBinding.clear();
  cache.byBindingKey.clear();

  const bindingKeysByTypeAndSource = new Map<number, Map<number, Set<string>>>();
  const routesByBindingKey = new Map<string, LightBindingRoute>();

  function registerBinding(binding: EnvironmentLightBinding) {
    const key = lightBindingKey(binding);
    let route = routesByBindingKey.get(key);
    if (route === undefined) {
      route = { eventType: binding.eventType, targetedEvents: [], hash: EVENT_SEQUENCE_HASH_OFFSET };
      routesByBindingKey.set(key, route);
      const firstRemaps = new Map<number, number>();
      for (const [source, target] of binding.lightIdRemap) {
        if (!firstRemaps.has(source)) firstRemaps.set(source, target);
      }
      const sourceIds = new Set<number>();
      if (!firstRemaps.has(binding.lightId)) sourceIds.add(binding.lightId);
      for (const [source, target] of firstRemaps) {
        if (target === binding.lightId) sourceIds.add(source);
      }

      let keysBySource = bindingKeysByTypeAndSource.get(binding.eventType);
      if (keysBySource === undefined) {
        keysBySource = new Map();
        bindingKeysByTypeAndSource.set(binding.eventType, keysBySource);
      }
      for (const sourceId of sourceIds) {
        const sourceKeys = keysBySource.get(sourceId);
        if (sourceKeys === undefined) keysBySource.set(sourceId, new Set([key]));
        else sourceKeys.add(key);
      }
    }
    cache.byBinding.set(binding, route.targetedEvents);
  }

  function appendEvent(key: string, event: BasicEvent, eventIndex: number) {
    const route = routesByBindingKey.get(key);
    if (route === undefined) return;
    route.targetedEvents.push(event);
    route.hash = Math.imul(route.hash ^ (eventIndex + 1), EVENT_SEQUENCE_HASH_PRIME) >>> 0;
  }

  if (environment !== null) {
    for (const segment of environment.lightSegments) {
      for (const binding of segment.bindings) registerBinding(binding);
    }
    for (const light of environment.materialLights) {
      for (const binding of light.bindings) registerBinding(binding);
    }
    for (const light of environment.directionalLights) {
      for (const input of light.inputs) registerBinding(input.binding);
    }
  }

  const routedKeys = new Set<string>();
  const lightEvents = data?.lightEvents ?? [];
  const eventOrder = new Map<BasicEvent, number>();
  const untargetedEventsByType = new Map<number, BasicEvent[]>();
  for (const [eventIndex, event] of lightEvents.entries()) {
    eventOrder.set(event, eventIndex);
    const events = cache.byType.get(event.type);
    if (events === undefined) cache.byType.set(event.type, [event]);
    else events.push(event);

    const ids = customLightIds(event);
    if (ids === undefined) {
      const untargeted = untargetedEventsByType.get(event.type);
      if (untargeted === undefined) untargetedEventsByType.set(event.type, [event]);
      else untargeted.push(event);
      continue;
    }

    routedKeys.clear();
    const keysBySource = bindingKeysByTypeAndSource.get(event.type);
    if (keysBySource === undefined) continue;
    for (const id of ids) {
      for (const key of keysBySource.get(id) ?? []) routedKeys.add(key);
    }
    for (const key of routedKeys) appendEvent(key, event, eventIndex);
  }

  const canonicalTargetsByFingerprint = new Map<string, MapRenderData['lightEvents'][]>();
  const finalEventsByCanonicalTarget = new Map<MapRenderData['lightEvents'], MapRenderData['lightEvents']>();
  for (const [key, route] of routesByBindingKey) {
    const fingerprint = `${String(route.eventType)}:${String(route.targetedEvents.length)}:${String(route.hash)}`;
    const candidates = canonicalTargetsByFingerprint.get(fingerprint);
    let canonicalTarget = candidates?.find((candidate) => sameEventSequence(candidate, route.targetedEvents));
    if (canonicalTarget === undefined) {
      canonicalTarget = route.targetedEvents;
      if (candidates === undefined) canonicalTargetsByFingerprint.set(fingerprint, [canonicalTarget]);
      else candidates.push(canonicalTarget);
    }
    let events = finalEventsByCanonicalTarget.get(canonicalTarget);
    if (events === undefined) {
      events = mergeEventSequences(untargetedEventsByType.get(route.eventType) ?? [], canonicalTarget, eventOrder);
      finalEventsByCanonicalTarget.set(canonicalTarget, events);
    }
    cache.byBindingKey.set(key, events);
  }
  for (const binding of cache.byBinding.keys()) {
    const events = cache.byBindingKey.get(lightBindingKey(binding));
    if (events !== undefined) cache.byBinding.set(binding, events);
  }
}
