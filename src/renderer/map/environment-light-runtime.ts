import { Color, ShaderMaterial, Vector3 } from 'three';

import { createBpmConverter, songBpmTimeToSeconds } from '../../core/beatmap/bpm';
import type { EventBox, LightColorEvent } from '../../core/beatmap/types';
import { DEFAULT_COLORS, resolveColorScheme, type ColorScheme, type Rgb } from '../../core/colors';
import {
  boostAt,
  createBasicLightTimeline,
  GAME_LIGHT_BOOST_NORMAL_ALPHA,
  GAME_LIGHT_HIGHLIGHT_ALPHA,
  GAME_LIGHT_NORMAL_ALPHA,
  isFullLightshowMode,
  latestBasicLightTimelineBeat,
  lightTimelineForMode,
  resolveBasicLightAlpha,
  resolveBasicLightColor,
  sampleBasicLightTimeline,
  type BasicLightTimeline,
  type LightshowMode,
} from '../../core/lighting/basic-light';
import { expandGlsEvents } from '../../core/lighting/gls-events';
import { glsColorTween, sampleGlsColorTween } from '../../core/lighting/gls-sampling';
import type { MapRenderData } from '../../core/placement/map-render-data';
import { evaluateAnimationCurve } from '../environment/animation-curve';
import type {
  EnvironmentGlsColorTarget,
  EnvironmentLightBinding,
  EnvironmentLightSegment,
  LoadedEnvironment,
} from '../environment/environment-runtime';
import { shaderColorUniform, shaderNumberUniform, shaderUniformValue } from '../materials/shared';
import { lightBindingKey, rebuildEnvironmentLightEventCache } from './environment-light-timeline-routing';
import { EnvironmentTransformRuntime } from './environment-transform-runtime';

interface GlsColorRuntime {
  target: EnvironmentGlsColorTarget;
  tween: ReturnType<typeof glsColorTween>;
  initialVisible?: boolean;
  initialMaterials: {
    material: ShaderMaterial;
    colorProperty: string;
    color?: Color;
    alpha?: number;
    multiplier?: number;
  }[];
}

interface ControlledLight {
  color: Rgb;
  alpha: number;
  rawAlpha?: number;
  fading?: boolean;
  customColor?: boolean;
  visible?: boolean;
}

function basicEventValueAt(events: MapRenderData['lightEvents'], beat: number) {
  let low = 0;
  let high = events.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if ((events[middle]?.songBpmTime ?? Number.POSITIVE_INFINITY) <= beat) low = middle + 1;
    else high = middle;
  }
  return low === 0 ? undefined : events[low - 1]?.value;
}

export class EnvironmentLightRuntime {
  readonly directionalLights = {
    directions: Array.from({ length: 5 }, () => new Vector3(0, 0, 1)),
    colors: Array.from({ length: 5 }, () => new Vector3()),
    positions: Array.from({ length: 5 }, () => new Vector3()),
    radii: Array.from({ length: 5 }, () => 100),
  };
  readonly songTime = { value: 0 };
  readonly lightSegments: EnvironmentLightSegment[] = [];

  private readonly position = new Vector3();
  private readonly directionalLightLinear = new Color();
  private readonly transforms = new EnvironmentTransformRuntime();
  private readonly glsSegments = new Map<EnvironmentLightSegment, ControlledLight>();
  private readonly glsMaterialLights = new Map<LoadedEnvironment['materialLights'][number], ControlledLight>();
  private readonly glsDirectMaterials = new Map<
    ShaderMaterial,
    {
      controlled: ControlledLight;
      colorProperty: string;
    }
  >();
  private readonly lightEventsByType = new Map<number, MapRenderData['lightEvents']>();
  private readonly lightEventsByBinding = new Map<EnvironmentLightBinding, MapRenderData['lightEvents']>();
  private readonly lightEventsByBindingKey = new Map<string, MapRenderData['lightEvents']>();
  private readonly lightTimelinesByBinding = new Map<EnvironmentLightBinding, BasicLightTimeline>();
  private readonly lightTimelinesByEvents = new Map<MapRenderData['lightEvents'], BasicLightTimeline>();

