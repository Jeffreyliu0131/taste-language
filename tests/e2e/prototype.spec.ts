import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { DEMO_PERSONA, HOLDOUT_SCHEDULE, TRAINING_SCHEDULE } from "../../src/data/schedule";
import { demoDigest } from "../../src/domain/digest";

const EVIDENCE_DIR = "test-results/evidence";
const SCREENSHOT_DIR = `${EVIDENCE_DIR}/screenshots`;

interface StoredEnvelopeForTest {
  digest: string;
  payload: Record<string, unknown> & { boundFixtureBundleDigest: string };
}

function requiredChoice(value: unknown): "left" | "right" {
  if (value === "left" || value === "right") return value;
  throw new Error("Demo path requires a directional choice");
}

function observeExternalNetwork(page: Page): string[] {
  const externalRequests: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if ((url.protocol === "http:" || url.protocol === "https:") && url.hostname !== "127.0.0.1") {
      externalRequests.push(url.href);
    }
  });
  return externalRequests;
}

async function expectNoSeriousA11yViolations(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  const serious = results.violations.filter(
    (violation) => violation.impact === "serious" || violation.impact === "critical"
  );
  expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);
}

async function expectNoHorizontalOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
}

async function screenshot(page: Page, name: string) {
  await mkdir(SCREENSHOT_DIR, { recursive: true });
  await page.screenshot({ path: `${SCREENSHOT_DIR}/${name}`, fullPage: true });
}

async function pressButton(page: Page, name: string | RegExp) {
  await page.getByRole("button", { name }).press("Enter");
}

async function expectFocusedStage(page: Page, name: string | RegExp) {
  const heading = page.getByRole("heading", { name });
  await expect(heading).toBeFocused();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  const headingBox = await heading.boundingBox();
  const headerBox = await page.locator(".experiment-bar").boundingBox();
  expect(headingBox?.y ?? -1).toBeGreaterThanOrEqual((headerBox?.height ?? 0) - 1);
}

async function choosePair(page: Page, value: "left" | "right", keyboard: boolean) {
  if (keyboard) await page.keyboard.press(value === "left" ? "a" : "b");
  else await page.getByRole("button", { name: value === "left" ? "选择 A" : "选择 B" }).click();
}

async function completeDemoFlow(
  page: Page,
  options: {
    keyboard: boolean;
    captureDesktop?: boolean;
    onAxisReview?: () => Promise<void>;
    stopAtAxisReview?: boolean;
  }
) {
  if (options.captureDesktop) await screenshot(page, "desktop-context.png");
  if (options.keyboard) await pressButton(page, /确认情境/);
  else await page.getByRole("button", { name: /确认情境/ }).click();
  await expectFocusedStage(page, /独自长时间学习时/);
  if (options.captureDesktop) await screenshot(page, "desktop-training-pair.png");

  for (const pair of TRAINING_SCHEDULE) {
    await choosePair(page, requiredChoice(DEMO_PERSONA.trainingChoices[pair.id]), options.keyboard);
  }
  await expectFocusedStage(page, /确认冻结后/);
  if (options.captureDesktop) await screenshot(page, "desktop-freeze.png");

  if (options.keyboard) await pressButton(page, /确认冻结/);
  else await page.getByRole("button", { name: /确认冻结/ }).click();
  await expectFocusedStage(page, /独自长时间学习时/);
  if (options.captureDesktop) await screenshot(page, "desktop-holdout.png");

  for (const pair of HOLDOUT_SCHEDULE) {
    await choosePair(page, requiredChoice(DEMO_PERSONA.holdoutChoices[pair.id]), options.keyboard);
  }
  await expectFocusedStage(page, /预测仍然隐藏/);
  if (options.captureDesktop) await screenshot(page, "desktop-holdout-complete.png");

  if (options.keyboard) await pressButton(page, /继续辨认候选语言/);
  else await page.getByRole("button", { name: /继续辨认候选语言/ }).click();
  await expectFocusedStage(page, /哪一组说法/);
  if (options.captureDesktop) await screenshot(page, "desktop-lineup.png");

  const lineupRadio = page.getByRole("radio").first();
  if (options.keyboard) await lineupRadio.press("Space");
  else await lineupRadio.check();
  if (options.keyboard) await pressButton(page, /确认这组说法/);
  else await page.getByRole("button", { name: /确认这组说法/ }).click();
  await expectFocusedStage(page, /方向换过以后/);
  if (options.captureDesktop) await screenshot(page, "desktop-perturbation.png");

  const directionRadio = page.getByRole("radio").first();
  if (options.keyboard) await directionRadio.press("Space");
  else await directionRadio.check();
  if (options.keyboard) await pressButton(page, /确认方向/);
  else await page.getByRole("button", { name: /确认方向/ }).click();
  await expectFocusedStage(page, /检查证据/);
  if (options.captureDesktop) await screenshot(page, "desktop-axis-review.png");
  await options.onAxisReview?.();
  if (options.stopAtAxisReview) return;

  for (let index = 0; index < 2; index += 1) {
    if (options.keyboard) await pressButton(page, /^接受$/);
    else await page.getByRole("button", { name: /^接受$/ }).click();
    const nextPending = page.locator(".axis-index button").filter({ hasText: "待处置" }).first();
    if ((await nextPending.count()) === 0) break;
    if (options.keyboard) await nextPending.press("Enter");
    else await nextPending.click();
  }
  if (options.keyboard) await pressButton(page, /查看分开的三份结果/);
  else await page.getByRole("button", { name: /查看分开的三份结果/ }).click();
  await expectFocusedStage(page, /结果分为三份记录/);
}

