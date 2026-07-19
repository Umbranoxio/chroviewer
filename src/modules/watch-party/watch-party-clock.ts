const maxSamples = 8;
const preferredSamples = 4;
const envelopeFallbackRttMs = 2000;

export interface WatchPartyClockSample {
  offsetMs: number;
  rttMs: number;
}

export interface WatchPartyClockEstimator {
  samples: WatchPartyClockSample[];
}

export function createWatchPartyClockEstimator(): WatchPartyClockEstimator {
  return { samples: [] };
}

export function addEnvelopeClockSample(
  estimator: WatchPartyClockEstimator,
  serverUnixMs: number,
  receivedUnixMs: number,
) {
  return addClockSample(estimator, {
    offsetMs: serverUnixMs - receivedUnixMs,
    rttMs: envelopeFallbackRttMs,
  });
}

export function addHeartbeatClockSample(
  estimator: WatchPartyClockEstimator,
  sentUnixMs: number,
  receivedUnixMs: number,
  serverUnixMs: number,
) {
  const rttMs = Math.max(0, receivedUnixMs - sentUnixMs);
  return addClockSample(estimator, {
    offsetMs: serverUnixMs - (sentUnixMs + rttMs / 2),
    rttMs,
  });
}

export function estimatedServerUnixMs(estimator: WatchPartyClockEstimator, localUnixMs: number) {
  if (estimator.samples.length === 0) return localUnixMs;
  const samples = [...estimator.samples].sort((left, right) => left.rttMs - right.rttMs).slice(0, preferredSamples);
  let weightedOffset = 0;
  let totalWeight = 0;
  for (const sample of samples) {
    const weight = 1 / Math.max(1, sample.rttMs);
    weightedOffset += sample.offsetMs * weight;
    totalWeight += weight;
  }
  return localUnixMs + weightedOffset / totalWeight;
}

function addClockSample(estimator: WatchPartyClockEstimator, sample: WatchPartyClockSample): WatchPartyClockEstimator {
  if (!Number.isFinite(sample.offsetMs) || !Number.isFinite(sample.rttMs)) return estimator;
  return { samples: [...estimator.samples, sample].slice(-maxSamples) };
}