  private environment: LoadedEnvironment | null = null;
  private data: MapRenderData | null = null;
  private colors: ColorScheme = DEFAULT_COLORS;
  private lightshowMode: LightshowMode = 'full';
  private glsColorRuntime: GlsColorRuntime[] = [];
  private jsonTimeToSongBpmTime: (jsonTime: number) => number = (jsonTime) => jsonTime;

  setEnvironment(environment: LoadedEnvironment) {
    this.environment = environment;
    this.rebuildTimelineCaches();
    environment.applyChromaRemoval(this.data?.environmentRemoval ?? []);
    this.lightSegments.length = 0;
    for (const segment of environment.lightSegments) {
      this.lightSegments.push({
        ...segment,
        start: [...segment.start],
        end: [...segment.end],
        color: [...segment.color],
        intensityMultiplier: segment.intensityMultiplier ?? 1,
      });
    }
    if (this.data === null) this.colors = resolveColorScheme(environment.data.colorScheme);
    this.rebuildRuntime();
  }

  setMap(data: MapRenderData, colors: ColorScheme) {
    this.data = data;
    this.colors = colors;
    this.environment?.applyChromaRemoval(data.environmentRemoval);
    this.rebuildTimelineCaches();
    this.rebuildRuntime();
  }

  setColors(colors: ColorScheme) {
    this.colors = colors;
  }

  clearMap() {
    this.data = null;
    this.environment?.applyChromaRemoval([]);
  }

  setLightshowMode(mode: LightshowMode) {
    this.lightshowMode = mode;
  }

  update(beat: number) {
    const environment = this.environment;
    if (environment === null) return;

    const songBpm = this.data?.songBpm ?? 120;
    this.songTime.value = songBpmTimeToSeconds(beat, songBpm);
    const full = isFullLightshowMode(this.lightshowMode);
    const boosted = full ? boostAt(this.lightEventsByType.get(5) ?? [], beat) : false;
    for (const target of environment.boostSwitches) target.apply(boosted);
    for (const target of environment.eventSwitches) {
      const value = full ? basicEventValueAt(this.lightEventsByType.get(target.eventType) ?? [], beat) : undefined;
      target.apply(value ?? target.defaultValue);
    }

    this.updateGlsColors(beat, boosted, full);
    this.updateLightSegments(beat, boosted, songBpm);
    this.updateMaterialLights(beat, boosted, songBpm);
    this.transforms.update(beat, full);
    environment.enforceChromaRemoval();
  }

  updateWorldLights(beat: number) {
    this.environment?.applyReflections(this.lightSegments);
    for (const segment of this.lightSegments) {
      this.position.fromArray(segment.localStart).applyMatrix4(segment.node.matrixWorld);
      segment.start[0] = this.position.x;
      segment.start[1] = this.position.y;
      segment.start[2] = this.position.z;
      this.position.fromArray(segment.localEnd).applyMatrix4(segment.node.matrixWorld);
      segment.end[0] = this.position.x;
      segment.end[1] = this.position.y;
      segment.end[2] = this.position.z;
    }
    this.updateDirectionalLights(beat);
  }

  private rebuildTimelineCaches() {
    this.lightTimelinesByBinding.clear();
    this.lightTimelinesByEvents.clear();
    rebuildEnvironmentLightEventCache(this.data, this.environment, {
      byType: this.lightEventsByType,
      byBinding: this.lightEventsByBinding,
      byBindingKey: this.lightEventsByBindingKey,
    });
  }

