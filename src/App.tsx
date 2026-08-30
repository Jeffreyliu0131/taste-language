import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import {
  AlertDialog,
  Button,
  Callout,
  Dialog,
  Theme,
  Tooltip
} from "@radix-ui/themes";
import {
  ArrowCounterClockwise,
  DownloadSimple,
  Info,
  Lock,
  Moon,
  Sun,
  Warning
} from "@phosphor-icons/react";
import {
  assertVerifiedAssetUrlClosure,
  loadAndVerifyFixtures,
  type VerifiedFixtureBundle
} from "./data/loadFixtures";
import { HOLDOUT_SCHEDULE, TRAINING_SCHEDULE } from "./data/schedule";
import { computeFixtureBundleDigest, isSessionBundleCompatible } from "./data/bundleDigest";
import { createProfileLock } from "./domain/freeze";
import { DeterministicTemplateAdapter, type LanguageAdapter } from "./domain/language";
import type { FixtureManifest, SessionState } from "./domain/types";
import { AxisReviewScreen } from "./screens/AxisReviewScreen";
import { ExperienceProgress } from "./components/ExperienceProgress";
import { useStepFocus } from "./components/useStepFocus";
import { ContextScreen } from "./screens/ContextScreen";
import { HoldoutScreen } from "./screens/HoldoutScreen";
import { LineupScreen } from "./screens/LineupScreen";
import { PerturbationScreen } from "./screens/PerturbationScreen";
import { ResultsScreen } from "./screens/ResultsScreen";
import { TrainingScreen } from "./screens/TrainingScreen";
import { createInitialSession, sessionReducer } from "./session/reducer";
import { downloadExport } from "./storage/exportSession";
import {
  LocalStorageAdapter,
  SESSION_STORAGE_KEY,
  storageSnapshotsMatch,
  type StorageLoadResult,
  type StoragePort
} from "./storage/sessionStorage";

export interface AppServices {
  storage: StoragePort;
  languageAdapter: LanguageAdapter;
  loadFixtures: () => Promise<VerifiedFixtureBundle>;
  now: () => string;
  makeSessionId: () => string;
}

const defaultStorage = typeof window === "undefined" ? null : new LocalStorageAdapter();

const defaultServices: AppServices = {
  storage: defaultStorage ?? {
    load: () => ({ status: "empty" }),
    save: () => undefined,
    remove: () => undefined
  },
  languageAdapter: new DeterministicTemplateAdapter(),
  loadFixtures: loadAndVerifyFixtures,
  now: () => new Date().toISOString(),
  makeSessionId: () =>
    `local-${globalThis.crypto?.randomUUID?.().slice(0, 8) ?? Date.now().toString(36)}`
};

