import {
  CC0_LICENSE_ID,
  CC0_LICENSE_URL,
  fixtureManifestSchema,
  PUBLIC_FIXTURE_ALLOWED_USES,
  type FixtureManifest
} from "../domain/types";
import { HOLDOUT_SCHEDULE, TRAINING_SCHEDULE } from "./schedule";

export class FixtureDeliveryError extends Error {
  readonly code = "FIXTURE_DELIVERY_FAILURE";

  constructor(message: string) {
    super(message);
    this.name = "FixtureDeliveryError";
  }
}

export interface VerifiedFixtureBundle {
  manifest: FixtureManifest;
  assetUrls: Record<string, string>;
  dispose(): void;
}

export function assertVerifiedAssetUrlClosure(bundle: VerifiedFixtureBundle): void {
  const expectedIds = new Set(bundle.manifest.fixtures.map((fixture) => fixture.id));
  const actualIds = Object.keys(bundle.assetUrls);
  if (actualIds.length !== expectedIds.size || actualIds.some((id) => !expectedIds.has(id))) {
    throw new FixtureDeliveryError("已验证图片地址与 manifest 不完整对应。");
  }
  for (const id of expectedIds) {
    const url = bundle.assetUrls[id];
    if (!url?.startsWith("blob:")) {
      throw new FixtureDeliveryError(`${id} 缺少已验证的 Blob 图片地址。`);
    }
  }
}

function bytesToHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function sha256(bytes: ArrayBuffer): Promise<string> {
  if (!globalThis.crypto?.subtle) {
    throw new FixtureDeliveryError("当前浏览器不支持本地 SHA-256 校验。");
  }
  return bytesToHex(await globalThis.crypto.subtle.digest("SHA-256", bytes));
}

async function decodeImage(url: string): Promise<{ width: number; height: number }> {
  const image = new Image();
  if (typeof image.decode === "function") {
    image.src = url;
    await image.decode();
  } else {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Image decode failed"));
      image.src = url;
    });
  }
  return { width: image.naturalWidth, height: image.naturalHeight };
}

export function assertDecodedDimensions(
  fixture: Pick<FixtureManifest["fixtures"][number], "id" | "width" | "height">,
  dimensions: { width: number; height: number }
): void {
  if (dimensions.width !== fixture.width || dimensions.height !== fixture.height) {
    throw new FixtureDeliveryError(`${fixture.id} 的解码尺寸与 manifest 不一致。`);
  }
}

