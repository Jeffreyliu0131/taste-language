import { describe, expect, it } from "vitest";
import { TRAINING_SCHEDULE } from "../data/schedule";
import { buildLineupPlan, buildPerturbationPlan } from "./lineup";
import { fitRanker } from "./ranker";
import type { AxisBundle } from "./types";
import { TEST_MANIFEST, trainingChoiceRecords } from "../../tests/fixtures";

function twoAxisBundle(): AxisBundle {
  const profile = fitRanker(TEST_MANIFEST.fixtures, TRAINING_SCHEDULE, trainingChoiceRecords());
  expect(profile.axes).toHaveLength(2);
  return {
    schemaVersion: "axis-bundle-v1",
    scope: "photo-visual-only",
    axes: profile.axes,
    generatedBy: "deterministic-template-adapter"
  };
}

describe("illustrative anti-Barnum plans", () => {
  it("builds four structurally matched, distinct two-axis candidates without truth cues", () => {
    const plan = buildLineupPlan(twoAxisBundle(), "seed");
    expect(plan.supported).toBe(true);
    expect(plan.candidates).toHaveLength(4);
    const statementSets = plan.candidates.map((candidate) => candidate.statements.join("|"));
    expect(new Set(statementSets).size).toBe(4);
    expect(new Set(plan.candidates.map((candidate) => candidate.counterevidence))).toEqual(
      new Set(["证据与反例将在提交后统一揭示。"])
    );
    expect(plan.candidates.every((candidate) => !("kind" in candidate) && !("isOwn" in candidate))).toBe(true);
  });

  it("fails closed for a one-axis bundle instead of duplicating controls", () => {
    const bundle = twoAxisBundle();
    const oneAxisBundle = { ...bundle, axes: bundle.axes.slice(0, 1) };
    expect(buildLineupPlan(oneAxisBundle, "seed").supported).toBe(false);
    expect(buildPerturbationPlan(oneAxisBundle, "seed").supported).toBe(false);
  });
});
