import { Quaternion, Vector3, type Object3D } from 'three';

import type {
  EventBox,
  FloatFxEvent,
  LightRotationEvent,
  LightTransformEventBox,
  LightTranslationEvent,
} from '../../core/beatmap/types';
import { expandGlsEvents } from '../../core/lighting/gls-events';
import {
  floatFxTween,
  glsRotationTween,
  sampleGlsFloat,
  sampleGlsRotationTween,
  translationTween,
} from '../../core/lighting/gls-sampling';
import {
  createLightPairRotationSampler,
  createLightRotationSampler,
  deterministicRotationRandom,
} from '../../core/lighting/light-rotation';
import {
  createRingPositionSampler,
  createRingRotationSampler,
  deterministicRingRandom,
} from '../../core/lighting/ring-motion';
import type { MapRenderData } from '../../core/placement/map-render-data';
import type {
  EnvironmentGlsFxTarget,
  EnvironmentGlsTransformEntry,
  LoadedEnvironment,
} from '../environment/environment-runtime';

interface GlsRotationRuntime {
  entry: EnvironmentGlsTransformEntry;
  tween: ReturnType<typeof glsRotationTween>;
  initial: { target: Object3D; value: Quaternion }[];
}

interface GlsTranslationRuntime {
  entry: EnvironmentGlsTransformEntry;
  tween: ReturnType<typeof translationTween>;
  initial: { target: Object3D; value: Vector3 }[];
}

interface GlsFxRuntime {
  targets: EnvironmentGlsFxTarget[];
  tween: ReturnType<typeof floatFxTween>;
  trigger: boolean;
}

interface RingRuntime {
  group: LoadedEnvironment['ringGroups'][number];
  fullRotation?: ReturnType<typeof createRingRotationSampler>;
  restingRotation?: ReturnType<typeof createRingRotationSampler>;
  fullPosition?: ReturnType<typeof createRingPositionSampler>;
  restingPosition?: ReturnType<typeof createRingPositionSampler>;
}

interface RotationRuntime {
  rotation: LoadedEnvironment['rotations'][number];
  full: (beat: number) => number;
  resting: (beat: number) => number;
}

const zAxis = new Vector3(0, 0, 1);
const degToRad = Math.PI / 180;

export class EnvironmentTransformRuntime {
  private readonly rotationQuaternion = new Quaternion();
  private readonly rotationAxis = new Vector3();
  private glsRotationRuntime: GlsRotationRuntime[] = [];
  private glsTranslationRuntime: GlsTranslationRuntime[] = [];
  private glsFxRuntime: GlsFxRuntime[] = [];
  private ringRuntime: RingRuntime[] = [];
  private rotationRuntime: RotationRuntime[] = [];

  rebuild(
    environment: LoadedEnvironment,
    data: MapRenderData,
    jsonTimeToSongBpmTime: (jsonTime: number) => number,
    eventsForType: (eventType: number) => MapRenderData['lightEvents'],
  ) {
    this.ringRuntime = environment.ringGroups.map((group) => {
      const runtime: RingRuntime = { group };
      if (group.rotationConfig !== undefined && group.rotationEventType !== undefined) {
        const random = deterministicRingRandom(group.seed);
        runtime.fullRotation = createRingRotationSampler(
          eventsForType(group.rotationEventType),
          data.songBpm,
          group.initialRotations,
          group.rotationConfig,
          random,
        );
        runtime.restingRotation = createRingRotationSampler(
          [],
          data.songBpm,
          group.initialRotations,
          group.rotationConfig,
          random,
        );
      }
      if (group.positionConfig !== undefined && group.positionEventType !== undefined) {
        runtime.fullPosition = createRingPositionSampler(
          eventsForType(group.positionEventType),
          data.songBpm,
          group.positionConfig,
        );
        runtime.restingPosition = createRingPositionSampler([], data.songBpm, group.positionConfig);
      }
      return runtime;
    });
    this.rotationRuntime = environment.rotations.map((rotation) => {
      const random = deterministicRotationRandom(rotation.seed);
      function create(source: MapRenderData['lightEvents']) {
        return rotation.pair === undefined
          ? createLightRotationSampler(source, data.songBpm, rotation.speedMultiplier, random)
          : createLightPairRotationSampler(
              source,
              data.songBpm,
              rotation.pair.mirrored,
              rotation.pair.startAngle,
              random,
            );
      }
      return {
        rotation,
        full: create(eventsForType(rotation.eventType)),
        resting: create([]),
      };
    });

    this.glsRotationRuntime = [];
    for (const environmentGroup of environment.glsRotationGroups) {
      const groups = data.lightRotationEventBoxGroups.filter((group) => group.id === environmentGroup.groupId);
      const expanded = expandGlsEvents<LightRotationEvent, LightTransformEventBox<LightRotationEvent>>(
        groups,
        environmentGroup.count,
        (box) => box.axis,
      );
      for (const entry of environmentGroup.entries) {
        this.glsRotationRuntime.push({
          entry,
          tween: glsRotationTween(
            expanded.filter((event) => event.element === entry.id && event.axis === entry.axis),
            jsonTimeToSongBpmTime,
          ),
          initial: entry.targets.map((target) => ({ target, value: target.quaternion.clone() })),
        });
      }
    }

    this.glsTranslationRuntime = [];
    for (const environmentGroup of environment.glsTranslationGroups) {
      const groups = data.lightTranslationEventBoxGroups.filter((group) => group.id === environmentGroup.groupId);
      const expanded = expandGlsEvents<LightTranslationEvent, LightTransformEventBox<LightTranslationEvent>>(
        groups,
        environmentGroup.count,
        (box) => box.axis,
      );
      for (const entry of environmentGroup.entries) {
        const events = expanded.filter((event) => event.element === entry.id && event.axis === entry.axis);
        const limits = environmentGroup.translationLimits[entry.axis] ?? [0, 0];
        const distributionLimits = environmentGroup.distributionLimits[entry.axis] ?? [0, 0];
        this.glsTranslationRuntime.push({
          entry,
          tween: translationTween(events, jsonTimeToSongBpmTime, limits, distributionLimits, entry.mirrored),
          initial: entry.targets.map((target) => ({ target, value: target.position.clone() })),
        });
      }
    }

    this.glsFxRuntime = [];
    for (const environmentGroup of environment.glsFxGroups) {
      const groups = data.fxEventBoxGroups.filter((group) => group.id === environmentGroup.groupId);
      const expanded = expandGlsEvents<FloatFxEvent, EventBox<FloatFxEvent>>(groups, environmentGroup.count);
      for (const entry of environmentGroup.entries) {
        const events = expanded.filter((event) => event.element === entry.id);
        this.glsFxRuntime.push({
          targets: entry.targets,
          tween: floatFxTween(events, jsonTimeToSongBpmTime),
          trigger: environmentGroup.trigger,
        });
      }
    }
  }

