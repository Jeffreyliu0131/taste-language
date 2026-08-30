import { describe, expect, it } from "vitest";
import { HOLDOUT_SCHEDULE, TRAINING_SCHEDULE } from "../data/schedule";
import { createProfileLock } from "../domain/freeze";
import { DeterministicTemplateAdapter } from "../domain/language";
import { createInitialSession } from "../session/reducer";
import { buildExport } from "./exportSession";
import { holdoutChoiceRecords, TEST_MANIFEST, trainingChoiceRecords } from "../../tests/fixtures";

describe("local export boundary", () => {
  it("exports versions and trace without image bytes or lineup ownership map", () => {
    const lock = createProfileLock({
      now: "2026-08-30T00:00:00.000Z",
      displayTheme: "light",
      viewportClass: "desktop",
      fixtureSetVersion: TEST_MANIFEST.fixture_set_version,
      fixtureManifestDigest: "demo-bundle",
      fixtures: TEST_MANIFEST.fixtures,
      trainingSchedule: TRAINING_SCHEDULE,
      holdoutSchedule: HOLDOUT_SCHEDULE,
      trainingChoices: trainingChoiceRecords(),
      adapter: new DeterministicTemplateAdapter()
    });
    const session = {
      ...createInitialSession({ theme: "light", viewportClass: "desktop", sessionId: "export-test" }),
      phase: "results" as const,
      contextLockedAt: "2026-08-30T00:00:00.000Z",
      boundFixtureSetVersion: TEST_MANIFEST.fixture_set_version,
      boundFixtureBundleDigest: "demo-bundle",
      trainingCursor: TRAINING_SCHEDULE.length,
      trainingChoices: trainingChoiceRecords(),
      holdoutCursor: HOLDOUT_SCHEDULE.length,
      holdoutChoices: holdoutChoiceRecords(),
      lock,
      lineupSelection: lock.lineupPlan.ownOpaqueId,
      perturbationSelection: lock.perturbationPlan.ownOpaqueId,
      editableAxes: lock.axisBundle.axes.map((axis) => ({
        id: axis.id,
        componentAxisIds: [axis.id],
        label: axis.label,
        status: "accepted" as const
      })),
      secondaryNote: "本地可选备注"
    };
    const serialized = JSON.stringify(buildExport(session, TEST_MANIFEST));
    expect(serialized).toContain(TEST_MANIFEST.fixture_set_version);
    expect(serialized).toContain("CC0-1.0");
    expect(serialized).toContain("urn:taste-language:fixture:f01");
    expect(serialized).not.toContain("openai-imagegen://");
    expect(serialized).toContain("本地可选备注");
    expect(serialized).not.toContain("ownOpaqueId");
    expect(serialized).toContain("language-response-record-v1");
    expect(serialized).toContain("frozen_candidate_position");
    expect(serialized).toContain("selected_frozen_candidate");
    expect(serialized).toContain("choice-prediction-record-v1");
    expect(serialized).toContain("delivery-state-record-v1");
    expect(serialized).not.toMatch(/data:image|\/9j\//);
    expect(serialized).toContain("fixture image bytes");
  });
});