test("desktop completes the full keyboard path, exports JSON, and captures every stage", async ({ page }, testInfo: TestInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium");
  const externalRequests = observeExternalNetwork(page);
  await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "light" });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /只判断照片里看得见的偏好/ })).toBeVisible();
  await expectNoSeriousA11yViolations(page);
  await completeDemoFlow(page, { keyboard: true, captureDesktop: true });

  await expect(page.getByRole("heading", { name: /3 组未见照片/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "语言辨认与编辑" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "运行与交付状态" })).toBeVisible();
  await expect(page.getByText(/合成演示.*不代表准确率/)).toBeVisible();
  await expect(page.getByText(/不能据此宣称需求已验证/)).toBeVisible();

  const visibleText = await page.locator("body").innerText();
  expect(visibleText).not.toContain("%");
  expect(visibleText).not.toContain("—");
  expect(visibleText).not.toContain("–");
  const activeAnimations = await page.evaluate(() =>
    document.getAnimations().filter((animation) => animation.playState === "running").length
  );
  expect(activeAnimations).toBe(0);
  expect(externalRequests).toEqual([]);
  await expectNoHorizontalOverflow(page);
  await expectNoSeriousA11yViolations(page);

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出本地记录" }).click();
  const download = await downloadPromise;
  const downloadPath = await download.path();
  if (!downloadPath) throw new Error("Export download did not produce a local file");
  const exported = JSON.parse(await readFile(downloadPath, "utf8")) as {
    records: {
      choice_prediction: { frozen_predictions: Array<{ probability: null }> };
      language_response: { lineup: { frozen_candidate_position: string } };
      delivery_state: { probability_contract: null };
    };
  };
  expect(exported.records.choice_prediction.frozen_predictions.every((item) => item.probability === null)).toBe(true);
  expect(exported.records.language_response.lineup.frozen_candidate_position).toMatch(/^[A-D]$/);
  expect(exported.records.delivery_state.probability_contract).toBeNull();
  expect(JSON.stringify(exported)).not.toContain("ownOpaqueId");

  const metrics = await page.evaluate(() => {
    const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    const resources = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
    return {
      domContentLoadedMs: navigation?.domContentLoadedEventEnd ?? null,
      loadEventMs: navigation?.loadEventEnd ?? null,
      transferBytes: resources.reduce((sum, resource) => sum + resource.transferSize, 0),
      resourceCount: resources.length,
      buildAssets: resources
        .map((resource) => resource.name)
        .filter((name) => name.includes("/assets/"))
        .map((name) => name.split("/").pop())
    };
  });
  const recordedMetrics = { ...metrics, externalRequestCount: externalRequests.length };
  await testInfo.attach("performance-baseline.json", {
    body: JSON.stringify(recordedMetrics, null, 2),
    contentType: "application/json"
  });
  await mkdir(EVIDENCE_DIR, { recursive: true });
  await writeFile(`${EVIDENCE_DIR}/performance-baseline.json`, `${JSON.stringify(recordedMetrics, null, 2)}\n`, "utf8");
  console.log(`PERF_BASELINE ${JSON.stringify(recordedMetrics)}`);
  await screenshot(page, "desktop-results.png");
});

