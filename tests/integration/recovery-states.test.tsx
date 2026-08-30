import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { App, type AppServices } from "../../src/App";
import type { VerifiedFixtureBundle } from "../../src/data/loadFixtures";
import { DeterministicTemplateAdapter } from "../../src/domain/language";
import { createInitialSession } from "../../src/session/reducer";
import type { StoragePort } from "../../src/storage/sessionStorage";
import { TEST_MANIFEST } from "../fixtures";

function verifiedBundle(): VerifiedFixtureBundle {
  return {
    manifest: TEST_MANIFEST,
    assetUrls: Object.fromEntries(
      TEST_MANIFEST.fixtures.map((fixture) => [fixture.id, `blob:http://local/${fixture.id}`])
    ),
    dispose: () => undefined
  };
}

function makeServices(storage: StoragePort, loadFixtures = () => Promise.resolve(verifiedBundle())): AppServices {
  return {
    storage,
    languageAdapter: new DeterministicTemplateAdapter(),
    loadFixtures,
    now: () => "2026-08-30T00:00:00.000Z",
    makeSessionId: () => "recovery-test"
  };
}

describe("fail-closed recovery states", () => {
  it("blocks and preserves a corrupt local record instead of silently overwriting it", async () => {
    const save = vi.fn();
    const storage: StoragePort = {
      load: () => ({ status: "corrupt", reason: "digest mismatch" }),
      save,
      remove: vi.fn()
    };
    render(<App services={makeServices(storage)} />);

    expect(await screen.findByRole("heading", { name: "保存的进度无法验证" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /确认情境/ })).not.toBeInTheDocument();
    expect(save).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "清除损坏记录并重新开始" })).toBeInTheDocument();
  });

  it("hard-stops when a nominally verified bundle omits one Blob URL", async () => {
    const storage: StoragePort = {
      load: () => ({ status: "empty" }),
      save: vi.fn(),
      remove: vi.fn()
    };
    const brokenBundle = verifiedBundle();
    delete brokenBundle.assetUrls.f12;
    render(<App services={makeServices(storage, () => Promise.resolve(brokenBundle))} />);

    expect(await screen.findByRole("heading", { name: "本地照片校验失败" })).toBeInTheDocument();
    expect(screen.getByText(/已验证图片地址与 manifest 不完整对应/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "选择 A" })).not.toBeInTheDocument();
  });

  it("does not resurrect a loaded session when another tab clears storage during fixture boot", async () => {
    let resolveBundle!: (bundle: VerifiedFixtureBundle) => void;
    const delayedBundle = new Promise<VerifiedFixtureBundle>((resolve) => {
      resolveBundle = resolve;
    });
    const save = vi.fn();
    const storage: StoragePort = {
      load: () => ({
        status: "ready",
        state: createInitialSession({ theme: "light", viewportClass: "desktop", sessionId: "old-session" })
      }),
      save,
      remove: vi.fn()
    };
    render(<App services={makeServices(storage, () => delayedBundle)} />);

    window.dispatchEvent(new StorageEvent("storage", { key: null }));
    resolveBundle(verifiedBundle());

    expect(await screen.findByRole("alertdialog")).toBeInTheDocument();
    await waitFor(() => expect(save).not.toHaveBeenCalled());
    expect(screen.getByText(/当前标签页已经暂停/)).toBeInTheDocument();
  });

  it("detects storage cleared after load but before the listener is mounted", async () => {
    let resolveBundle!: (bundle: VerifiedFixtureBundle) => void;
    const delayedBundle = new Promise<VerifiedFixtureBundle>((resolve) => {
      resolveBundle = resolve;
    });
    const oldState = createInitialSession({
      theme: "light",
      viewportClass: "desktop",
      sessionId: "pre-listener-old-session"
    });
    let loadCount = 0;
    const save = vi.fn();
    const storage: StoragePort = {
      load: () => {
        loadCount += 1;
        return loadCount === 1
          ? { status: "ready", state: oldState }
          : { status: "empty" };
      },
      save,
      remove: vi.fn()
    };
    render(<App services={makeServices(storage, () => delayedBundle)} />);

    resolveBundle(verifiedBundle());

    expect(await screen.findByRole("alertdialog")).toBeInTheDocument();
    expect(save).not.toHaveBeenCalled();
    expect(screen.getByText(/当前标签页已经暂停/)).toBeInTheDocument();
  });
});
