import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HOLDOUT_SCHEDULE, TRAINING_SCHEDULE } from "../../src/data/schedule";
import { createProfileLock } from "../../src/domain/freeze";
import type { LanguageAdapter } from "../../src/domain/language";
import { AxisReviewScreen } from "../../src/screens/AxisReviewScreen";
import { createInitialSession } from "../../src/session/reducer";
import { TEST_MANIFEST, trainingChoiceRecords } from "../fixtures";

describe("language adapter delivery failure", () => {
  it("keeps deterministic evidence visible while reporting a separate delivery failure", () => {
    const adapter: LanguageAdapter = {
      id: "failing-adapter",
      proposeLabels() {
        throw new Error("adapter unavailable");
      }
    };
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
      adapter
    });
    const session = {
      ...createInitialSession({ theme: "light", viewportClass: "desktop", sessionId: "adapter-failure" }),
      phase: "axis-review" as const,
      contextLockedAt: "2026-08-30T00:00:00.000Z",
      boundFixtureSetVersion: TEST_MANIFEST.fixture_set_version,
      boundFixtureBundleDigest: "demo-bundle",
      lock,
      lineupSelection: "unsupported",
      perturbationSelection: "unsupported",
      editableAxes: lock.axisBundle.axes.map((axis) => ({
        id: axis.id,
        componentAxisIds: [axis.id],
        label: axis.label,
        status: "pending" as const
      }))
    };
    render(
      <AxisReviewScreen
        session={session}
        fixturesById={new Map(TEST_MANIFEST.fixtures.map((fixture) => [fixture.id, fixture]))}
        dispatch={vi.fn()}
        now={() => "2026-08-30T00:00:00.000Z"}
      />
    );
    const firstAxis = lock.profile.axes[0];
    if (!firstAxis) throw new Error("Expected deterministic fallback axis");
    expect(screen.getByText(/候选语言生成失败：语言模块没有返回符合照片可见边界的标签/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: firstAxis.label })).toBeInTheDocument();
    expect(lock.profile.wholeProfileAbstainReason).toBeNull();
  });
});
