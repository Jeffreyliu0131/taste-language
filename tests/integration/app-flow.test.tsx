import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { App, type AppServices } from "../../src/App";
import { DEMO_PERSONA, HOLDOUT_SCHEDULE, TRAINING_SCHEDULE } from "../../src/data/schedule";
import { DeterministicTemplateAdapter } from "../../src/domain/language";
import { MemoryStorageAdapter } from "../../src/storage/sessionStorage";
import { TEST_MANIFEST } from "../fixtures";

function services(): AppServices {
  return {
    storage: new MemoryStorageAdapter(),
    languageAdapter: new DeterministicTemplateAdapter(),
    loadFixtures: () => Promise.resolve({
      manifest: TEST_MANIFEST,
      assetUrls: Object.fromEntries(
        TEST_MANIFEST.fixtures.map((fixture) => [fixture.id, `blob:http://local/${fixture.id}`])
      ),
      dispose: () => undefined
    }),
    now: () => "2026-08-30T00:00:00.000Z",
    makeSessionId: () => "ui-test"
  };
}

describe("complete local vertical slice", () => {
  it("runs context, training, holdout, lineup, edit and separated results", async () => {
    const user = userEvent.setup();
    render(<App services={services()} />);

    await screen.findByRole("heading", { name: /只判断照片里看得见的偏好/ });
    await user.click(screen.getByRole("button", { name: /确认情境/ }));

    for (const pair of TRAINING_SCHEDULE) {
      const choice = DEMO_PERSONA.trainingChoices[pair.id];
      await user.click(screen.getByRole("button", { name: choice === "left" ? "选择 A" : "选择 B" }));
    }
    expect(await screen.findByRole("heading", { name: /确认冻结后/ })).toHaveFocus();
    await user.click(screen.getByRole("button", { name: /确认冻结/ }));

    for (const pair of HOLDOUT_SCHEDULE) {
      const choice = DEMO_PERSONA.holdoutChoices[pair.id];
      await user.click(screen.getByRole("button", { name: choice === "left" ? "选择 A" : "选择 B" }));
    }
    expect(await screen.findByRole("heading", { name: /预测仍然隐藏/ })).toHaveFocus();
    await user.click(screen.getByRole("button", { name: /继续辨认候选语言/ }));
    expect(await screen.findByRole("heading", { name: /哪一组说法/ })).toHaveFocus();

    const lineupRadios = screen.getAllByRole("radio");
    const firstLineup = lineupRadios[0];
    if (!firstLineup) throw new Error("Missing lineup option");
    await user.click(firstLineup);
    await user.click(screen.getByRole("button", { name: /确认这组说法/ }));
    expect(await screen.findByRole("heading", { name: /方向换过以后/ })).toHaveFocus();

    const perturbationRadios = screen.getAllByRole("radio");
    const firstPerturbation = perturbationRadios[0];
    if (!firstPerturbation) throw new Error("Missing perturbation option");
    await user.click(firstPerturbation);
    await user.click(screen.getByRole("button", { name: /确认方向/ }));

    expect(await screen.findByRole("heading", { name: /检查证据/ })).toHaveFocus();
    while (screen.queryAllByText("待处置").length > 0) {
      await user.click(screen.getByRole("button", { name: /^接受$/ }));
      const pendingButtons = screen.queryAllByRole("button", { name: /待处置/ });
      const nextPending = pendingButtons[0];
      if (nextPending) await user.click(nextPending);
      else break;
    }
    await user.click(screen.getByRole("button", { name: /查看分开的三份结果/ }));

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: /结果分为三份记录/ })).toBeInTheDocument()
    );
    expect(screen.getByRole("heading", { name: /结果分为三份记录/ })).toHaveFocus();
    expect(screen.getByRole("heading", { name: /3 组未见照片/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "语言辨认与编辑" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "运行与交付状态" })).toBeInTheDocument();
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
  });

  it("keeps an all-neutral path at zero axes and abstains without invented language", async () => {
    const user = userEvent.setup();
    render(<App services={services()} />);

    await screen.findByRole("heading", { name: /只判断照片里看得见的偏好/ });
    await user.click(screen.getByRole("button", { name: /确认情境/ }));
    for (let index = 0; index < TRAINING_SCHEDULE.length; index += 1) {
      await user.click(screen.getByRole("button", { name: "同样适合" }));
    }
    await user.click(screen.getByRole("button", { name: /确认冻结/ }));
    for (let index = 0; index < HOLDOUT_SCHEDULE.length; index += 1) {
      await user.click(screen.getByRole("button", { name: "看不出来" }));
    }
    await user.click(screen.getByRole("button", { name: /继续辨认候选语言/ }));

    expect(await screen.findByRole("heading", { name: "当前证据支持 0 个候选轴" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /记录为无法对照/ }));
    expect(await screen.findByRole("heading", { name: /没有可比较的双轴候选语言/ })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /记录为无法对照/ }));

    expect(await screen.findByRole("heading", { name: /检查证据/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "当前证据支持 0 个候选轴" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /查看分开的三份结果/ }));
    expect(await screen.findByRole("heading", { name: /结果分为三份记录/ })).toBeInTheDocument();
    expect(screen.getAllByText("保留拒答：0 个轴")).toHaveLength(HOLDOUT_SCHEDULE.length);
    expect(screen.getByText("0 个轴。系统保留拒答，没有补写描述。")).toBeInTheDocument();
  });
});
