import { afterEach, describe, expect, it, vi } from "vitest";
import { createInitialSession, sessionReducer } from "../session/reducer";
import { LocalStorageAdapter, SESSION_STORAGE_KEY } from "./sessionStorage";
import { demoDigest } from "../domain/digest";
import { createProfileLock } from "../domain/freeze";
import { DeterministicTemplateAdapter } from "../domain/language";
import { HOLDOUT_SCHEDULE, TRAINING_SCHEDULE } from "../data/schedule";
import { holdoutChoiceRecords, TEST_MANIFEST, trainingChoiceRecords } from "../../tests/fixtures";

function completedSession() {
  let state = createInitialSession({ theme: "light", viewportClass: "desktop", sessionId: "completed" });
  state = sessionReducer(state, {
    type: "LOCK_CONTEXT",
    now: "2026-08-30T00:00:00.000Z",
    fixtureSetVersion: TEST_MANIFEST.fixture_set_version,
    bundleDigest: "demo-bundle"
  });
  for (const [index, pair] of TRAINING_SCHEDULE.entries()) {
    const choice = trainingChoiceRecords()[index];
    if (!choice) throw new Error("Missing training choice");
    state = sessionReducer(state, {
      type: "RECORD_TRAINING",
      pair,
      value: choice.value,
      now: choice.recordedAt
    });
  }
  const lock = createProfileLock({
    now: "2026-08-30T00:00:00.000Z",
    displayTheme: "light",
    viewportClass: "desktop",
    fixtureSetVersion: TEST_MANIFEST.fixture_set_version,
    fixtureManifestDigest: "demo-bundle",
    fixtures: TEST_MANIFEST.fixtures,
    trainingSchedule: TRAINING_SCHEDULE,
    holdoutSchedule: HOLDOUT_SCHEDULE,
    trainingChoices: state.trainingChoices,
    adapter: new DeterministicTemplateAdapter()
  });
  state = sessionReducer(state, { type: "LOCK_PROFILE", lock });
  for (const [index, pair] of HOLDOUT_SCHEDULE.entries()) {
    const choice = holdoutChoiceRecords()[index];
    if (!choice) throw new Error("Missing holdout choice");
    state = sessionReducer(state, {
      type: "RECORD_HOLDOUT",
      pair,
      value: choice.value,
      now: choice.recordedAt
    });
  }
  state = sessionReducer(state, { type: "COMPLETE_HOLDOUT" });
  state = sessionReducer(state, { type: "SUBMIT_LINEUP", selection: lock.lineupPlan.ownOpaqueId });
  state = sessionReducer(state, {
    type: "SUBMIT_PERTURBATION",
    selection: lock.perturbationPlan.ownOpaqueId
  });
  for (const axis of state.editableAxes) {
    state = sessionReducer(state, {
      type: "ACCEPT_AXIS",
      axisId: axis.id,
      now: "2026-08-30T00:02:00.000Z"
    });
  }
  return sessionReducer(state, { type: "FINISH_REVIEW" });
}

afterEach(() => vi.restoreAllMocks());

describe("local session storage", () => {
  it("round-trips one versioned envelope and rejects tampering", () => {
    window.localStorage.clear();
    const adapter = new LocalStorageAdapter();
    const state = createInitialSession({ theme: "light", viewportClass: "desktop", sessionId: "storage-test" });
    adapter.save(state);
    expect(adapter.load()).toEqual({ status: "ready", state });

    const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) throw new Error("Missing stored envelope");
    const envelope = JSON.parse(raw) as { payload: { revision: number } };
    envelope.payload.revision = 99;
    window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(envelope));
    expect(adapter.load()).toMatchObject({ status: "corrupt" });
  });

  it("rejects a deeply inconsistent session even when the envelope digest is recomputed", () => {
    window.localStorage.clear();
    const state = createInitialSession({ theme: "light", viewportClass: "desktop", sessionId: "storage-test" });
    const corrupt = { ...state, phase: "results" as const };
    window.localStorage.setItem(
      SESSION_STORAGE_KEY,
      JSON.stringify({
        schemaVersion: "storage-envelope-v1",
        revision: corrupt.revision,
        digest: demoDigest(corrupt),
        payload: corrupt
      })
    );
    expect(new LocalStorageAdapter().load()).toMatchObject({ status: "corrupt" });
  });

  it("rejects an impossible results phase even when the lock and envelope digests are valid", () => {
    window.localStorage.clear();
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
    const impossible = {
      ...createInitialSession({ theme: "light", viewportClass: "desktop", sessionId: "semantic-corrupt" }),
      phase: "results" as const,
      contextLockedAt: "2026-08-30T00:00:00.000Z",
      boundFixtureSetVersion: TEST_MANIFEST.fixture_set_version,
      boundFixtureBundleDigest: "demo-bundle",
      lock
    };
    window.localStorage.setItem(
      SESSION_STORAGE_KEY,
      JSON.stringify({
        schemaVersion: "storage-envelope-v1",
        revision: impossible.revision,
        digest: demoDigest(impossible),
        payload: impossible
      })
    );
    expect(new LocalStorageAdapter().load()).toMatchObject({ status: "corrupt" });
  });

  it("rejects context state that carries partial training progress", () => {
    window.localStorage.clear();
    const firstChoice = trainingChoiceRecords()[0];
    if (!firstChoice) throw new Error("Missing first training choice");
    const corrupt = {
      ...createInitialSession({ theme: "light", viewportClass: "desktop", sessionId: "context-progress" }),
      trainingCursor: 1,
      trainingChoices: [firstChoice]
    };
    window.localStorage.setItem(
      SESSION_STORAGE_KEY,
      JSON.stringify({
        schemaVersion: "storage-envelope-v1",
        revision: corrupt.revision,
        digest: demoDigest(corrupt),
        payload: corrupt
      })
    );
    expect(new LocalStorageAdapter().load()).toMatchObject({ status: "corrupt" });
  });

  it("rejects results that drop the editable coverage of a frozen two-axis bundle", () => {
    window.localStorage.clear();
    const valid = completedSession();
    const corrupt = { ...valid, editableAxes: [], axisUndoStack: [], axisEdits: [] };
    window.localStorage.setItem(
      SESSION_STORAGE_KEY,
      JSON.stringify({
        schemaVersion: "storage-envelope-v1",
        revision: corrupt.revision,
        digest: demoDigest(corrupt),
        payload: corrupt
      })
    );
    expect(new LocalStorageAdapter().load()).toMatchObject({ status: "corrupt" });
  });

  it("fails closed when browser storage access throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });
    expect(new LocalStorageAdapter().load()).toMatchObject({ status: "unavailable" });
  });

  it("removes only the Taste Language key", () => {
    window.localStorage.clear();
    window.localStorage.setItem("another-app:key", "keep");
    const adapter = new LocalStorageAdapter();
    adapter.save(createInitialSession({ theme: "light", viewportClass: "desktop", sessionId: "storage-test" }));
    adapter.remove();
    expect(window.localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
    expect(window.localStorage.getItem("another-app:key")).toBe("keep");
  });
});