test("mobile dark keeps A and B in the same initial decision view and completes", async ({ page }, testInfo: TestInfo) => {
  test.skip(testInfo.project.name !== "mobile-chromium");
  const externalRequests = observeExternalNetwork(page);
  await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "light" });
  await page.goto("/");
  for (const label of ["切换到深色", "查看范围与数据边界", "清除本浏览器实验状态"]) {
    const target = await page.getByRole("button", { name: label }).boundingBox();
    expect(target?.width).toBeGreaterThanOrEqual(44);
    expect(target?.height).toBeGreaterThanOrEqual(44);
  }
  const contextCta = await page.getByRole("button", { name: /确认情境/ }).boundingBox();
  expect(contextCta?.height).toBeGreaterThanOrEqual(44);
  await page.getByRole("button", { name: "切换到深色" }).click();
  await expect(page.locator(".app-frame")).toHaveAttribute("data-theme", "dark");
  await expectNoSeriousA11yViolations(page);
  await page.getByRole("button", { name: /确认情境/ }).click();
  const aImage = page.getByAltText("合成空间图像 A");
  const bImage = page.getByAltText("合成空间图像 B");
  await expect(aImage).toBeVisible();
  await expect(bImage).toBeVisible();
  for (const label of ["选择 A", "选择 B", "同样适合", "看不出来", "撤销上一题"]) {
    const target = await page.getByRole("button", { name: label }).boundingBox();
    expect(target?.height).toBeGreaterThanOrEqual(44);
  }
  const aBox = await aImage.boundingBox();
  const bBox = await bImage.boundingBox();
  expect(aBox?.width).toBeCloseTo(bBox?.width ?? 0, 0);
  expect(aBox?.height).toBeCloseTo(bBox?.height ?? 0, 0);
  expect(aBox?.y).toBeCloseTo(bBox?.y ?? 0, 0);
  expect((aBox?.y ?? 0) + (aBox?.height ?? 0)).toBeLessThanOrEqual(844);
  expect((bBox?.y ?? 0) + (bBox?.height ?? 0)).toBeLessThanOrEqual(844);
  await expectNoHorizontalOverflow(page);
  await expectNoSeriousA11yViolations(page);
  await screenshot(page, "mobile-pair-dark.png");

  for (const pair of TRAINING_SCHEDULE) await choosePair(page, requiredChoice(DEMO_PERSONA.trainingChoices[pair.id]), false);
  await expectNoSeriousA11yViolations(page);
  await page.getByRole("button", { name: /确认冻结/ }).click();
  for (const pair of HOLDOUT_SCHEDULE) await choosePair(page, requiredChoice(DEMO_PERSONA.holdoutChoices[pair.id]), false);
  await page.getByRole("button", { name: /继续辨认候选语言/ }).click();
  await expectNoSeriousA11yViolations(page);
  await page.getByRole("radio").first().check();
  await page.getByRole("button", { name: /确认这组说法/ }).click();
  await expectNoSeriousA11yViolations(page);
  await page.getByRole("radio").first().check();
  await page.getByRole("button", { name: /确认方向/ }).click();
  await expectNoSeriousA11yViolations(page);

  const renameInput = page.getByLabel("新的候选轴名称");
  await renameInput.fill("安静且插座充足");
  await page.getByRole("button", { name: "保存名称" }).click();
  await expect(renameInput).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByRole("alert").filter({ hasText: /照片无法验证的信息/ })).toBeVisible();
  await screenshot(page, "mobile-unsupported-rename-dark.png");

  for (let index = 0; index < 2; index += 1) {
    await page.getByRole("button", { name: /^接受$/ }).click();
    const nextPending = page.locator(".axis-index button").filter({ hasText: "待处置" }).first();
    if ((await nextPending.count()) === 0) break;
    await nextPending.click();
  }
  await page.getByRole("button", { name: /查看分开的三份结果/ }).click();
  await expect(page.getByRole("heading", { name: /结果分为三份记录/ })).toBeVisible();
  for (const target of ["choice-ledger-title", "language-ledger-title", "delivery-ledger-title"]) {
    await page.locator(`.result-jump-nav a[href="#${target}"]`).click();
    const targetBox = await page.locator(`#${target}`).boundingBox();
    const stickyHeader = await page.locator(".experiment-bar").boundingBox();
    expect(targetBox?.y ?? -1).toBeGreaterThanOrEqual((stickyHeader?.height ?? 0) - 1);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await expectNoHorizontalOverflow(page);
  await expectNoSeriousA11yViolations(page);
  expect(externalRequests).toEqual([]);
  await screenshot(page, "mobile-results-dark.png");
});

