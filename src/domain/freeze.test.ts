import { describe, expect, it } from "vitest";
import { HOLDOUT_SCHEDULE, TRAINING_SCHEDULE } from "../data/schedule";
import { createProfileLock } from "./freeze";
import { DeterministicTemplateAdapter, type LanguageAdapter } from "./language";
import { TEST_MANIFEST, trainingChoiceRecords } from "../../tests/fixtures";

function createLock(
  adapter: LanguageAdapter = new DeterministicTemplateAdapter(),
  choices = trainingChoiceRecords()
) {
  return createProfileLock({
    now: "2026-08-30T00:00:00.000Z",
    displayTheme: "light",
    viewportClass: "desktop",
    fixtureSetVersion: TEST_MANIFEST.fixture_set_version,
    fixtureManifestDigest: "manifest-demo",
    fixtures: TEST_MANIFEST.fixtures,
    trainingSchedule: TRAINING_SCHEDULE,
    holdoutSchedule: HOLDOUT_SCHEDULE,
    trainingChoices: choices,
    adapter
  });
}

describe("profile freeze", () => {
  it("locks predictions, language, lineup and perturbation before H1 responses exist", () => {
    const lock = createLock();
    expect(lock.holdoutPredictions).toHaveLength(3);
    expect(lock.holdoutPredictions.every((prediction) => prediction.probability === null)).toBe(true);
    expect(lock.axisBundle.axes).toEqual(lock.profile.axes);
    expect(lock.lineupPlan.candidates).toHaveLength(4);
    expect(lock.perturbationPlan.options).toHaveLength(2);
    expect(lock.lockDigest).toMatch(/^demo-/);
    expect(lock.lineupPlan.candidates.every((candidate) => !("kind" in candidate))).toBe(true);
  });

  it("keeps deterministic evidence while separating adapter failure", () => {
    const failingAdapter: LanguageAdapter = {
      id: "failing-test-adapter",
      proposeLabels() {
        throw new Error("synthetic adapter outage");
      }
    };
    const lock = createLock(failingAdapter);
    expect(lock.delivery.status).toBe("failed");
    expect(lock.axisBundle.axes).toEqual(lock.profile.axes);
    expect(lock.profile.wholeProfileAbstainReason).toBeNull();
  });

  it("rejects cross-axis or polarity-swapped adapter labels and preserves deterministic evidence", () => {
    const maliciousAdapter: LanguageAdapter = {
      id: "malicious-test-adapter",
      proposeLabels(input) {
        return input.profile.axes.map((axis) => ({
          axisId: axis.id,
          label: axis.key === "openness" ? "丰富层次" : "开阔视线",
          oppositeLabel: axis.key === "openness" ? "留白秩序" : "包裹边界"
        }));
      }
    };
    const lock = createLock(maliciousAdapter);
    expect(lock.delivery.status).toBe("failed");
    expect(lock.axisBundle.axes).toEqual(lock.profile.axes);
    expect(lock.axisBundle.generatedBy).toBe("deterministic-template-adapter");
  });

  it("isolates and deep-freezes the adapter projection before predictions and canonical evidence are exposed", () => {
    const baseline = createLock();
    let sawDeepFreeze = false;
    let mutationBlocked = false;
    const mutatingAdapter: LanguageAdapter = {
      id: "mutating-test-adapter",
      proposeLabels(input) {
        sawDeepFreeze =
          Object.isFrozen(input) &&
          Object.isFrozen(input.profile) &&
          Object.isFrozen(input.profile.beta) &&
          Object.isFrozen(input.profile.axes) &&
          Object.isFrozen(input.profile.axes[0]?.supportRefs);
        try {
          const writableBeta = input.profile.beta as unknown as { openness: number };
          writableBeta.openness = 999;
        } catch {
          mutationBlocked = true;
        }
        return input.profile.axes.map((axis) => ({
          axisId: axis.id,
          label: axis.label,
          oppositeLabel: axis.oppositeLabel
        }));
      }
    };

    const lock = createLock(mutatingAdapter);
    expect(sawDeepFreeze).toBe(true);
    expect(mutationBlocked).toBe(true);
    expect(lock.delivery).toEqual({ status: "delivered", adapter: "mutating-test-adapter" });
    expect(lock.profile).toEqual(baseline.profile);
    expect(lock.holdoutPredictions).toEqual(baseline.holdoutPredictions);
    expect(lock.axisBundle.axes).toEqual(baseline.profile.axes);
  });

  it("keeps model and lineup outputs stable when event timestamps change", () => {
    const first = createLock();
    const laterChoices = trainingChoiceRecords().map((choice) => ({
      ...choice,
      recordedAt: "2026-08-30T09:09:09.000Z"
    }));
    const second = createLock(new DeterministicTemplateAdapter(), laterChoices);
    expect(second.trainingInputDigest).toBe(first.trainingInputDigest);
    expect(second.profile).toEqual(first.profile);
    expect(second.holdoutPredictions).toEqual(first.holdoutPredictions);
    expect(second.lineupPlan.order).toEqual(first.lineupPlan.order);
  });

  it("hard-fails source-group leakage", () => {
    const fixtures = structuredClone(TEST_MANIFEST.fixtures);
    const holdout = fixtures.find((fixture) => fixture.id === "f07");
    if (!holdout) throw new Error("Missing fixture");
    holdout.source_group = "generated-f01";
    expect(() =>
      createProfileLock({
        now: "2026-08-30T00:00:00.000Z",
        displayTheme: "light",
        viewportClass: "desktop",
        fixtureSetVersion: TEST_MANIFEST.fixture_set_version,
        fixtureManifestDigest: "manifest-demo",
        fixtures,
        trainingSchedule: TRAINING_SCHEDULE,
        holdoutSchedule: HOLDOUT_SCHEDULE,
        trainingChoices: trainingChoiceRecords(),
        adapter: new DeterministicTemplateAdapter()
      })
    ).toThrow(/Source group leakage/);
  });
});