  private rebuildRuntime() {
    this.glsColorRuntime = [];
    const data = this.data;
    const environment = this.environment;
    if (data === null || environment === null) {
      this.transforms.clear();
      return;
    }
    this.jsonTimeToSongBpmTime = createBpmConverter(data.bpmEvents, data.songBpm);

    for (const segment of environment.lightSegments) {
      for (const binding of segment.bindings) this.timelineForBinding(binding);
    }
    for (const light of environment.materialLights) {
      for (const binding of light.bindings) this.timelineForBinding(binding);
    }
    for (const light of environment.directionalLights) {
      for (const input of light.inputs) this.timelineForBinding(input.binding);
    }

    for (const environmentGroup of environment.glsColorGroups) {
      const groups = data.lightColorEventBoxGroups.filter((group) => group.id === environmentGroup.groupId);
      const expanded = expandGlsEvents<LightColorEvent, EventBox<LightColorEvent>>(groups, environmentGroup.count);
      for (const target of environmentGroup.targets) {
        this.glsColorRuntime.push({
          target,
          tween: glsColorTween(
            expanded.filter((event) => event.element === target.id),
            this.jsonTimeToSongBpmTime,
          ),
          initialVisible: target.node?.visible,
          initialMaterials: target.materials.map((material) => {
            const color = shaderColorUniform(material, target.colorProperty);
            const alpha = shaderNumberUniform(material, `${target.colorProperty}Alpha`);
            const multiplier = shaderUniformValue(material, '_ColorMultiplier');
            return {
              material,
              colorProperty: target.colorProperty,
              color: color?.clone(),
              alpha,
              multiplier,
            };
          }),
        });
      }
    }
    this.transforms.rebuild(
      environment,
      data,
      this.jsonTimeToSongBpmTime,
      (eventType) => this.lightEventsByType.get(eventType) ?? [],
    );
  }

  private updateGlsColors(beat: number, boosted: boolean, full: boolean) {
    this.glsSegments.clear();
    this.glsMaterialLights.clear();
    this.glsDirectMaterials.clear();
    if (full) {
      for (const runtime of this.glsColorRuntime) {
        const sample = sampleGlsColorTween(runtime.tween, beat, this.colors, boosted);
        const controlled = runtime.target.transform(sample.color, sample.alpha);
        if (runtime.target.node !== undefined) runtime.target.node.visible = controlled.visible;
        for (const segment of runtime.target.segments) this.glsSegments.set(segment, controlled);
        for (const light of runtime.target.materialLights) this.glsMaterialLights.set(light, controlled);
        for (const material of runtime.target.materials) {
          this.glsDirectMaterials.set(material, {
            controlled,
            colorProperty: runtime.target.colorProperty,
          });
        }
      }
      return;
    }

    for (const runtime of this.glsColorRuntime) {
      if (runtime.target.node !== undefined && runtime.initialVisible !== undefined) {
        runtime.target.node.visible = runtime.initialVisible;
      }
      for (const initial of runtime.initialMaterials) {
        const color = shaderColorUniform(initial.material, initial.colorProperty);
        if (color !== undefined && initial.color !== undefined) color.copy(initial.color);
        const alpha = initial.material.uniforms[`${initial.colorProperty}Alpha`];
        if (initial.alpha !== undefined && alpha !== undefined) alpha.value = initial.alpha;
        if (initial.multiplier !== undefined && initial.material.uniforms._ColorMultiplier !== undefined) {
          initial.material.uniforms._ColorMultiplier.value = initial.multiplier;
        }
      }
    }
  }

  private updateLightSegments(beat: number, boosted: boolean, songBpm: number) {
    const environment = this.environment;
    if (environment === null) return;
    for (const [index, segment] of environment.lightSegments.entries()) {
      const output = this.lightSegments[index];
      if (output === undefined) continue;
      const gls = this.glsSegments.get(segment);
      if (gls === undefined) this.sampleLightSegment(segment, output, beat, boosted, songBpm);
      else {
        output.color = gls.color;
        output.alpha = segment.alpha * gls.alpha;
      }
      const lengthAlpha = segment.multiplyLengthByAlpha
        ? evaluateAnimationCurve(segment.alphaToLengthCurve, output.alpha)
        : 1;
      const bloomLengthAlpha = segment.multiplyLengthByAlpha
        ? evaluateAnimationCurve(segment.alphaToBloomLengthCurve, output.alpha)
        : 1;
      const length = segment.baseLength * bloomLengthAlpha;
      output.localStart[1] = -length * segment.center;
      output.localEnd[1] = length * (1 - segment.center);
      output.endAlpha = (segment.endAlpha ?? 1) * lengthAlpha;
    }
  }