test("zero-axis path abstains and never invents language", async ({ page }, testInfo: TestInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium");
  await page.goto("/");
  await page.getByRole("button", { name: /确认情境/ }).click();
  for (let index = 0; index < TRAINING_SCHEDULE.length; index += 1) await page.getByRole("button", { name: "同样适合" }).click();
  await page.getByRole("button", { name: /确认冻结/ }).click();
  for (let index = 0; index < HOLDOUT_SCHEDULE.length; index += 1) await page.getByRole("button", { name: "看不出来" }).click();
  await page.getByRole("button", { name: /继续辨认候选语言/ }).click();
  await expect(page.getByRole("heading", { name: "当前证据支持 0 个候选轴" })).toBeVisible();
  await screenshot(page, "desktop-zero-axis.png");
  await page.getByRole("button", { name: /记录为无法对照/ }).click();
  await page.getByRole("button", { name: /记录为无法对照/ }).click();
  await page.getByRole("button", { name: /查看分开的三份结果/ }).click();
  await expect(page.getByText("0 个轴。系统保留拒答，没有补写描述。")).toBeVisible();
  await expect(page.getByText("保留拒答：0 个轴").first()).toBeVisible();
});

test("one-axis path fails closed instead of duplicating language controls", async ({ page }, testInfo: TestInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium");
  await page.goto("/");
  await page.getByRole("button", { name: /确认情境/ }).click();
  const oneAxisSequence = ["right", "left", "right", "left", "left", "left"] as const;
  for (const value of oneAxisSequence) await choosePair(page, value, false);
  await page.getByRole("button", { name: /确认冻结/ }).click();
  for (const pair of HOLDOUT_SCHEDULE) await choosePair(page, requiredChoice(DEMO_PERSONA.holdoutChoices[pair.id]), false);
  await page.getByRole("button", { name: /继续辨认候选语言/ }).click();
  await expect(page.getByRole("heading", { name: /只有 1 个候选轴/ })).toBeVisible();
  await expect(page.getByRole("radio")).toHaveCount(0);
  await screenshot(page, "desktop-one-axis.png");
});

test("language adapter failure remains a separate visible delivery state", async ({ page }, testInfo: TestInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium");
  await page.goto("/");
  await completeDemoFlow(page, { keyboard: false, stopAtAxisReview: true });
  const envelope = await page.evaluate(() => {
    const raw = localStorage.getItem("taste-language:session-v1");
    if (!raw) throw new Error("Missing stored session");
    return JSON.parse(raw) as StoredEnvelopeForTest;
  });
  const lock = envelope.payload.lock as Record<string, unknown>;
  lock.delivery = {
    status: "failed",
    code: "LANGUAGE_ADAPTER_FAILURE",
    message: "语言模块没有返回符合照片可见边界的标签。"
  };
  const lockPayload = { ...lock };
  delete lockPayload.lockDigest;
  lock.lockDigest = demoDigest(lockPayload);
  envelope.digest = demoDigest(envelope.payload);
  await page.evaluate((value) => localStorage.setItem("taste-language:session-v1", JSON.stringify(value)), envelope);
  await page.reload();

  await expect(page.getByText(/候选语言生成失败/)).toBeVisible();
  await expect(page.getByRole("heading", { name: /检查证据/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "当前证据支持 0 个候选轴" })).toHaveCount(0);
  await screenshot(page, "adapter-failure.png");
});

