import { demoDigest } from "./digest";
import type {
  AxisClaim,
  AxisEvidenceRef,
  AxisKey,
  ChoiceRecord,
  Fixture,
  PairDefinition,
  PredictionRecord,
  RankerProfile
} from "./types";

const AXIS_COPY: Record<AxisKey, { positive: string; negative: string }> = {
  openness: { positive: "开阔视线", negative: "包裹边界" },
  density: { positive: "丰富层次", negative: "留白秩序" }
};

const AXIS_THRESHOLD = 0.18;
const PREDICTION_THRESHOLD = 0.35;

function directionFor(choice: ChoiceRecord): 1 | -1 | null {
  if (choice.value === "left") return 1;
  if (choice.value === "right") return -1;
  return null;
}

function fixtureMap(fixtures: readonly Fixture[]): Map<string, Fixture> {
  return new Map(fixtures.map((fixture) => [fixture.id, fixture]));
}

function featureDelta(left: Fixture, right: Fixture, key: AxisKey): number {
  return left.visible_features[key] - right.visible_features[key];
}

function labelsFor(key: AxisKey, weight: number): { label: string; oppositeLabel: string } {
  const copy = AXIS_COPY[key];
  return weight >= 0
    ? { label: copy.positive, oppositeLabel: copy.negative }
    : { label: copy.negative, oppositeLabel: copy.positive };
}

export function fitRanker(
  fixtures: readonly Fixture[],
  schedule: readonly PairDefinition[],
  choices: readonly ChoiceRecord[]
): RankerProfile {
  const byFixture = fixtureMap(fixtures);
  const byPair = new Map(schedule.map((pair) => [pair.id, pair]));
  const numerators: Record<AxisKey, number> = { openness: 0, density: 0 };
  const denominators: Record<AxisKey, number> = { openness: 1, density: 1 };
  const fitEligibleChoices = choices.filter((choice) => byPair.get(choice.pairId)?.repeatOf === null);
  const directional = fitEligibleChoices.filter((choice) => directionFor(choice) !== null);

  for (const choice of directional) {
    const pair = byPair.get(choice.pairId);
    const direction = directionFor(choice);
    if (!pair || direction === null) continue;
    const left = byFixture.get(pair.leftId);
    const right = byFixture.get(pair.rightId);
    if (!left || !right) continue;

    for (const key of ["openness", "density"] as const) {
      const delta = featureDelta(left, right, key);
      numerators[key] += direction * delta;
      denominators[key] += Math.abs(delta);
    }
  }

  const beta: Record<AxisKey, number> = {
    openness: numerators.openness / denominators.openness,
    density: numerators.density / denominators.density
  };

  const candidateAxes = (["openness", "density"] as const)
    .map((key): AxisClaim | null => {
      const weight = beta[key];
      const sign = Math.sign(weight) || 1;
      const supportRefs: AxisEvidenceRef[] = [];
      const contradictionRefs: AxisEvidenceRef[] = [];

      for (const choice of directional) {
        const pair = byPair.get(choice.pairId);
        const direction = directionFor(choice);
        if (!pair || direction === null) continue;
        const left = byFixture.get(pair.leftId);
        const right = byFixture.get(pair.rightId);
        if (!left || !right) continue;
        const alignment = direction * featureDelta(left, right, key) * sign;
        if (Math.abs(alignment) < 0.25) continue;
        const ref: AxisEvidenceRef = {
          pairId: pair.id,
          chosenId: direction === 1 ? pair.leftId : pair.rightId,
          otherId: direction === 1 ? pair.rightId : pair.leftId,
          alignment: alignment > 0 ? "support" : "contradiction"
        };
        if (alignment > 0) supportRefs.push(ref);
        else contradictionRefs.push(ref);
      }

      if (
        directional.length < 3 ||
        Math.abs(weight) < AXIS_THRESHOLD ||
        supportRefs.length < 2 ||
        supportRefs.length <= contradictionRefs.length
      ) {
        return null;
      }

      const { label, oppositeLabel } = labelsFor(key, weight);
      return {
        id: `axis-${key}`,
        key,
        label,
        oppositeLabel,
        weight,
        supportRefs,
        contradictionRefs,
        uncertainty:
          contradictionRefs.length === 0 && Math.abs(weight) >= 0.45 ? "supported" : "tentative"
      };
    })
    .filter((axis): axis is AxisClaim => axis !== null)
    .sort((left, right) => Math.abs(right.weight) - Math.abs(left.weight))
    .slice(0, 2);

  const wholeProfileAbstainReason =
    directional.length < 3
      ? "INSUFFICIENT_DIRECTIONAL_CHOICES"
      : candidateAxes.length === 0
        ? "EVIDENCE_SUPPORTS_ZERO_AXIS"
        : null;

  return {
    basisVersion: "visible-2d-v1",
    algorithmVersion: "feature-difference-demo-v1",
    beta,
    directionalCount: directional.length,
    neutralCount: fitEligibleChoices.length - directional.length,
    qcRepeatCount: choices.length - fitEligibleChoices.length,
    axes: candidateAxes,
    wholeProfileAbstainReason
  };
}

export function predictPair(
  profile: RankerProfile,
  pair: PairDefinition,
  fixtures: readonly Fixture[]
): PredictionRecord {
  const byFixture = fixtureMap(fixtures);
  const left = byFixture.get(pair.leftId);
  const right = byFixture.get(pair.rightId);
  if (!left || !right) throw new Error(`Unregistered fixture in pair ${pair.id}`);

  const activeKeys = new Set(profile.axes.map((axis) => axis.key));
  const margin = (["openness", "density"] as const)
    .filter((key) => activeKeys.has(key))
    .reduce((sum, key) => sum + profile.beta[key] * featureDelta(left, right, key), 0);
  const zeroAxis = activeKeys.size === 0;
  const lowMargin = Math.abs(margin) < PREDICTION_THRESHOLD;
  const ordinal = zeroAxis || lowMargin ? "abstain" : margin > 0 ? "left" : "right";

  return {
    pairId: pair.id,
    leftId: pair.leftId,
    rightId: pair.rightId,
    ordinal,
    margin,
    probability: null,
    abstainReason: zeroAxis ? "ZERO_AXIS" : lowMargin ? "LOW_MARGIN" : null,
    profileDigest: demoDigest(profile)
  };
}
