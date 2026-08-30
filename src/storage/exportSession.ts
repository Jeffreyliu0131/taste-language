import type { FixtureManifest, SessionState } from "../domain/types";
import { computeFixtureBundleDigest, isSessionBundleCompatible } from "../data/bundleDigest";
import { HOLDOUT_SCHEDULE, TRAINING_SCHEDULE } from "../data/schedule";

function positionFor(order: string[], value: string | null): string | null {
  if (!value) return null;
  if (value === "none" || value === "unsupported") return value;
  const index = order.indexOf(value);
  return index >= 0 ? String.fromCharCode(65 + index) : "unknown";
}

export function buildExport(session: SessionState, manifest: FixtureManifest): object {
  const lock = session.lock;
  const currentBundleDigest = computeFixtureBundleDigest(
    manifest,
    TRAINING_SCHEDULE,
    HOLDOUT_SCHEDULE
  );
  return {
    schema_version: "taste-language-local-export-v1",
    scope: "local-portfolio-prototype-only",
    evidence_verdict: "Validate first",
    claims_not_supported: [
      "validated demand",
      "real place suitability",
      "probability calibration",
      "personality or sensitive inference",
      "production readiness"
    ],
    session: {
      id: session.sessionId,
      revision: session.revision,
      phase: session.phase,
      context: "long-study-photo-visual",
      bound_fixture_set_version: session.boundFixtureSetVersion,
      bound_fixture_bundle_digest: session.boundFixtureBundleDigest,
      display_theme: session.displayTheme,
      viewport_class: session.viewportClass,
      training_choices: session.trainingChoices,
      holdout_choices: session.holdoutChoices,
      editable_axes: session.editableAxes,
      axis_edits: session.axisEdits,
      secondary_note: session.secondaryNote || null
    },
    records: {
      choice_prediction: lock
        ? {
            schema_version: "choice-prediction-record-v1",
            holdout_choices: session.holdoutChoices,
            frozen_predictions: lock.holdoutPredictions
          }
        : null,
      language_response: lock
        ? {
            schema_version: "language-response-record-v1",
            lineup: {
              plan_version: lock.lineupPlan.planVersion,
              supported: lock.lineupPlan.supported,
              selected_position: positionFor(lock.lineupPlan.order, session.lineupSelection),
              frozen_candidate_position: positionFor(lock.lineupPlan.order, lock.lineupPlan.ownOpaqueId),
              selected_frozen_candidate:
                lock.lineupPlan.supported && session.lineupSelection && session.lineupSelection !== "none"
                  ? session.lineupSelection === lock.lineupPlan.ownOpaqueId
                  : null
            },
            direction_swap: {
              plan_version: lock.perturbationPlan.planVersion,
              supported: lock.perturbationPlan.supported,
              selected_position: positionFor(lock.perturbationPlan.order, session.perturbationSelection),
              frozen_direction_position: positionFor(lock.perturbationPlan.order, lock.perturbationPlan.ownOpaqueId),
              selected_frozen_direction:
                lock.perturbationPlan.supported && session.perturbationSelection && session.perturbationSelection !== "none"
                  ? session.perturbationSelection === lock.perturbationPlan.ownOpaqueId
                  : null
            },
            edited_axes: session.editableAxes,
            edit_trace: session.axisEdits,
            secondary_note: session.secondaryNote || null
          }
        : null,
      delivery_state: lock
        ? {
            schema_version: "delivery-state-record-v1",
            language_delivery: lock.delivery,
            probability_contract: null,
            fixture_bundle_digest: lock.fixtureManifestDigest
          }
        : null
    },
    frozen_profile: lock
      ? {
          lock_digest: lock.lockDigest,
          fixture_set_version: lock.fixtureSetVersion,
          fixture_bundle_digest: lock.fixtureManifestDigest,
          created_at: lock.createdAt,
          training_input_digest: lock.trainingInputDigest,
          algorithm_version: lock.algorithmVersion,
          threshold_version: lock.thresholdVersion,
          profile: lock.profile,
          predictions: lock.holdoutPredictions,
          axis_bundle: lock.axisBundle,
          delivery: lock.delivery
        }
      : null,
    current_fixture_manifest: {
      version: manifest.fixture_set_version,
      bundle_digest: currentBundleDigest,
      matches_session_binding: isSessionBundleCompatible(
        session,
        manifest,
        TRAINING_SCHEDULE,
        HOLDOUT_SCHEDULE
      ),
      scope: manifest.scope,
      generation_disclosure: manifest.generation_disclosure,
      rights_affirmer: manifest.rights_affirmer,
      rights_effective_date: manifest.rights_effective_date,
      asset_license_id: manifest.asset_license_id,
      asset_license_url: manifest.asset_license_url,
      metadata_license_id: manifest.metadata_license_id,
      metadata_license_url: manifest.metadata_license_url,
      rights_note: manifest.rights_note,
      fixtures: manifest.fixtures.map((fixture) => ({
        id: fixture.id,
        sha256: fixture.sha256,
        split: fixture.split,
        source_type: fixture.source_type,
        source_uri: fixture.source_uri,
        license_id: fixture.license_id,
        license_url: fixture.license_url,
        allowed_uses: fixture.allowed_uses,
        source_group: fixture.source_group,
        near_duplicate_group: fixture.near_duplicate_group
      }))
    },
    excluded: [
      "fixture image bytes",
      "internal lineup ownership map",
      "probabilities",
      "external analytics",
      "real private data"
    ]
  };
}

export function downloadExport(session: SessionState, manifest: FixtureManifest): void {
  const payload = JSON.stringify(buildExport(session, manifest), null, 2);
  const blob = new Blob([payload], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `taste-language-local-${session.sessionId.replace(/[^a-zA-Z0-9_-]/g, "")}.json`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
