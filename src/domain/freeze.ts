import { demoDigest } from "./digest";
import { generateLanguageSafely, type LanguageAdapter } from "./language";
import { buildLineupPlan, buildPerturbationPlan } from "./lineup";
import { fitRanker, predictPair } from "./ranker";
import type {
  ChoiceRecord,
  Fixture,
  PairDefinition,
  ProfileLock
} from "./types";

interface FreezeInput {
  now: string;
  displayTheme: "light" | "dark";
  viewportClass: "mobile" | "desktop";
  fixtureSetVersion: string;
  fixtureManifestDigest: string;
  fixtures: readonly Fixture[];
  trainingSchedule: readonly PairDefinition[];
  holdoutSchedule: readonly PairDefinition[];
  trainingChoices: readonly ChoiceRecord[];
  adapter: LanguageAdapter;
}

function assertBlindSplit(
  fixtures: readonly Fixture[],
  trainingSchedule: readonly PairDefinition[],
  holdoutSchedule: readonly PairDefinition[]
): void {
  const byId = new Map(fixtures.map((fixture) => [fixture.id, fixture]));
  const trainingIds = new Set(trainingSchedule.flatMap((pair) => [pair.leftId, pair.rightId]));
  const holdoutIds = new Set(holdoutSchedule.flatMap((pair) => [pair.leftId, pair.rightId]));
  const trainingGroups = new Set<string>();
  const trainingNearGroups = new Set<string>();

  for (const id of trainingIds) {
    const fixture = byId.get(id);
    if (!fixture || fixture.split !== "training") throw new Error(`Invalid training fixture: ${id}`);
    trainingGroups.add(fixture.source_group);
    trainingNearGroups.add(fixture.near_duplicate_group);
  }

  for (const id of holdoutIds) {
    const fixture = byId.get(id);
    if (!fixture || fixture.split !== "holdout") throw new Error(`Invalid holdout fixture: ${id}`);
    if (trainingIds.has(id)) throw new Error(`Fixture leakage: ${id}`);
    if (trainingGroups.has(fixture.source_group)) throw new Error(`Source group leakage: ${id}`);
    if (trainingNearGroups.has(fixture.near_duplicate_group)) {
      throw new Error(`Near-duplicate leakage: ${id}`);
    }
  }
}

export function createProfileLock(input: FreezeInput): ProfileLock {
  assertBlindSplit(input.fixtures, input.trainingSchedule, input.holdoutSchedule);
  const profile = fitRanker(input.fixtures, input.trainingSchedule, input.trainingChoices);
  const trainingInputDigest = demoDigest({
    context: "long-study-photo-visual",
    choices: input.trainingChoices.map(({ pairId, leftId, rightId, value }) => ({
      pairId,
      leftId,
      rightId,
      value
    })),
    fixtureSetVersion: input.fixtureSetVersion,
    fixtureBundleDigest: input.fixtureManifestDigest,
    basisVersion: profile.basisVersion,
    algorithmVersion: profile.algorithmVersion
  });
  const holdoutPredictions = input.holdoutSchedule.map((pair) =>
    predictPair(profile, pair, input.fixtures)
  );
  const language = generateLanguageSafely(input.adapter, {
    context: "long-study-photo-visual",
    profile,
    fixtureSetVersion: input.fixtureSetVersion
  });
  const lineupSeed = demoDigest(`${trainingInputDigest}:lineup`);
  const perturbationSeed = demoDigest(`${trainingInputDigest}:perturbation`);
  const partialLock = {
    lockVersion: "profile-lock-v1" as const,
    context: "long-study-photo-visual" as const,
    createdAt: input.now,
    displayTheme: input.displayTheme,
    viewportClass: input.viewportClass,
    fixtureSetVersion: input.fixtureSetVersion,
    fixtureManifestDigest: input.fixtureManifestDigest,
    trainingInputDigest,
    algorithmVersion: "feature-difference-demo-v1" as const,
    thresholdVersion: "demo-thresholds-v1" as const,
    profile,
    holdoutSchedule: [...input.holdoutSchedule],
    holdoutPredictions,
    axisBundle: language.bundle,
    delivery: language.delivery,
    lineupPlan: buildLineupPlan(language.bundle, lineupSeed),
    perturbationPlan: buildPerturbationPlan(language.bundle, perturbationSeed)
  };

  return { ...partialLock, lockDigest: demoDigest(partialLock) };
}
