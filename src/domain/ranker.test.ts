import { describe, expect, it } from "vitest";
import { HOLDOUT_SCHEDULE, TRAINING_SCHEDULE } from "../data/schedule";
import { fitRanker, predictPair } from "./ranker";
import { TEST_MANIFEST, neutralTrainingChoices, trainingChoiceRecords } from "../../tests/fixtures";

describe("feature-difference ranker", () => {
  it("fits at most two fixed-basis axes and keeps evidence training-only", () => {
    const profile = fitRanker(TEST_MANIFEST.fixtures, TRAINING_SCHEDULE, trainingChoiceRecords());
    expect(profile.axes.length).toBeGreaterThan(0);
    expect(profile.axes.length).toBeLessThanOrEqual(2);
    expect(profile.axes.every((axis) => axis.supportRefs.every((ref) => ref.pairId.startsWith("t")))).toBe(true);
    expect(profile.directionalCount).toBe(5);
    expect(profile.qcRepeatCount).toBe(1);
  });

  it("excludes tie and can't-tell from fit and allows zero-axis", () => {
    const profile = fitRanker(
      TEST_MANIFEST.fixtures,
      TRAINING_SCHEDULE,
      neutralTrainingChoices("tie")
    );
    expect(profile.directionalCount).toBe(0);
    expect(profile.axes).toEqual([]);
    expect(profile.wholeProfileAbstainReason).toBe("INSUFFICIENT_DIRECTIONAL_CHOICES");
  });

  it("is swap antisymmetric and never emits probability", () => {
    const profile = fitRanker(TEST_MANIFEST.fixtures, TRAINING_SCHEDULE, trainingChoiceRecords());
    const pair = HOLDOUT_SCHEDULE[0];
    if (!pair) throw new Error("Missing holdout pair");
    const prediction = predictPair(profile, pair, TEST_MANIFEST.fixtures);
    const swapped = predictPair(
      profile,
      { ...pair, id: "h01-swapped", leftId: pair.rightId, rightId: pair.leftId },
      TEST_MANIFEST.fixtures
    );
    expect(swapped.margin).toBeCloseTo(-prediction.margin, 10);
    expect(prediction.probability).toBeNull();
    expect(swapped.probability).toBeNull();
    if (prediction.ordinal !== "abstain") {
      expect(swapped.ordinal).toBe(prediction.ordinal === "left" ? "right" : "left");
    }
  });

  it("uses the repeated pair only for QC and can abstain on low margin", () => {
    const profile = fitRanker(TEST_MANIFEST.fixtures, TRAINING_SCHEDULE, trainingChoiceRecords());
    const pair = HOLDOUT_SCHEDULE[0];
    if (!pair) throw new Error("Missing holdout pair");
    const lowMarginProfile = {
      ...profile,
      beta: { openness: 0.01, density: 0.01 }
    };
    const prediction = predictPair(lowMarginProfile, pair, TEST_MANIFEST.fixtures);
    expect(prediction.ordinal).toBe("abstain");
    expect(prediction.abstainReason).toBe("LOW_MARGIN");
    expect(prediction.probability).toBeNull();
  });

  it("excludes a dimension that failed the axis gate from one-axis prediction margins", () => {
    const values = ["right", "left", "right", "left", "left", "left"] as const;
    const choices = TRAINING_SCHEDULE.map((pair, index) => ({
      pairId: pair.id,
      leftId: pair.leftId,
      rightId: pair.rightId,
      value: values[index] ?? "left",
      recordedAt: "2026-08-30T00:00:00.000Z"
    }));
    const profile = fitRanker(TEST_MANIFEST.fixtures, TRAINING_SCHEDULE, choices);
    expect(profile.axes.map((axis) => axis.key)).toEqual(["openness"]);
    expect(profile.beta.density).not.toBe(0);

    const pair = HOLDOUT_SCHEDULE[1];
    if (!pair) throw new Error("Missing holdout pair");
    const left = TEST_MANIFEST.fixtures.find((fixture) => fixture.id === pair.leftId);
    const right = TEST_MANIFEST.fixtures.find((fixture) => fixture.id === pair.rightId);
    if (!left || !right) throw new Error("Missing holdout fixtures");
    const activeAxisMargin =
      profile.beta.openness * (left.visible_features.openness - right.visible_features.openness);
    const prediction = predictPair(profile, pair, TEST_MANIFEST.fixtures);

    expect(prediction.margin).toBeCloseTo(activeAxisMargin, 10);
    expect(Math.abs(prediction.margin)).toBeLessThan(0.35);
    expect(prediction.ordinal).toBe("abstain");
    expect(prediction.abstainReason).toBe("LOW_MARGIN");
    expect(prediction.probability).toBeNull();
  });
});
