const scoreSaberStarValue = 42.117208413;
const scoreSaberV3Curve: Record<number, number> = {
  1: 5.367394282890631,
  0.9995: 5.019543595874787,
  0.999: 4.715470646416203,
  0.99825: 4.325027383589547,
  0.9975: 3.996793606763322,
  0.99625: 3.5526145337555373,
  0.995: 3.2022017597337955,
  0.99375: 2.9190155639254955,
  0.9925: 2.685667856592722,
  0.99125: 2.4902905794106913,
  0.99: 2.324506282149922,
  0.9875: 2.058947159052738,
  0.985: 1.8563887693647105,
  0.9825: 1.697536248647543,
  0.98: 1.5702410055532239,
  0.9775: 1.4664726399289512,
  0.975: 1.3807102743105126,
  0.9725: 1.3090333065057616,
  0.97: 1.2485807759957321,
  0.965: 1.1552120359501035,
  0.96: 1.0871883573850478,
  0.955: 1.0388633331418984,
  0.95: 1,
  0.94: 0.9417362980580238,
  0.93: 0.9039994071865736,
  0.92: 0.8728710341448851,
  0.91: 0.8488375988124467,
  0.9: 0.825756123560842,
  0.875: 0.7816934560296046,
  0.85: 0.7462290664143185,
  0.825: 0.7150465663454271,
  0.8: 0.6872268862950283,
  0.75: 0.6451808210101443,
  0.7: 0.6125565959114954,
  0.65: 0.5866010012767576,
  0.6: 0.18223233667439062,
  0: 0,
};

let scoreSaberStars = 0;

export function setScoreSaberStars(stars: number) {
  scoreSaberStars = stars;
}

function lerp(v0: number, v1: number, t: number): number {
  return v0 + t * (v1 - v0);
}

function calculatePPModifier(
  lowerAcc: number,
  lowerVal: number,
  upperAcc: number,
  upperVal: number,
  acc: number,
): number {
  if (Math.abs(upperAcc - lowerAcc) < 1e-9) return lowerVal;
  let t = (acc - lowerAcc) / (upperAcc - lowerAcc);
  t = Math.max(0, Math.min(1, t));
  return lerp(lowerVal, upperVal, t);
}

export function calculatePP(normalisedAccuracy: number): number {
  const ppValue = scoreSaberStars * scoreSaberStarValue;
  const keys = Object.keys(scoreSaberV3Curve)
    .map(Number)
    .sort((a, b) => a - b);

  if (keys.length === 0) return 0;

  const lowestAccuracy = keys[0];
  const highestAccuracy = keys[keys.length - 1];

  if (lowestAccuracy != null && normalisedAccuracy <= lowestAccuracy) {
    if (scoreSaberV3Curve[lowestAccuracy] != null) return ppValue * scoreSaberV3Curve[lowestAccuracy];
  }

  if (highestAccuracy != null && normalisedAccuracy >= highestAccuracy) {
    if (scoreSaberV3Curve[highestAccuracy] != null) return ppValue * scoreSaberV3Curve[highestAccuracy];
  }

  for (let i = 0; i < keys.length - 1; i++) {
    const lower = keys[i];
    const upper = keys[i + 1];

    if (lower == null || upper == null) continue;

    if (normalisedAccuracy >= lower && normalisedAccuracy <= upper) {
      const lowerVal = scoreSaberV3Curve[lower];
      const upperVal = scoreSaberV3Curve[upper];

      if (lowerVal == null || upperVal == null) continue;

      const multiplier = calculatePPModifier(lower, lowerVal, upper, upperVal, normalisedAccuracy);

      return ppValue * multiplier;
    }
  }

  return 0;
}
