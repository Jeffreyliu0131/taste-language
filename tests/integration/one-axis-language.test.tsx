import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { HOLDOUT_SCHEDULE, TRAINING_SCHEDULE } from "../../src/data/schedule";
import { createProfileLock } from "../../src/domain/freeze";
import { DeterministicTemplateAdapter } from "../../src/domain/language";
import { buildLineupPlan, buildPerturbationPlan } from "../../src/domain/lineup";
import { LineupScreen } from "../../src/screens/LineupScreen";
import { PerturbationScreen } from "../../src/screens/PerturbationScreen";
import { createInitialSession } from "../../src/session/reducer";
import { TEST_MANIFEST, trainingChoiceRecords } from "../fixtures";

function oneAxisSession() {
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
  const axis = lock.axisBundle.axes[0];
  if (!axis) throw new Error("Expected at least one axis");
  const axisBundle = { ...lock.axisBundle, axes: [axis] };
  const oneAxisLock = {
    ...lock,
    profile: { ...lock.profile, axes: [axis] },
    axisBundle,
    lineupPlan: buildLineupPlan(axisBundle, "one-axis"),
    perturbationPlan: buildPerturbationPlan(axisBundle, "one-axis")
  };
  return {
    ...createInitialSession({ theme: "light", viewportClass: "desktop", sessionId: "one-axis" }),
    phase: "lineup" as const,
    contextLockedAt: "2026-08-30T00:00:00.000Z",
    boundFixtureSetVersion: TEST_MANIFEST.fixture_set_version,
    boundFixtureBundleDigest: "demo-bundle",
    lock: oneAxisLock
  };
}

describe("one-axis language battery", () => {
  it("states that the four-way lineup is unsupported without calling one axis zero", async () => {
    const user = userEvent.setup();
    const dispatch = vi.fn();
    const session = oneAxisSession();
    const { rerender } = render(<LineupScreen session={session} dispatch={dispatch} />);
    expect(screen.getByRole("heading", { name: "当前只有 1 个候选轴，无法组成四项对照" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "当前证据支持 0 个候选轴" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /记录为无法对照/ }));
    expect(dispatch).toHaveBeenCalledWith({ type: "SUBMIT_LINEUP", selection: "unsupported" });

    rerender(<PerturbationScreen session={{ ...session, phase: "perturbation" }} dispatch={dispatch} />);
    expect(screen.getByText(/1 个轴无法组成结构一致的双轴方向对照/)).toBeInTheDocument();
  });
});