export function validateManifestClosure(manifest: FixtureManifest): void {
  const ids = new Set<string>();
  const paths = new Set<string>();
  const hashes = new Set<string>();
  const pairIds = new Set<string>();
  const byId = new Map(manifest.fixtures.map((fixture) => [fixture.id, fixture]));
  const trainingIds = new Set(TRAINING_SCHEDULE.flatMap((pair) => [pair.leftId, pair.rightId]));
  const holdoutIds = new Set(HOLDOUT_SCHEDULE.flatMap((pair) => [pair.leftId, pair.rightId]));

  for (const fixture of manifest.fixtures) {
    if (ids.has(fixture.id)) throw new FixtureDeliveryError(`重复 fixture id: ${fixture.id}`);
    if (paths.has(fixture.path)) throw new FixtureDeliveryError(`重复 fixture path: ${fixture.path}`);
    if (hashes.has(fixture.sha256)) throw new FixtureDeliveryError(`重复 fixture SHA-256: ${fixture.id}`);
    ids.add(fixture.id);
    paths.add(fixture.path);
    hashes.add(fixture.sha256);
    if (
      fixture.source_type !== "ai-generated" ||
      fixture.source_uri !== `urn:taste-language:fixture:${fixture.id}`
    ) {
      throw new FixtureDeliveryError(`${fixture.id} 的公开 AI-generation provenance 不完整。`);
    }
    if (fixture.license_id !== CC0_LICENSE_ID || fixture.license_url !== CC0_LICENSE_URL) {
      throw new FixtureDeliveryError(`${fixture.id} 的 CC0 声明不一致。`);
    }
    const allowedUses = new Set(fixture.allowed_uses);
    if (
      allowedUses.size !== PUBLIC_FIXTURE_ALLOWED_USES.length ||
      PUBLIC_FIXTURE_ALLOWED_USES.some((use) => !allowedUses.has(use))
    ) {
      throw new FixtureDeliveryError(`${fixture.id} 的公共使用范围声明不完整。`);
    }
    const expectedSplit = trainingIds.has(fixture.id)
      ? "training"
      : holdoutIds.has(fixture.id)
        ? "holdout"
        : null;
    if (!expectedSplit || fixture.split !== expectedSplit) {
      throw new FixtureDeliveryError(`${fixture.id} 未满足冻结 schedule closure。`);
    }
  }

  const schedules = [...TRAINING_SCHEDULE, ...HOLDOUT_SCHEDULE];
  for (const pair of schedules) {
    if (pairIds.has(pair.id)) throw new FixtureDeliveryError(`重复 pair id: ${pair.id}`);
    pairIds.add(pair.id);
    if (pair.leftId === pair.rightId) throw new FixtureDeliveryError(`pair 自比较: ${pair.id}`);
    const left = byId.get(pair.leftId);
    const right = byId.get(pair.rightId);
    if (!left || !right || left.split !== pair.phase || right.split !== pair.phase) {
      throw new FixtureDeliveryError(`pair fixture/split closure 失败: ${pair.id}`);
    }
    if (pair.repeatOf) {
      const source = TRAINING_SCHEDULE.find((candidate) => candidate.id === pair.repeatOf);
      if (!source || new Set([source.leftId, source.rightId]).size !== new Set([pair.leftId, pair.rightId]).size ||
        ![source.leftId, source.rightId].every((id) => id === pair.leftId || id === pair.rightId)) {
        throw new FixtureDeliveryError(`repeat pair closure 失败: ${pair.id}`);
      }
    }
  }

  const trainingGroups = new Set(
    manifest.fixtures.filter((fixture) => fixture.split === "training").map((fixture) => fixture.source_group)
  );
  const trainingNearGroups = new Set(
    manifest.fixtures.filter((fixture) => fixture.split === "training").map((fixture) => fixture.near_duplicate_group)
  );
  for (const fixture of manifest.fixtures.filter((item) => item.split === "holdout")) {
    if (trainingGroups.has(fixture.source_group) || trainingNearGroups.has(fixture.near_duplicate_group)) {
      throw new FixtureDeliveryError(`${fixture.id} 与 training 存在 group leakage。`);
    }
  }
}

export async function loadAndVerifyFixtures(): Promise<VerifiedFixtureBundle> {
  const manifestResponse = await fetch("/fixtures/manifest.json", { cache: "no-store" });
  if (!manifestResponse.ok) {
    throw new FixtureDeliveryError("本地 fixture manifest 无法读取。");
  }
  const manifest = fixtureManifestSchema.parse(await manifestResponse.json());
  validateManifestClosure(manifest);

  const results = await Promise.allSettled(
    manifest.fixtures.map(async (fixture) => {
      const response = await fetch(fixture.path, { cache: "force-cache" });
      if (!response.ok) throw new FixtureDeliveryError(`${fixture.id} 无法读取。`);
      const bytes = await response.arrayBuffer();
      const actualHash = await sha256(bytes);
      if (actualHash !== fixture.sha256) {
        throw new FixtureDeliveryError(`${fixture.id} 的文件哈希与 manifest 不一致。`);
      }
      const url = URL.createObjectURL(new Blob([bytes], { type: "image/jpeg" }));
      try {
        const dimensions = await decodeImage(url);
        assertDecodedDimensions(fixture, dimensions);
        return [fixture.id, url] as const;
      } catch (error) {
        URL.revokeObjectURL(url);
        throw error;
      }
    })
  );
  const fulfilled = results
    .filter((result): result is PromiseFulfilledResult<readonly [string, string]> => result.status === "fulfilled")
    .map((result) => result.value);
  const rejected = results.find((result): result is PromiseRejectedResult => result.status === "rejected");
  if (rejected) {
    for (const [, url] of fulfilled) URL.revokeObjectURL(url);
    throw rejected.reason instanceof Error
      ? rejected.reason
      : new FixtureDeliveryError("本地 fixture decode 失败。");
  }
  const assetUrls = Object.fromEntries(fulfilled);
  const bundle: VerifiedFixtureBundle = {
    manifest,
    assetUrls,
    dispose() {
      for (const url of Object.values(assetUrls)) URL.revokeObjectURL(url);
    }
  };
  assertVerifiedAssetUrlClosure(bundle);
  return bundle;
}