  clear() {
    this.glsRotationRuntime = [];
    this.glsTranslationRuntime = [];
    this.glsFxRuntime = [];
    this.ringRuntime = [];
    this.rotationRuntime = [];
  }

  update(beat: number, full: boolean) {
    for (const runtime of this.rotationRuntime) {
      const rotation = runtime.rotation;
      const angle = (full ? runtime.full : runtime.resting)(beat);
      this.rotationAxis.fromArray(rotation.axis).normalize();
      this.rotationQuaternion.setFromAxisAngle(this.rotationAxis, angle * degToRad);
      rotation.target.quaternion.fromArray(rotation.startRotation).multiply(this.rotationQuaternion);
    }
    for (const runtime of this.ringRuntime) {
      const group = runtime.group;
      const rotationSampler = full ? runtime.fullRotation : runtime.restingRotation;
      if (rotationSampler !== undefined) {
        const rotations = rotationSampler(beat);
        group.rings.forEach((ring, index) => {
          ring.target.quaternion.setFromAxisAngle(zAxis, (rotations[index] ?? 0) * degToRad);
        });
      }
      const positionSampler = full ? runtime.fullPosition : runtime.restingPosition;
      if (positionSampler !== undefined) {
        const positions = positionSampler(beat);
        group.rings.forEach((ring, index) => {
          ring.target.position.set(
            ring.positionOffset[0],
            ring.positionOffset[1],
            -(positions[index] ?? ring.positionOffset[2]),
          );
        });
      }
    }
    for (const runtime of this.glsRotationRuntime) {
      const firstEventTime = runtime.tween[0]?.time;
      if (!full || firstEventTime === undefined || beat < firstEventTime) {
        for (const { target, value } of runtime.initial) target.quaternion.copy(value);
        continue;
      }
      let angle = sampleGlsRotationTween(runtime.tween, beat);
      if (runtime.entry.mirrored) angle *= -1;
      const axis = runtime.entry.axis;
      this.rotationAxis.set(axis === 0 ? -1 : 0, axis === 1 ? -1 : 0, axis === 2 ? 1 : 0);
      this.rotationQuaternion.setFromAxisAngle(this.rotationAxis, angle * degToRad);
      for (const target of runtime.entry.targets) target.quaternion.copy(this.rotationQuaternion);
    }
    for (const runtime of this.glsTranslationRuntime) {
      const firstEventTime = runtime.tween[0]?.time;
      if (!full || firstEventTime === undefined || beat < firstEventTime) {
        for (const { target, value } of runtime.initial) target.position.copy(value);
        continue;
      }
      const value = sampleGlsFloat(runtime.tween, beat);
      for (const target of runtime.entry.targets) {
        if (runtime.entry.axis === 0) target.position.x = value;
        else if (runtime.entry.axis === 1) target.position.y = value;
        else target.position.z = -value;
      }
    }
    for (const runtime of this.glsFxRuntime) {
      const firstEventTime = runtime.tween[0]?.time;
      // game zeroes non-trigger fx targets at construction, overriding material defaults
      if (!full || (runtime.trigger && (firstEventTime === undefined || beat < firstEventTime))) {
        for (const target of runtime.targets) target.reset();
        continue;
      }
      const value = sampleGlsFloat(runtime.tween, beat);
      for (const target of runtime.targets) target.apply(value);
    }
  }
}
