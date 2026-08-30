import { describe, expect, it } from "vitest";
import { createInitialSession, sessionReducer } from "../session/reducer";
import { HOLDOUT_SCHEDULE, TRAINING_SCHEDULE } from "./schedule";
import { computeFixtureBundleDigest, isSessionBundleCompatible } from "./bundleDigest";
import { TEST_MANIFEST, trainingChoiceRecords } from "../../tests/fixtures";
import { createProfileLock } from "../domain/freeze";
import { DeterministicTemplateAdapter } from "../domain/language";

describe("fixture bundle provenance", () => {
  it("changes digest for feature, rights and schedule changes", () => {
    const baseline = computeFixtureBundleDigest(TEST_MANIFEST, TRAINING_SCHEDULE, HOLDOUT_SCHEDULE);
    const featureChanged = structuredClone(TEST_MANIFEST);
    const first = featureChanged.fixtures[0];
    if (!first) throw new Error("Missing fixture");
    first.visible_features.openness += 0.1;
    expect(computeFixtureBundleDigest(featureChanged, TRAINING_SCHEDULE, HOLDOUT_SCHEDULE)).not.toBe(baseline);

    const rightsChanged = structuredClone(TEST_MANIFEST);
    rightsChanged.rights_note = "CHANGED-RIGHTS-NOTE";
    expect(computeFixtureBundleDigest(rightsChanged, TRAINING_SCHEDULE, HOLDOUT_SCHEDULE)).not.toBe(baseline);

    const disclosureChanged = structuredClone(TEST_MANIFEST);
    disclosureChanged.generation_disclosure = "CHANGED-GENERATION-DISCLOSURE";
    expect(computeFixtureBundleDigest(disclosureChanged, TRAINING_SCHEDULE, HOLDOUT_SCHEDULE)).not.toBe(baseline);

    const scheduleChanged = structuredClone(TRAINING_SCHEDULE);
    const pair = scheduleChanged[0];
    if (!pair) throw new Error("Missing pair");
    [pair.leftId, pair.rightId] = [pair.rightId, pair.leftId];
    expect(computeFixtureBundleDigest(TEST_MANIFEST, scheduleChanged, HOLDOUT_SCHEDULE)).not.toBe(baseline);
  });

  it("hard-stops a mid-training session when the current bundle changes", () => {
    const digest = computeFixtureBundleDigest(TEST_MANIFEST, TRAINING_SCHEDULE, HOLDOUT_SCHEDULE);
    let session = createInitialSession({ theme: "light", viewportClass: "desktop", sessionId: "bundle-test" });
    session = sessionReducer(session, {
      type: "LOCK_CONTEXT",
      now: "2026-08-30T00:00:00.000Z",
      fixtureSetVersion: TEST_MANIFEST.fixture_set_version,
      bundleDigest: digest
    });
    expect(isSessionBundleCompatible(session, TEST_MANIFEST, TRAINING_SCHEDULE, HOLDOUT_SCHEDULE)).toBe(true);
    const changed = structuredClone(TEST_MANIFEST);
    const first = changed.fixtures[0];
    if (!first) throw new Error("Missing fixture");
    first.visible_features.density += 0.1;
    expect(isSessionBundleCompatible(session, changed, TRAINING_SCHEDULE, HOLDOUT_SCHEDULE)).toBe(false);
  });

  it("hard-stops a frozen session when feature provenance changes", () => {
    const digest = computeFixtureBundleDigest(TEST_MANIFEST, TRAINING_SCHEDULE, HOLDOUT_SCHEDULE);
    const lock = createProfileLock({
      now: "2026-08-30T00:00:00.000Z",
      displayTheme: "light",
      viewportClass: "desktop",
      fixtureSetVersion: TEST_MANIFEST.fixture_set_version,
      fixtureManifestDigest: digest,
      fixtures: TEST_MANIFEST.fixtures,
      trainingSchedule: TRAINING_SCHEDULE,
      holdoutSchedule: HOLDOUT_SCHEDULE,
      trainingChoices: trainingChoiceRecords(),
      adapter: new DeterministicTemplateAdapter()
    });
    const session = {
      ...createInitialSession({ theme: "light", viewportClass: "desktop", sessionId: "frozen-bundle" }),
      phase: "holdout" as const,
      contextLockedAt: "2026-08-30T00:00:00.000Z",
      boundFixtureSetVersion: TEST_MANIFEST.fixture_set_version,
      boundFixtureBundleDigest: digest,
      trainingCursor: TRAINING_SCHEDULE.length,
      trainingChoices: trainingChoiceRecords(),
      lock
    };
    expect(isSessionBundleCompatible(session, TEST_MANIFEST, TRAINING_SCHEDULE, HOLDOUT_SCHEDULE)).toBe(true);
    const changed = structuredClone(TEST_MANIFEST);
    const first = changed.fixtures[0];
    if (!first) throw new Error("Missing fixture");
    first.style_tags.push("changed-style-control");
    expect(isSessionBundleCompatible(session, changed, TRAINING_SCHEDULE, HOLDOUT_SCHEDULE)).toBe(false);
  });
});
