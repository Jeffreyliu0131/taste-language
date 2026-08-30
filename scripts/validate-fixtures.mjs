import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(projectRoot, "public", "fixtures", "manifest.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

const failures = [];
const cc0LicenseId = "CC0-1.0";
const cc0LicenseUrl = "https://creativecommons.org/publicdomain/zero/1.0/";
const publicAllowedUses = [
  "display",
  "copy",
  "modify",
  "redistribute",
  "commercial-use",
  "model-training"
];
const ids = new Set();
const paths = new Set();
const hashes = new Set();
const groupsBySplit = { training: new Set(), holdout: new Set() };
const nearGroupsBySplit = { training: new Set(), holdout: new Set() };

if (manifest.schema_version !== "1.1.0") failures.push("manifest schema must be 1.1.0");
if (manifest.fixture_set_version !== "tl-synthetic-spaces-2026-08-30-cc0-v1") {
  failures.push("fixture set version does not identify the frozen CC0 bundle");
}
if (manifest.scope !== "public-taste-language-fixtures") failures.push("manifest scope is not public");
if (manifest.rights_affirmer !== "Kairui Liu" || !manifest.rights_effective_date) {
  failures.push("manifest CC0 affirmer or effective date missing");
}
if (
  manifest.asset_license_id !== cc0LicenseId || manifest.asset_license_url !== cc0LicenseUrl ||
  manifest.metadata_license_id !== cc0LicenseId || manifest.metadata_license_url !== cc0LicenseUrl
) {
  failures.push("manifest asset/metadata CC0 declaration mismatch");
}
if (!manifest.generation_disclosure?.includes("AI-generated") || !manifest.generation_disclosure?.includes("non-unique")) {
  failures.push("manifest AI-generation/non-uniqueness disclosure missing");
}
if (!manifest.rights_note?.includes("CC0-1.0") || !manifest.rights_note?.includes("No warranty")) {
  failures.push("manifest CC0 limitations disclosure missing");
}

for (const fixture of manifest.fixtures ?? []) {
  if (ids.has(fixture.id)) failures.push(`duplicate id: ${fixture.id}`);
  if (paths.has(fixture.path)) failures.push(`duplicate path: ${fixture.path}`);
  if (hashes.has(fixture.sha256)) failures.push(`duplicate sha256: ${fixture.sha256}`);
  ids.add(fixture.id);
  paths.add(fixture.path);
  hashes.add(fixture.sha256);

  if (!groupsBySplit[fixture.split] || !nearGroupsBySplit[fixture.split]) {
    failures.push(`invalid split: ${fixture.id}`);
    continue;
  }

  groupsBySplit[fixture.split].add(fixture.source_group);
  nearGroupsBySplit[fixture.split].add(fixture.near_duplicate_group);

  if (!fixture.license_id || !fixture.source_uri || !fixture.sha256) {
    failures.push(`missing provenance or rights field: ${fixture.id}`);
  }
  if (fixture.source_type !== "ai-generated") {
    failures.push(`source type is not AI-generated: ${fixture.id}`);
  }
  if (fixture.source_uri !== `urn:taste-language:fixture:${fixture.id}`) {
    failures.push(`public source URI mismatch: ${fixture.id}`);
  }
  if (fixture.source_uri?.startsWith("openai-imagegen://")) {
    failures.push(`internal generation URI leaked: ${fixture.id}`);
  }
  if (fixture.license_id !== cc0LicenseId || fixture.license_url !== cc0LicenseUrl) {
    failures.push(`fixture CC0 declaration mismatch: ${fixture.id}`);
  }
  const uses = new Set(fixture.allowed_uses ?? []);
  if (uses.size !== publicAllowedUses.length || publicAllowedUses.some((use) => !uses.has(use))) {
    failures.push(`fixture public-use declaration incomplete: ${fixture.id}`);
  }
  if (fixture.parent_id !== null) {
    failures.push(`unexpected derivative parent in v1 manifest: ${fixture.id}`);
  }

  const assetPath = path.join(projectRoot, "public", fixture.path.replace(/^\//, ""));
  try {
    const bytes = await readFile(assetPath);
    const actual = createHash("sha256").update(bytes).digest("hex");
    if (actual !== fixture.sha256) {
      failures.push(`sha256 mismatch: ${fixture.id}`);
    }
  } catch (error) {
    failures.push(`asset unreadable: ${fixture.id} (${error.message})`);
  }
}

const expectedTrainingIds = new Set(["f01", "f02", "f03", "f04", "f05", "f06"]);
const expectedHoldoutIds = new Set(["f07", "f08", "f09", "f10", "f11", "f12"]);
for (const fixture of manifest.fixtures ?? []) {
  const expectedSplit = expectedTrainingIds.has(fixture.id)
    ? "training"
    : expectedHoldoutIds.has(fixture.id)
      ? "holdout"
      : null;
  if (!expectedSplit || fixture.split !== expectedSplit) {
    failures.push(`fixture/split closure mismatch: ${fixture.id}`);
  }
}
if (ids.size !== expectedTrainingIds.size + expectedHoldoutIds.size) {
  failures.push(`fixture count closure mismatch: ${ids.size}`);
}

for (const group of groupsBySplit.training) {
  if (groupsBySplit.holdout.has(group)) failures.push(`source group leakage: ${group}`);
}
for (const group of nearGroupsBySplit.training) {
  if (nearGroupsBySplit.holdout.has(group)) failures.push(`near-duplicate leakage: ${group}`);
}

if (failures.length > 0) {
  console.error("Fixture validation failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Fixture validation passed: ${ids.size} CC0 public assets, sanitized provenance, split groups disjoint.`);
