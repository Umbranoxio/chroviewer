import { Color, ShaderMaterial, Vector3, type Object3D } from 'three';

import type { PointSampleContext } from '../../core/animation/point-definition';
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
  type BasicLightSample,
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
import { ChromaTrackRuntime } from './chroma-track-runtime';
import { lightBindingKey, rebuildEnvironmentLightEventCache } from './environment-light-timeline-routing';
import { EnvironmentTransformRuntime } from './environment-transform-runtime';

interface GlsColorSource {
  tween: ReturnType<typeof glsColorTween>;
}

interface GlsColorRuntime {
  target: EnvironmentGlsColorTarget;
  source: GlsColorSource;
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
  visible?: boolean;
}

interface ResolvedBindingSample extends ControlledLight {
  stateAlpha: number;
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

function visibleInHierarchy(node: Object3D) {
  for (let current: Object3D | null = node; current !== null; current = current.parent) {
    if (!current.visible) return false;
  }
  return true;
}

function linearToGammaSpace(value: number) {
  if (value <= 0.0031308) return Math.max(value, 0) * 12.92;
  return 1.055 * Math.pow(value, 1 / 2.4) - 0.055;
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
  private readonly chromaTracks = new ChromaTrackRuntime();
  private readonly glsSegments = new Map<EnvironmentLightSegment, ControlledLight>();
  private readonly glsMaterialLights = new Map<LoadedEnvironment['materialLights'][number], ControlledLight>();
  private readonly glsColorSamples = new Map<GlsColorSource, ReturnType<typeof sampleGlsColorTween>>();
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
  private readonly basicLightSamples = new Map<
    BasicLightTimeline,
    Map<number, [BasicLightSample | undefined, BasicLightSample | undefined]>
  >();
  private readonly resolvedBasicLightSamples = new Map<
    BasicLightSample,
    [ResolvedBindingSample | undefined, ResolvedBindingSample | undefined]
  >();
  private readonly latestTimelineBeats = new Map<BasicLightTimeline, number>();

  private environment: LoadedEnvironment | null = null;
  private data: MapRenderData | null = null;
  private colors: ColorScheme = DEFAULT_COLORS;
  private lightshowMode: LightshowMode = 'full';
  private glsColorRuntime: GlsColorRuntime[] = [];
  private jsonTimeToSongBpmTime: (jsonTime: number) => number = (jsonTime) => jsonTime;
  private basicLightSampleBeat = Number.NaN;
  private basicLightSampleBoosted = false;
  private basicLightSampleSongBpm = Number.NaN;
  private basicLightSampleMode?: LightshowMode;
  private basicLightSampleColors?: ColorScheme;

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
    this.chromaTracks.rebuild(environment);
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
    this.basicLightSampleColors = undefined;
  }

  clearMap() {
    this.data = null;
    this.environment?.applyChromaRemoval([]);
  }

  setLightshowMode(mode: LightshowMode) {
    this.lightshowMode = mode;
    this.basicLightSampleMode = undefined;
  }