test("fixture delivery failure hard-stops the experience", async ({ page }, testInfo: TestInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium");
  await page.route("**/fixtures/f12-warm-pavilion.jpg", (route) => route.abort("failed"));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "本地照片校验失败" })).toBeFocused();
  await expect(page.getByRole("button", { name: "选择 A" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /重新校验 12 张照片/ })).toBeVisible();
  await screenshot(page, "fixture-error.png");
});

test("bundle mismatch offers export and explicit reset recovery", async ({ page }, testInfo: TestInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium");
  await page.goto("/");
  await page.getByRole("button", { name: /确认情境/ }).click();
  const envelope = await page.evaluate(() => {
    const raw = localStorage.getItem("taste-language:session-v1");
    if (!raw) throw new Error("Missing stored session");
    return JSON.parse(raw) as StoredEnvelopeForTest;
  });
  envelope.payload.boundFixtureBundleDigest = "demo-incompatible";
  envelope.digest = demoDigest(envelope.payload);
  await page.evaluate((value) => localStorage.setItem("taste-language:session-v1", JSON.stringify(value)), envelope);
  await page.reload();
  await expect(page.getByRole("heading", { name: "照片版本与旧记录不一致" })).toBeFocused();
  await expect(page.getByRole("button", { name: "导出旧记录元数据" })).toBeVisible();
  await expect(page.getByRole("button", { name: "清除旧记录并重新开始" })).toBeVisible();
  await screenshot(page, "bundle-mismatch.png");
});

test("corrupt storage is preserved and blocks automatic continuation", async ({ page }, testInfo: TestInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium");
  await page.addInitScript(() => localStorage.setItem("taste-language:session-v1", "{not-valid-json"));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "保存的进度无法验证" })).toBeFocused();
  await expect(page.getByRole("button", { name: /确认情境/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "清除损坏记录并重新开始" })).toBeVisible();
  await screenshot(page, "corrupt-storage.png");
});

test("cross-tab clear pauses the peer and does not revive the old session", async ({ context, page }, testInfo: TestInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium");
  await page.goto("/");
  await page.getByRole("heading", { name: /只判断照片里看得见的偏好/ }).waitFor();
  const peer = await context.newPage();
  await peer.goto("/");
  await peer.getByRole("heading", { name: /只判断照片里看得见的偏好/ }).waitFor();
  const oldSessionId = await page.evaluate(() => {
    const raw = localStorage.getItem("taste-language:session-v1");
    return raw ? (JSON.parse(raw) as { payload: { sessionId: string } }).payload.sessionId : null;
  });

  await page.evaluate(() => localStorage.removeItem("taste-language:session-v1"));
  const dialog = peer.getByRole("alertdialog");
  await expect(dialog).toBeVisible();
  await expect.poll(() => peer.evaluate(() => {
    const activeDialog = document.querySelector('[role="alertdialog"]');
    return Boolean(activeDialog?.contains(document.activeElement));
  })).toBe(true);
  await expect(peer.getByRole("button", { name: /确认情境/ })).toHaveCount(0);

  await peer.getByRole("button", { name: "载入最新本地状态" }).click();
  await peer.getByRole("heading", { name: /只判断照片里看得见的偏好/ }).waitFor();
  const newSessionId = await peer.evaluate(() => {
    const raw = localStorage.getItem("taste-language:session-v1");
    return raw ? (JSON.parse(raw) as { payload: { sessionId: string } }).payload.sessionId : null;
  });
  expect(newSessionId).not.toBe(oldSessionId);
  await peer.close();
});

test("200 percent zoom-equivalent reflow has no horizontal overflow", async ({ page }, testInfo: TestInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium");
  await page.setViewportSize({ width: 640, height: 720 });
  await page.goto("/");
  await expectNoSeriousA11yViolations(page);
  await completeDemoFlow(page, {
    keyboard: false,
    onAxisReview: () => expectNoSeriousA11yViolations(page)
  });
  await expectNoSeriousA11yViolations(page);
  await expectNoHorizontalOverflow(page);
});
