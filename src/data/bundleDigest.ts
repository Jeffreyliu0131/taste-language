import { demoDigest } from "../domain/digest";
import type { FixtureManifest, PairDefinition, SessionState } from "../domain/types";

export function computeFixtureBundleDigest(
  manifest: FixtureManifest,
  trainingSchedule: readonly PairDefinition[],
  holdoutSchedule: readonly PairDefinition[]
): string {
  return demoDigest({
    manifest: {
      schema_version: manifest.schema_version,
      fixture_set_version: manifest.fixture_set_version,
      scope: manifest.scope,
      created_at: manifest.created_at,
      generator: manifest.generator,
      generation_disclosure: manifest.generation_disclosure,
      rights_affirmer: manifest.rights_affirmer,
      rights_effective_date: manifest.rights_effective_date,
      asset_license_id: manifest.asset_license_id,
      asset_license_url: manifest.asset_license_url,
      metadata_license_id: manifest.metadata_license_id,
      metadata_license_url: manifest.metadata_license_url,
      rights_note: manifest.rights_note,
      fixtures: [...manifest.fixtures]
        .sort((left, right) => left.id.localeCompare(right.id))
        .map((fixture) => ({ ...fixture, allowed_uses: [...fixture.allowed_uses].sort(), style_tags: [...fixture.style_tags].sort() }))
    },
    schedules: {
      training: trainingSchedule,
      holdout: holdoutSchedule
    }
  });
}

export function isSessionBundleCompatible(
  session: SessionState,
  manifest: FixtureManifest,
  trainingSchedule: readonly PairDefinition[],
  holdoutSchedule: readonly PairDefinition[]
): boolean {
  if (session.phase === "context") return true;
  const currentDigest = computeFixtureBundleDigest(manifest, trainingSchedule, holdoutSchedule);
  if (
    session.boundFixtureBundleDigest !== currentDigest ||
    session.boundFixtureSetVersion !== manifest.fixture_set_version
  ) {
    return false;
  }
  if (!session.lock) return true;
  return (
    session.lock.fixtureManifestDigest === currentDigest &&
    session.lock.fixtureSetVersion === manifest.fixture_set_version
  );
}