  update(beat: number, context?: PointSampleContext) {
    const environment = this.environment;
    if (environment === null) return;

    const songBpm = this.data?.songBpm ?? 120;
    this.songTime.value = songBpmTimeToSeconds(beat, songBpm);
    const full = isFullLightshowMode(this.lightshowMode);
    const boosted = full ? boostAt(this.lightEventsByType.get(5) ?? [], beat) : false;
    this.prepareBasicLightSamples(beat, boosted, songBpm);
    this.updateBakedReflectionProbe(beat, boosted, songBpm);
    for (const target of environment.boostSwitches) target.apply(boosted);
    for (const target of environment.eventSwitches) {
      const value = full ? basicEventValueAt(this.lightEventsByType.get(target.eventType) ?? [], beat) : undefined;
      target.apply(value ?? target.defaultValue);
    }

    const chromaFog = this.chromaTracks.update(beat, this.data?.noodle, context);
    this.updateGlsColors(beat, boosted, full);
    this.updateLightSegments(beat, boosted, songBpm);
    this.updateMaterialLights(beat, boosted, songBpm);
    this.transforms.update(beat, full);
    environment.enforceChromaRemoval();
    return chromaFog;
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
    this.basicLightSampleMode = undefined;
    this.basicLightSamples.clear();
    this.resolvedBasicLightSamples.clear();
    this.latestTimelineBeats.clear();
    this.glsColorSamples.clear();
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
      if (environment === null) this.chromaTracks.clear();
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

    const colorGroupsById = new Map<number, typeof data.lightColorEventBoxGroups>();
    const colorGroupIds = new Set(environment.glsColorGroups.map((group) => group.groupId));
    if (colorGroupIds.size > 0) {
      for (const group of data.lightColorEventBoxGroups) {
        if (!colorGroupIds.has(group.id)) continue;
        const groups = colorGroupsById.get(group.id);
        if (groups === undefined) colorGroupsById.set(group.id, [group]);
        else groups.push(group);
      }
    }
    const glsColorSources = new Map<string, GlsColorSource>();
    for (const environmentGroup of environment.glsColorGroups) {
      const groups = colorGroupsById.get(environmentGroup.groupId) ?? [];
      const expanded = expandGlsEvents<LightColorEvent, EventBox<LightColorEvent>>(groups, environmentGroup.count);
      const expandedByElement = new Map<number, typeof expanded>();
      const targetIds = new Set(environmentGroup.targets.map((target) => target.id));
      for (const event of expanded) {
        if (!targetIds.has(event.element)) continue;
        const events = expandedByElement.get(event.element);
        if (events === undefined) expandedByElement.set(event.element, [event]);
        else events.push(event);
      }
      for (const target of environmentGroup.targets) {
        const sourceKey = `${String(environmentGroup.groupId)}:${String(environmentGroup.count)}:${String(target.id)}`;
        let source = glsColorSources.get(sourceKey);
        if (source === undefined) {
          source = {
            tween: glsColorTween(expandedByElement.get(target.id) ?? [], this.jsonTimeToSongBpmTime),
          };
          glsColorSources.set(sourceKey, source);
        }
        this.glsColorRuntime.push({
          target,
          source,
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
    this.glsColorSamples.clear();
    if (full) {
      const samples = this.glsColorSamples;
      for (const runtime of this.glsColorRuntime) {
        let sample = samples.get(runtime.source);
        if (sample === undefined) {
          sample = sampleGlsColorTween(runtime.source.tween, beat, this.colors, boosted);
          samples.set(runtime.source, sample);
        }
        const controlled = runtime.target.transform(sample.color, sample.alpha);
        if (runtime.target.node !== undefined) {
          runtime.target.node.visible = runtime.initialVisible !== false && controlled.visible;
        }
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
      output.intensityMultiplier = segment.intensityMultiplier;
      const gls = this.glsSegments.get(segment);
      if (gls === undefined) this.sampleLightSegment(segment, output, beat, boosted, songBpm);
      else {
        output.color = gls.color;
        output.alpha = segment.alpha * gls.alpha;
      }
      if (!visibleInHierarchy(segment.node)) output.alpha = 0;
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
      const sampled =
        gls ??
        (light.combined === undefined
          ? this.sampleEnvironmentLight(light.bindings, beat, boosted, songBpm)
          : this.sampleCombinedMaterialLight(light.combined, beat, boosted, songBpm));
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
      if (light.node !== undefined) {
        light.node.visible = light.initialVisible !== false && (controlled.visible ?? true);
      }
      light.applyAlpha?.(sampled.rawAlpha ?? sampled.alpha);
      const colorProperty = light.colorProperty ?? '_Color';
      for (const material of light.materials) {
        const color = shaderColorUniform(material, colorProperty);
        if (color !== undefined && light.combined?.setAlphaOnly !== true) {
          this.setControlledMaterialColor(color, controlled.color);
        }
        const alpha = material.uniforms[`${colorProperty}Alpha`];
        if (alpha !== undefined && light.combined?.setColorOnly !== true) alpha.value = controlled.alpha;
        const multiplier = material.uniforms._ColorMultiplier;
        if (multiplier !== undefined && light.combined?.setColorOnly !== true) multiplier.value = controlled.alpha;
      }
    }
    for (const [material, { controlled, colorProperty }] of this.glsDirectMaterials) {
      const color = shaderColorUniform(material, colorProperty);
      if (color !== undefined) this.setControlledMaterialColor(color, controlled.color);
      const alpha = material.uniforms[`${colorProperty}Alpha`];
      if (alpha !== undefined) alpha.value = controlled.alpha;
      const multiplier = material.uniforms._ColorMultiplier;
      if (multiplier !== undefined) multiplier.value = controlled.alpha;
    }
  }

  private setControlledMaterialColor(target: Color, color: Rgb) {
    target.setRGB(...color);
  }

  private sampleCombinedMaterialLight(
    controller: NonNullable<LoadedEnvironment['materialLights'][number]['combined']>,
    beat: number,
    boosted: boolean,
    songBpm: number,
  ): ControlledLight {
    let red = 0;
    let green = 0;
    let blue = 0;
    let alpha = 0;
    for (const input of controller.inputs) {
      const sample = this.sampleEnvironmentLight(input.bindings, beat, boosted, songBpm);
      if (sample === null) continue;
      const inputAlpha =
        controller.mixType === 0
          ? Math.sqrt(Math.max(sample.alpha * input.intensity, 0))
          : sample.alpha * input.intensity;
      const weight = controller.multiplyColorByAlpha ? inputAlpha : 1;
      const inputRed = sample.color[0] * weight;
      const inputGreen = sample.color[1] * weight;
      const inputBlue = sample.color[2] * weight;
      if (controller.mixType === 0) {
        red = Math.max(red, inputRed);
        green = Math.max(green, inputGreen);
        blue = Math.max(blue, inputBlue);
        alpha = Math.max(alpha, inputAlpha);
      } else {
        red += inputRed;
        green += inputGreen;
        blue += inputBlue;
      }
    }

    if (controller.multiplyColorByAlpha) {
      red *= controller.intensity;
      green *= controller.intensity;
      blue *= controller.intensity;
      alpha *= controller.intensity;
      const grayscale = red * 0.299 + green * 0.587 + blue * 0.114;
      if (grayscale > controller.maxIntensity) {
        const scale = controller.maxIntensity / grayscale;
        red *= scale;
        green *= scale;
        blue *= scale;
        alpha *= scale;
      }
    } else {
      alpha = Math.min(alpha * controller.intensity, controller.maxIntensity);
    }
    const color: Rgb = controller.alphaIntoColor ? [alpha, alpha, alpha] : [red, green, blue];
    return { color, alpha, visible: true };
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
    this.prepareBasicLightSamples(beat, boosted, songBpm);
    let binding: EnvironmentLightBinding | undefined;
    let latest = Number.NEGATIVE_INFINITY;
    for (const candidate of bindings) {
      const timeline = this.timelineForBinding(candidate);
      let eventBeat = this.latestTimelineBeats.get(timeline);
      if (eventBeat === undefined) {
        eventBeat = latestBasicLightTimelineBeat(timeline, beat);
        this.latestTimelineBeats.set(timeline, eventBeat);
      }
      if (binding === undefined || eventBeat >= latest) {
        binding = candidate;
        latest = eventBeat;
      }
    }
    if (binding === undefined) return null;
    return this.sampleEnvironmentBinding(binding, beat, boosted, songBpm);
  }

  private sampleEnvironmentBinding(binding: EnvironmentLightBinding, beat: number, boosted: boolean, songBpm: number) {
    this.prepareBasicLightSamples(beat, boosted, songBpm);
    const timeline = lightTimelineForMode(this.lightshowMode, this.timelineForBinding(binding));
    return this.sampleBasicTimeline(
      timeline,
      beat,
      boosted,
      songBpm,
      binding.offIntensity,
      binding.lightOnStart,
      binding.invertColorScheme,
    );
  }

  private sampleEventType(eventType: number, beat: number, boosted: boolean, songBpm: number) {
    const events = this.lightEventsByType.get(eventType);
    if (events === undefined) return null;
    const sourceTimeline = this.lightTimelinesByEvents.get(events) ?? createBasicLightTimeline(events);
    this.lightTimelinesByEvents.set(events, sourceTimeline);
    const timeline = lightTimelineForMode(this.lightshowMode, sourceTimeline);
    return this.sampleBasicTimeline(timeline, beat, boosted, songBpm, 0, false, false);
  }

  private sampleBasicTimeline(
    timeline: BasicLightTimeline,
    beat: number,
    boosted: boolean,
    songBpm: number,
    offIntensity: number,
    lightOnStart: boolean,
    invertColorScheme: boolean,
  ) {
    let samplesByOffIntensity = this.basicLightSamples.get(timeline);
    if (samplesByOffIntensity === undefined) {
      samplesByOffIntensity = new Map();
      this.basicLightSamples.set(timeline, samplesByOffIntensity);
    }
    let samplesByLightOnStart = samplesByOffIntensity.get(offIntensity);
    if (samplesByLightOnStart === undefined) {
      samplesByLightOnStart = [undefined, undefined];
      samplesByOffIntensity.set(offIntensity, samplesByLightOnStart);
    }
    const lightOnStartIndex = lightOnStart ? 1 : 0;
    let sample = samplesByLightOnStart[lightOnStartIndex];
    if (sample === undefined) {
      sample = sampleBasicLightTimeline(timeline, beat, {
        songBpm,
        offIntensity,
        lightOnStart,
        normalAlpha: boosted ? GAME_LIGHT_BOOST_NORMAL_ALPHA : GAME_LIGHT_NORMAL_ALPHA,
        highlightAlpha: GAME_LIGHT_HIGHLIGHT_ALPHA,
      });
      samplesByLightOnStart[lightOnStartIndex] = sample;
    }
    let resolvedByInversion = this.resolvedBasicLightSamples.get(sample);
    if (resolvedByInversion === undefined) {
      resolvedByInversion = [undefined, undefined];
      this.resolvedBasicLightSamples.set(sample, resolvedByInversion);
    }
    const inversionIndex = invertColorScheme ? 1 : 0;
    const cached = resolvedByInversion[inversionIndex];
    if (cached !== undefined) return cached;
    const alpha = resolveBasicLightAlpha(sample);
    const resolved = {
      color: resolveBasicLightColor(sample, this.colors, invertColorScheme, boosted),
      alpha: sample.fading === true ? Math.max(alpha, 0) : alpha,
      rawAlpha: alpha,
      // event envelope without the chroma color alpha; game directional lights ignore it
      stateAlpha: sample.fading === true ? Math.max(sample.alpha, 0) : sample.alpha,
      fading: sample.fading === true,
    };
    resolvedByInversion[inversionIndex] = resolved;
    return resolved;
  }

  private updateBakedReflectionProbe(beat: number, boosted: boolean, songBpm: number) {
    const probe = this.environment?.bakedReflectionProbe;
    if (probe === undefined) return;
    for (const color of probe.lightColors) color.set(0, 0, 0, 0);
    for (const light of probe.lights) {
      const output = probe.lightColors[light.bakeId - 1];
      if (output === undefined) continue;
      let red = 0;
      let green = 0;
      let blue = 0;
      let alpha = 0;
      for (const input of light.inputs) {
        const sample = this.sampleEventType(input.lightId, beat, boosted, songBpm);
        if (sample === null) continue;
        const inputAlpha = sample.rawAlpha ?? sample.alpha;
        const colorWeight = linearToGammaSpace(inputAlpha) * input.intensity;
        const inputRed = sample.color[0] * colorWeight;
        const inputGreen = sample.color[1] * colorWeight;
        const inputBlue = sample.color[2] * colorWeight;
        const inputHighlight = inputAlpha * 2 * input.intensity * input.probeHighlightsIntensityMultiplier;
        if (light.mixType === 0) {
          red = Math.max(red, inputRed);
          green = Math.max(green, inputGreen);
          blue = Math.max(blue, inputBlue);
          alpha = Math.max(alpha, inputHighlight);
        } else {
          red += inputRed;
          green += inputGreen;
          blue += inputBlue;
          alpha += inputHighlight;
        }
      }
      this.directionalLightLinear
        .setRGB(red * light.probeIntensity, green * light.probeIntensity, blue * light.probeIntensity)
        .convertSRGBToLinear();
      output.set(
        this.directionalLightLinear.r,
        this.directionalLightLinear.g,
        this.directionalLightLinear.b,
        alpha * light.probeIntensity,
      );
    }
  }

  private prepareBasicLightSamples(beat: number, boosted: boolean, songBpm: number) {
    if (
      this.basicLightSampleBeat === beat &&
      this.basicLightSampleBoosted === boosted &&
      this.basicLightSampleSongBpm === songBpm &&
      this.basicLightSampleMode === this.lightshowMode &&
      this.basicLightSampleColors === this.colors
    ) {
      return;
    }
    this.basicLightSampleBeat = beat;
    this.basicLightSampleBoosted = boosted;
    this.basicLightSampleSongBpm = songBpm;
    this.basicLightSampleMode = this.lightshowMode;
    this.basicLightSampleColors = this.colors;
    this.basicLightSamples.clear();
    this.resolvedBasicLightSamples.clear();
    this.latestTimelineBeats.clear();
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
    this.prepareBasicLightSamples(beat, boosted, songBpm);
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
      // game combines in gamma space and converts once at upload (LightManager)
      for (const input of light.inputs) {
        const sample = this.sampleEnvironmentBinding(input.binding, beat, boosted, songBpm);
        const weightedAlpha = sample.stateAlpha * input.intensity;
        const alpha = light.mixType === 0 ? Math.sqrt(Math.max(weightedAlpha, 0)) : weightedAlpha;
        const colorWeight = light.multiplyColorByAlpha ? alpha : 1;
        const [r, g, b] = sample.color;
        if (light.mixType === 0) {
          color.x = Math.max(color.x, r * colorWeight);
          color.y = Math.max(color.y, g * colorWeight);
          color.z = Math.max(color.z, b * colorWeight);
        } else {
          color.x += r * colorWeight;
          color.y += g * colorWeight;
          color.z += b * colorWeight;
        }
      }
      if (light.multiplyColorByAlpha) {
        color.multiplyScalar(light.controllerIntensity);
        const grayscale = color.x * 0.299 + color.y * 0.587 + color.z * 0.114;
        if (grayscale > light.maxIntensity) color.multiplyScalar(light.maxIntensity / grayscale);
      }
      color.multiplyScalar(light.intensity);
      this.directionalLightLinear.setRGB(color.x, color.y, color.z).convertSRGBToLinear();
      color.set(this.directionalLightLinear.r, this.directionalLightLinear.g, this.directionalLightLinear.b);
    }
  }
}