function preferredTheme(): "light" | "dark" {
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function currentViewportClass(): "mobile" | "desktop" {
  return window.matchMedia?.("(max-width: 767px)").matches ? "mobile" : "desktop";
}

function freshSession(services: AppServices): SessionState {
  return createInitialSession({
    theme: preferredTheme(),
    viewportClass: currentViewportClass(),
    sessionId: services.makeSessionId()
  });
}

function BlockingHeading({ focusKey, children }: { focusKey: string; children: string }) {
  const headingRef = useStepFocus(focusKey);
  return <h1 ref={headingRef} tabIndex={-1}>{children}</h1>;
}

export function App({ services = defaultServices }: { services?: AppServices }) {
  const [initialLoad] = useState<StorageLoadResult>(() => services.storage.load());
  const [session, dispatch] = useReducer(
    sessionReducer,
    initialLoad,
    (load) => load.status === "ready" ? load.state : freshSession(services)
  );
  const [manifest, setManifest] = useState<FixtureManifest | null>(null);
  const [assetUrls, setAssetUrls] = useState<Record<string, string>>({});
  const bundleDisposerRef = useRef<(() => void) | null>(null);
  const [fixtureState, setFixtureState] = useState<
    { status: "loading" } | { status: "ready" } | { status: "error"; message: string }
  >({ status: "loading" });
  const [storageWarning, setStorageWarning] = useState<string | null>(() =>
    initialLoad.status === "unavailable"
      ? "浏览器本地存储当前不可用。你仍可继续并导出，但刷新后进度可能丢失。"
      : null
  );
  const [crossTabPaused, setCrossTabPaused] = useState(false);
  const crossTabPausedRef = useRef(false);
  const lastKnownStorageRef = useRef<StorageLoadResult>(initialLoad);

  const installVerifiedBundle = useCallback((loaded: VerifiedFixtureBundle) => {
    try {
      assertVerifiedAssetUrlClosure(loaded);
    } catch (error) {
      loaded.dispose();
      throw error;
    }
    bundleDisposerRef.current?.();
    bundleDisposerRef.current = () => loaded.dispose();
    setManifest(loaded.manifest);
    setAssetUrls(loaded.assetUrls);
    setFixtureState({ status: "ready" });
  }, []);

  const verifyFixtures = useCallback(() => {
    bundleDisposerRef.current?.();
    bundleDisposerRef.current = null;
    setManifest(null);
    setAssetUrls({});
    setFixtureState({ status: "loading" });
    void services.loadFixtures().then(installVerifiedBundle).catch((error: unknown) => {
      setManifest(null);
      setAssetUrls({});
      setFixtureState({
        status: "error",
        message: error instanceof Error ? error.message : "本地照片校验失败。"
      });
    });
  }, [installVerifiedBundle, services]);

  useEffect(() => {
    let active = true;
    void services.loadFixtures().then((loaded) => {
      if (!active) {
        loaded.dispose();
        return;
      }
      installVerifiedBundle(loaded);
    }).catch((error: unknown) => {
      if (!active) return;
      setManifest(null);
      setAssetUrls({});
      setFixtureState({
        status: "error",
        message: error instanceof Error ? error.message : "本地照片校验失败。"
      });
    });
    return () => {
      active = false;
    };
  }, [installVerifiedBundle, services]);

  useEffect(() => () => {
    bundleDisposerRef.current?.();
  }, []);

  useEffect(() => {
    if (
      fixtureState.status !== "ready" ||
      initialLoad.status === "corrupt" ||
      initialLoad.status === "unavailable" ||
      crossTabPausedRef.current
    ) return;
    try {
      const currentStorage = services.storage.load();
      if (!storageSnapshotsMatch(lastKnownStorageRef.current, currentStorage)) {
        crossTabPausedRef.current = true;
        queueMicrotask(() => setCrossTabPaused(true));
        return;
      }
      services.storage.save(session);
      lastKnownStorageRef.current = { status: "ready", state: structuredClone(session) };
    } catch {
      queueMicrotask(() => {
        setStorageWarning("本地持久化失败。当前流程仍可继续并导出，但刷新后可能丢失状态。");
      });
    }
  }, [fixtureState.status, initialLoad.status, services, session]);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === SESSION_STORAGE_KEY || event.key === null) {
        crossTabPausedRef.current = true;
        setCrossTabPaused(true);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const fixturesById = useMemo(
    () => new Map(
      manifest?.fixtures.flatMap((fixture) => {
        const verifiedUrl = assetUrls[fixture.id];
        return verifiedUrl ? [[fixture.id, { ...fixture, path: verifiedUrl }] as const] : [];
      }) ?? []
    ),
    [assetUrls, manifest]
  );
  const currentBundleDigest = useMemo(
    () => manifest ? computeFixtureBundleDigest(manifest, TRAINING_SCHEDULE, HOLDOUT_SCHEDULE) : null,
    [manifest]
  );
  const bundleMismatch = Boolean(
    manifest &&
    !isSessionBundleCompatible(session, manifest, TRAINING_SCHEDULE, HOLDOUT_SCHEDULE)
  );

  const resetSession = () => {
    try {
      services.storage.remove();
      window.location.reload();
    } catch {
      setStorageWarning("无法清除本浏览器里的 Taste Language 记录。现有进度保持不变，请检查存储权限。");
    }
  };

  const resumeStoredSession = () => {
    window.location.reload();
  };

  const freezeProfile = () => {
    if (!manifest) return;
    const fixtureManifestDigest = computeFixtureBundleDigest(
      manifest,
      TRAINING_SCHEDULE,
      HOLDOUT_SCHEDULE
    );
    const lock = createProfileLock({
      now: services.now(),
      displayTheme: session.displayTheme,
      viewportClass: session.viewportClass,
      fixtureSetVersion: manifest.fixture_set_version,
      fixtureManifestDigest,
      fixtures: manifest.fixtures,
      trainingSchedule: TRAINING_SCHEDULE,
      holdoutSchedule: HOLDOUT_SCHEDULE,
      trainingChoices: session.trainingChoices,
      adapter: services.languageAdapter
    });
    dispatch({ type: "LOCK_PROFILE", lock });
  };

  const page = (() => {
    if (!manifest) return null;
    switch (session.phase) {
      case "context":
        return currentBundleDigest ? (
          <ContextScreen
            session={session}
            dispatch={dispatch}
            now={services.now}
            fixtureSetVersion={manifest.fixture_set_version}
            bundleDigest={currentBundleDigest}
          />
        ) : null;
      case "training":
        return (
          <TrainingScreen
            session={session}
            fixturesById={fixturesById}
            dispatch={dispatch}
            now={services.now}
            onFreeze={freezeProfile}
            onRetryFixtures={verifyFixtures}
          />
        );
      case "holdout":
        return (
          <HoldoutScreen
            session={session}
            fixturesById={fixturesById}
            dispatch={dispatch}
            now={services.now}
            onRetryFixtures={verifyFixtures}
          />
        );
      case "lineup":
        return <LineupScreen session={session} dispatch={dispatch} />;
      case "perturbation":
        return <PerturbationScreen session={session} dispatch={dispatch} />;
      case "axis-review":
        return (
          <AxisReviewScreen
            session={session}
            fixturesById={fixturesById}
            dispatch={dispatch}
            now={services.now}
          />
        );
      case "results":
        return (
          <ResultsScreen
            session={session}
            fixturesById={fixturesById}
            onExport={() => downloadExport(session, manifest)}
            onRestart={resetSession}
          />
        );
    }
  })();

  return (
    <Theme
      appearance={session.displayTheme}
      accentColor="jade"
      grayColor="sage"
      radius="large"
      panelBackground="solid"
      className="app-theme"
    >
      <div className="app-frame" data-theme={session.displayTheme}>
        <header className="experiment-bar">
          <div className="brand-lockup">
            <span className="brand-mark" aria-hidden="true">TL</span>
            <div>
              <strong>Taste Language</strong>
              <span>本地视觉偏好实验</span>
            </div>
          </div>
          <div className="experiment-meta" aria-label="实验状态">
            <span><Lock size={15} aria-hidden="true" />长期学习</span>
            <span>本地确定性运行</span>
          </div>
          <div className="header-actions">
            <Tooltip content={session.phase === "context" ? "切换并在开始时锁定" : "显示模式已随本次体验锁定"}>
              <Button
                variant="ghost"
                aria-label={session.displayTheme === "dark" ? "切换到浅色" : "切换到深色"}
                disabled={session.phase !== "context"}
                onClick={() =>
                  dispatch({
                    type: "SET_THEME",
                    theme: session.displayTheme === "dark" ? "light" : "dark"
                  })
                }
              >
                {session.displayTheme === "dark" ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
              </Button>
            </Tooltip>
            <Dialog.Root>
              <Dialog.Trigger>
                <Button variant="ghost" aria-label="查看范围与数据边界"><Info aria-hidden="true" /></Button>
              </Dialog.Trigger>
              <Dialog.Content maxWidth="560px">
                <Dialog.Title>范围与数据边界</Dialog.Title>
                <Dialog.Description>
                  这是本地体验验收版。它不证明用户需求，不判断真实地点，也不产生预测概率。
                </Dialog.Description>
                <div className="dialog-ledger">
                  <p><strong>本地数据</strong> 选择、编辑和可选备注只保存在当前浏览器。</p>
                  <p><strong>图片来源</strong> 12 张项目生成的合成照片，启动时校验来源、文件哈希与图像解码。</p>
                  <p><strong>模型边界</strong> 核心流程没有模型、API 密钥、三维渲染或外部网络依赖。</p>
                </div>
                <Dialog.Close><Button>知道了</Button></Dialog.Close>
              </Dialog.Content>
            </Dialog.Root>
            <AlertDialog.Root>
              <AlertDialog.Trigger>
                <Button variant="ghost" color="red" aria-label="清除本浏览器实验状态">
                  <ArrowCounterClockwise aria-hidden="true" />
                </Button>
              </AlertDialog.Trigger>
              <AlertDialog.Content maxWidth="480px">
                <AlertDialog.Title>清除本浏览器里的体验记录？</AlertDialog.Title>
                <AlertDialog.Description>
                  这会移除 Taste Language 在当前浏览器保存的进度。它不是操作系统级安全删除，也不能删除已经下载的导出文件。
                </AlertDialog.Description>
                <div className="dialog-actions">
                  <AlertDialog.Cancel><Button variant="soft" color="gray">取消</Button></AlertDialog.Cancel>
                  <AlertDialog.Action><Button color="red" onClick={resetSession}>清除并重新开始</Button></AlertDialog.Action>
                </div>
              </AlertDialog.Content>
            </AlertDialog.Root>
          </div>
        </header>

        {storageWarning ? (
          <Callout.Root color="amber" className="global-callout">
            <Callout.Icon><Warning aria-hidden="true" /></Callout.Icon>
            <Callout.Text>{storageWarning}</Callout.Text>
          </Callout.Root>
        ) : null}

        <AlertDialog.Root open={crossTabPaused}>
          <AlertDialog.Content maxWidth="520px" className="cross-tab-dialog">
            <Warning size={28} aria-hidden="true" />
            <AlertDialog.Title>同一实验在另一个标签页发生了变化</AlertDialog.Title>
            <AlertDialog.Description>
              为了避免两个版本互相覆盖，当前标签页已经暂停。另一个标签页清除数据时也会触发此保护。
            </AlertDialog.Description>
            <Button autoFocus onClick={resumeStoredSession}>载入最新本地状态</Button>
          </AlertDialog.Content>
        </AlertDialog.Root>

        {fixtureState.status === "loading" ? (
          <main className="boot-state" aria-busy="true">
            <div className="matte-loader" aria-hidden="true" />
            <p>正在校验 12 张本地照片的来源记录、文件哈希与图像解码。</p>
          </main>
        ) : null}

        {fixtureState.status === "error" ? (
          <main className="boot-state error-state" role="alert" aria-live="assertive">
            <Warning size={32} aria-hidden="true" />
            <BlockingHeading focusKey="fixture-delivery-error">本地照片校验失败</BlockingHeading>
            <p>有一张或多张本地照片无法完成读取、完整性校验或图像解码。</p>
            <p>系统不会用替代图片继续，也不会在照片不完整时允许作答。</p>
            <Button onClick={() => void verifyFixtures()}>重新校验 12 张照片</Button>
            <details className="error-details">
              <summary>查看错误边界</summary>
              <p>错误码：FIXTURE_DELIVERY_FAILURE。技术原因：{fixtureState.message}</p>
              <p>文件哈希、展示权限、尺寸或解码任一失败都会停止流程。</p>
            </details>
          </main>
        ) : null}

        {fixtureState.status === "ready" && initialLoad.status === "corrupt" ? (
          <main className="boot-state error-state" role="alert" aria-live="assertive">
            <Warning size={32} aria-hidden="true" />
            <BlockingHeading focusKey="corrupt-storage-error">保存的进度无法验证</BlockingHeading>
            <p>浏览器里有一份损坏、过期或结构不完整的 Taste Language 记录。系统没有覆盖它，也不会从中恢复任何选择。</p>
            <AlertDialog.Root>
              <AlertDialog.Trigger><Button color="red">清除损坏记录并重新开始</Button></AlertDialog.Trigger>
              <AlertDialog.Content maxWidth="480px">
                <AlertDialog.Title>清除这份无法验证的记录？</AlertDialog.Title>
                <AlertDialog.Description>清除后会重新载入一个空白体验。这个操作不能恢复原记录。</AlertDialog.Description>
                <div className="dialog-actions">
                  <AlertDialog.Cancel><Button variant="soft" color="gray">先保留</Button></AlertDialog.Cancel>
                  <AlertDialog.Action><Button color="red" onClick={resetSession}>清除并重新开始</Button></AlertDialog.Action>
                </div>
              </AlertDialog.Content>
            </AlertDialog.Root>
            <details className="error-details">
              <summary>查看技术原因</summary>
              <p>{initialLoad.reason}</p>
            </details>
          </main>
        ) : null}

        {fixtureState.status === "ready" && initialLoad.status !== "corrupt" && bundleMismatch && manifest ? (
          <main className="boot-state error-state" role="alert" aria-live="assertive">
            <Warning size={32} aria-hidden="true" />
            <BlockingHeading focusKey="bundle-mismatch-error">照片版本与旧记录不一致</BlockingHeading>
            <p>
              旧记录绑定于 {session.boundFixtureSetVersion ?? session.lock?.fixtureSetVersion ?? "未知版本"}，当前照片版本是 {manifest.fixture_set_version}。照片属性、使用范围或比较顺序发生变化，因此旧选择和预测不会继续使用。
            </p>
            <div className="error-actions">
              <Button variant="soft" onClick={() => downloadExport(session, manifest)}>导出旧记录元数据</Button>
              <AlertDialog.Root>
                <AlertDialog.Trigger><Button color="red">清除旧记录并重新开始</Button></AlertDialog.Trigger>
                <AlertDialog.Content maxWidth="480px">
                  <AlertDialog.Title>清除这份不兼容的旧记录？</AlertDialog.Title>
                  <AlertDialog.Description>清除后会用当前照片版本开始空白体验。已下载的导出文件不受影响。</AlertDialog.Description>
                  <div className="dialog-actions">
                    <AlertDialog.Cancel><Button variant="soft" color="gray">先保留</Button></AlertDialog.Cancel>
                    <AlertDialog.Action><Button color="red" onClick={resetSession}>清除并重新开始</Button></AlertDialog.Action>
                  </div>
                </AlertDialog.Content>
              </AlertDialog.Root>
            </div>
          </main>
        ) : null}
        {fixtureState.status === "ready" && initialLoad.status !== "corrupt" && !bundleMismatch ? (
          <main className="app-main">
            <ExperienceProgress phase={session.phase} />
            {page}
          </main>
        ) : null}

        <footer className="app-footer">
          <span>证据结论：Validate first（先验证）</span>
          <span>仅限本地体验验收</span>
          {manifest && session.phase === "results" ? (
            <Button variant="ghost" size="1" onClick={() => downloadExport(session, manifest)}>
              <DownloadSimple aria-hidden="true" />导出记录
            </Button>
          ) : null}
        </footer>
      </div>
    </Theme>
  );
}
