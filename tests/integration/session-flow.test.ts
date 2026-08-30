import { describe, expect, it } from "vitest";
import { HOLDOUT_SCHEDULE, TRAINING_SCHEDULE } from "../../src/data/schedule";
import { createProfileLock } from "../../src/domain/freeze";
import { DeterministicTemplateAdapter } from "../../src/domain/language";
import { createInitialSession, sessionReducer } from "../../src/session/reducer";
import { TEST_MANIFEST } from "../fixtures";

describe("session phase integrity", () => {
  it("keeps lock immutable through holdout and gates reason until axis review", () => {
    let state = createInitialSession({ theme: "light", viewportClass: "desktop", sessionId: "test" });
    const beforeReason = sessionReducer(state, { type: "SET_SECONDARY_NOTE", note: "should not persist" });
    expect(beforeReason).toBe(state);

    state = sessionReducer(state, {
      type: "LOCK_CONTEXT",
      now: "2026-08-30T00:00:00.000Z",
      fixtureSetVersion: TEST_MANIFEST.fixture_set_version,
      bundleDigest: "demo-bundle"
    });
    for (const pair of TRAINING_SCHEDULE) {
      const value = pair.id === "t04" || pair.id === "t05" || pair.id === "t06" ? "right" : "left";
      state = sessionReducer(state, {
        type: "RECORD_TRAINING",
        pair,
        value,
        now: "2026-08-30T00:00:01.000Z"
      });
    }
    const lock = createProfileLock({
      now: "2026-08-30T00:00:02.000Z",
      displayTheme: state.displayTheme,
      viewportClass: state.viewportClass,
      fixtureSetVersion: TEST_MANIFEST.fixture_set_version,
      fixtureManifestDigest: "manifest-demo",
      fixtures: TEST_MANIFEST.fixtures,
      trainingSchedule: TRAINING_SCHEDULE,
      holdoutSchedule: HOLDOUT_SCHEDULE,
      trainingChoices: state.trainingChoices,
      adapter: new DeterministicTemplateAdapter()
    });
    state = sessionReducer(state, { type: "LOCK_PROFILE", lock });
    const frozenDigest = state.lock?.lockDigest;

    const attemptedTrainingUndo = sessionReducer(state, { type: "UNDO_TRAINING" });
    expect(attemptedTrainingUndo).toBe(state);

    for (const pair of HOLDOUT_SCHEDULE) {
      state = sessionReducer(state, {
        type: "RECORD_HOLDOUT",
        pair,
        value: "left",
        now: "2026-08-30T00:00:03.000Z"
      });
      expect(state.lock?.lockDigest).toBe(frozenDigest);
    }
    state = sessionReducer(state, { type: "COMPLETE_HOLDOUT" });
    const lineupSelection = state.lock?.lineupPlan.order[0];
    if (!lineupSelection) throw new Error("Missing lineup selection");
    state = sessionReducer(state, { type: "SUBMIT_LINEUP", selection: lineupSelection });
    const perturbationSelection = state.lock?.perturbationPlan.order[0];
    if (!perturbationSelection) throw new Error("Missing perturbation selection");
    state = sessionReducer(state, { type: "SUBMIT_PERTURBATION", selection: perturbationSelection });
    expect(state.phase).toBe("axis-review");
    state = sessionReducer(state, { type: "SET_SECONDARY_NOTE", note: "local note" });
    expect(state.secondaryNote).toBe("local note");
    expect(state.lock?.lockDigest).toBe(frozenDigest);
  });

  it("rejects unsupported rename without changing axis state", () => {
    let state = createInitialSession({ theme: "light", viewportClass: "desktop", sessionId: "test" });
    state = { ...state, phase: "axis-review", editableAxes: [{ id: "axis-openness", componentAxisIds: ["axis-openness"], label: "开阔视线", status: "pending" }] };
    const next = sessionReducer(state, {
      type: "RENAME_AXIS",
      axisId: "axis-openness",
      label: "插座充足而且很安静",
      now: "2026-08-30T00:00:00.000Z"
    });
    expect(next.editableAxes).toEqual(state.editableAxes);
    expect(next.lastNotice).toMatch(/照片无法验证的信息/);
  });
});
