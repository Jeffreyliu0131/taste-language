import { describe, expect, it } from "vitest";
import { assertDecodedDimensions, validateManifestClosure } from "./loadFixtures";
import { TEST_MANIFEST } from "../../tests/fixtures";
import { fixtureManifestSchema, PUBLIC_FIXTURE_ALLOWED_USES } from "../domain/types";

describe("runtime fixture closure", () => {
  it("accepts the registered manifest", () => {
    expect(() => validateManifestClosure(TEST_MANIFEST)).not.toThrow();
    expect(TEST_MANIFEST.asset_license_id).toBe("CC0-1.0");
    expect(TEST_MANIFEST.metadata_license_id).toBe("CC0-1.0");
    expect(TEST_MANIFEST.fixtures.every((fixture) =>
      fixture.source_uri === `urn:taste-language:fixture:${fixture.id}` &&
      fixture.license_id === "CC0-1.0" &&
      PUBLIC_FIXTURE_ALLOWED_USES.every((use) => fixture.allowed_uses.includes(use))
    )).toBe(true);
  });

  it("rejects leaked generation IDs or incomplete public-license metadata", () => {
    const leakedUri = structuredClone(TEST_MANIFEST) as unknown as {
      fixtures: Array<{ source_uri: string }>;
    };
    const first = leakedUri.fixtures[0];
    if (!first) throw new Error("Missing fixture");
    first.source_uri = "urn:internal-generation:private-id";
    expect(fixtureManifestSchema.safeParse(leakedUri).success).toBe(false);

    const incompleteUses = structuredClone(TEST_MANIFEST) as unknown as {
      fixtures: Array<{ allowed_uses: string[] }>;
    };
    const usesFixture = incompleteUses.fixtures[0];
    if (!usesFixture) throw new Error("Missing fixture");
    usesFixture.allowed_uses = ["display"];
    expect(fixtureManifestSchema.safeParse(incompleteUses).success).toBe(false);
  });

  it("rejects duplicate hashes and split drift", () => {
    const duplicateHash = structuredClone(TEST_MANIFEST);
    const first = duplicateHash.fixtures[0];
    const second = duplicateHash.fixtures[1];
    if (!first || !second) throw new Error("Missing fixtures");
    second.sha256 = first.sha256;
    expect(() => validateManifestClosure(duplicateHash)).toThrow(/重复 fixture SHA-256/);

    const splitDrift = structuredClone(TEST_MANIFEST);
    const holdout = splitDrift.fixtures.find((fixture) => fixture.id === "f07");
    if (!holdout) throw new Error("Missing fixture");
    holdout.split = "training";
    expect(() => validateManifestClosure(splitDrift)).toThrow(/schedule closure/);
  });

  it("rejects source and near-duplicate leakage", () => {
    const leaked = structuredClone(TEST_MANIFEST);
    const training = leaked.fixtures.find((fixture) => fixture.id === "f01");
    const holdout = leaked.fixtures.find((fixture) => fixture.id === "f07");
    if (!training || !holdout) throw new Error("Missing fixture");
    holdout.source_group = training.source_group;
    expect(() => validateManifestClosure(leaked)).toThrow(/group leakage/);
  });

  it("rejects a decoded image whose natural dimensions drift from the manifest", () => {
    const fixture = TEST_MANIFEST.fixtures[0];
    if (!fixture) throw new Error("Missing fixture");
    expect(() => assertDecodedDimensions(fixture, { width: fixture.width, height: fixture.height })).not.toThrow();
    expect(() => assertDecodedDimensions(fixture, { width: fixture.width - 1, height: fixture.height })).toThrow(/解码尺寸/);
  });
});