  private updateMaterialLights(beat: number, boosted: boolean, songBpm: number) {
    const environment = this.environment;
    if (environment === null) return;
    for (const light of environment.materialLights) {
      const gls = this.glsMaterialLights.get(light);
      const sampled = gls ?? this.sampleEnvironmentLight(light.bindings, beat, boosted, songBpm);
      if (sampled === null) continue;
      let controlled: ControlledLight;
      if (gls === undefined) {
        controlled = light.transform?.(sampled.color, sampled.alpha) ?? {
          color: sampled.color,
          alpha: Math.max(sampled.alpha * light.intensityMultiplier, light.minimumAlpha ?? 0),
          visible: true,
        };
      } else {
        controlled = {
          ...gls,
          alpha: Math.max(gls.alpha * light.intensityMultiplier, light.minimumAlpha ?? 0),
        };
      }
      if (light.node !== undefined) light.node.visible = controlled.visible ?? true;
      light.applyAlpha?.(sampled.rawAlpha ?? sampled.alpha);
      const colorProperty = light.colorProperty ?? '_Color';
      for (const material of light.materials) {
        const color = shaderColorUniform(material, colorProperty);
        if (color !== undefined) this.setControlledMaterialColor(color, controlled.color, sampled.customColor);
        const alpha = material.uniforms[`${colorProperty}Alpha`];
        if (alpha !== undefined) alpha.value = controlled.alpha;
        const multiplier = material.uniforms._ColorMultiplier;
        if (multiplier !== undefined) multiplier.value = controlled.alpha;
      }
    }
    for (const [material, { controlled, colorProperty }] of this.glsDirectMaterials) {
      const color = shaderColorUniform(material, colorProperty);
      if (color !== undefined) this.setControlledMaterialColor(color, controlled.color, controlled.customColor);
      const alpha = material.uniforms[`${colorProperty}Alpha`];
      if (alpha !== undefined) alpha.value = controlled.alpha;
      const multiplier = material.uniforms._ColorMultiplier;
      if (multiplier !== undefined) multiplier.value = controlled.alpha;
    }
  }

  private setControlledMaterialColor(target: Color, color: Rgb, customColor = false) {
    target.setRGB(...color);
    if (customColor) return;
    this.directionalLightLinear.setRGB(...color).convertSRGBToLinear();
    target.copy(this.directionalLightLinear);
  }

  private sampleLightSegment(
    segment: EnvironmentLightSegment,
    output: EnvironmentLightSegment,
    beat: number,
    boosted: boolean,
    songBpm: number,
  ) {
    const sampled = this.sampleEnvironmentLight(segment.bindings, beat, boosted, songBpm);
    output.color = sampled?.color ?? segment.color;
    output.alpha =
      sampled === null ? (this.lightshowMode === 'none' ? 0 : segment.alpha) : segment.alpha * sampled.alpha;
  }

  private sampleEnvironmentLight(bindings: EnvironmentLightBinding[], beat: number, boosted: boolean, songBpm: number) {
    let binding: EnvironmentLightBinding | undefined;
    let latest = Number.NEGATIVE_INFINITY;
    for (const candidate of bindings) {
      const timeline = this.timelineForBinding(candidate);
      const eventBeat = latestBasicLightTimelineBeat(timeline, beat);
      if (binding === undefined || eventBeat >= latest) {
        binding = candidate;
        latest = eventBeat;
      }
    }
    if (binding === undefined) return null;
    return this.sampleEnvironmentBinding(binding, beat, boosted, songBpm);
  }

  private sampleEnvironmentBinding(binding: EnvironmentLightBinding, beat: number, boosted: boolean, songBpm: number) {
    const sample = sampleBasicLightTimeline(
      lightTimelineForMode(this.lightshowMode, this.timelineForBinding(binding)),
      beat,
      {
        songBpm,
        offIntensity: binding.offIntensity,
        lightOnStart: binding.lightOnStart,
        normalAlpha: boosted ? GAME_LIGHT_BOOST_NORMAL_ALPHA : GAME_LIGHT_NORMAL_ALPHA,
        highlightAlpha: GAME_LIGHT_HIGHLIGHT_ALPHA,
      },
    );
    const alpha = resolveBasicLightAlpha(sample);
    return {
      color: resolveBasicLightColor(sample, this.colors, binding.invertColorScheme, boosted),
      alpha: sample.fading === true ? Math.max(alpha, 0) : alpha,
      rawAlpha: alpha,
      fading: sample.fading === true,
      customColor: sample.customColor !== undefined || sample.transition?.customColor !== undefined,
    };
  }

  private eventsForBinding(binding: EnvironmentLightBinding) {
    const cached = this.lightEventsByBinding.get(binding);
    if (cached !== undefined) return cached;
    const events = this.lightEventsByBindingKey.get(lightBindingKey(binding)) ?? [];
    this.lightEventsByBinding.set(binding, events);
    return events;
  }

  private timelineForBinding(binding: EnvironmentLightBinding) {
    const cached = this.lightTimelinesByBinding.get(binding);
    if (cached !== undefined) return cached;
    const events = this.eventsForBinding(binding);
    const timeline = this.lightTimelinesByEvents.get(events) ?? createBasicLightTimeline(events);
    this.lightTimelinesByBinding.set(binding, timeline);
    this.lightTimelinesByEvents.set(events, timeline);
    return timeline;
  }

  private updateDirectionalLights(beat: number) {
    const { colors, directions, positions, radii } = this.directionalLights;
    for (const color of colors) color.set(0, 0, 0);
    const environment = this.environment;
    if (environment === null) return;
    const boosted = isFullLightshowMode(this.lightshowMode)
      ? boostAt(this.lightEventsByType.get(5) ?? [], beat)
      : false;
    const songBpm = this.data?.songBpm ?? 120;
    for (let index = 0; index < Math.min(environment.directionalLights.length, 5); index++) {
      const light = environment.directionalLights[index];
      if (light === undefined) continue;
      const direction = directions[index];
      const color = colors[index];
      const position = positions[index];
      if (direction === undefined || color === undefined || position === undefined) return;
      light.node.getWorldDirection(direction);
      light.node.getWorldPosition(position);
      radii[index] = light.radius;
      if (light.inputs.length === 0) {
        color.fromArray(light.color).multiplyScalar(light.intensity);
        this.directionalLightLinear.setRGB(color.x, color.y, color.z).convertSRGBToLinear();
        color.set(this.directionalLightLinear.r, this.directionalLightLinear.g, this.directionalLightLinear.b);
        continue;
      }
      for (const input of light.inputs) {
        const sample = this.sampleEnvironmentBinding(input.binding, beat, boosted, songBpm);
        const weightedAlpha = sample.alpha * input.intensity;
        const alpha = light.mixType === 0 ? Math.sqrt(Math.max(weightedAlpha, 0)) : weightedAlpha;
        const colorWeight = light.multiplyColorByAlpha ? alpha : 1;
        this.directionalLightLinear.setRGB(...sample.color);
        if (!sample.customColor) this.directionalLightLinear.convertSRGBToLinear();
        if (light.mixType === 0) {
          color.x = Math.max(color.x, this.directionalLightLinear.r * colorWeight);
          color.y = Math.max(color.y, this.directionalLightLinear.g * colorWeight);
          color.z = Math.max(color.z, this.directionalLightLinear.b * colorWeight);
        } else {
          color.x += this.directionalLightLinear.r * colorWeight;
          color.y += this.directionalLightLinear.g * colorWeight;
          color.z += this.directionalLightLinear.b * colorWeight;
        }
      }
      if (light.multiplyColorByAlpha) {
        color.multiplyScalar(light.controllerIntensity);
        const grayscale = color.x * 0.299 + color.y * 0.587 + color.z * 0.114;
        if (grayscale > light.maxIntensity) color.multiplyScalar(light.maxIntensity / grayscale);
      }
      color.multiplyScalar(light.intensity);
    }
  }
}
