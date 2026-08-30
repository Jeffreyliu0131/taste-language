import { z } from "zod";

export const AXIS_KEYS = ["openness", "density"] as const;
export type AxisKey = (typeof AXIS_KEYS)[number];

export const CC0_LICENSE_ID = "CC0-1.0" as const;
export const CC0_LICENSE_URL = "https://creativecommons.org/publicdomain/zero/1.0/" as const;
export const PUBLIC_FIXTURE_ALLOWED_USES = [
  "display",
  "copy",
  "modify",
  "redistribute",
  "commercial-use",
  "model-training"
] as const;

const fixtureSchema = z.object({
  id: z.string().min(1),
  path: z.string().regex(/^\/fixtures\/[a-z0-9-]+\.jpg$/),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  split: z.enum(["training", "holdout"]),
  source_type: z.literal("ai-generated"),
  source_uri: z.string().regex(/^urn:taste-language:fixture:f(?:0[1-9]|1[0-2])$/),
  source_group: z.string().min(1),
  near_duplicate_group: z.string().min(1),
  parent_id: z.null(),
  license_id: z.literal(CC0_LICENSE_ID),
  license_url: z.literal(CC0_LICENSE_URL),
  allowed_uses: z.array(z.enum(PUBLIC_FIXTURE_ALLOWED_USES)).length(PUBLIC_FIXTURE_ALLOWED_USES.length),
  prompt_summary: z.string().min(1),
  style_tags: z.array(z.string().min(1)).min(1),
  visible_features: z.object({
    openness: z.number().min(-2).max(2),
    density: z.number().min(-2).max(2),
  }),
}).superRefine((fixture, context) => {
  if (fixture.source_uri !== `urn:taste-language:fixture:${fixture.id}`) {
    context.addIssue({ code: "custom", message: "fixture source URI must match its public fixture ID" });
  }
  const allowedUses = new Set(fixture.allowed_uses);
  if (
    allowedUses.size !== PUBLIC_FIXTURE_ALLOWED_USES.length ||
    PUBLIC_FIXTURE_ALLOWED_USES.some((use) => !allowedUses.has(use))
  ) {
    context.addIssue({ code: "custom", message: "fixture must carry the complete CC0 public-use declaration" });
  }
});

export const fixtureManifestSchema = z.object({
  schema_version: z.literal("1.1.0"),
  fixture_set_version: z.literal("tl-synthetic-spaces-2026-08-30-cc0-v1"),
  scope: z.literal("public-taste-language-fixtures"),
  created_at: z.string().min(1),
  generator: z.string().min(1),
  generation_disclosure: z.string().min(1),
  rights_affirmer: z.literal("Kairui Liu"),
  rights_effective_date: z.literal("2026-08-30"),
  asset_license_id: z.literal(CC0_LICENSE_ID),
  asset_license_url: z.literal(CC0_LICENSE_URL),
  metadata_license_id: z.literal(CC0_LICENSE_ID),
  metadata_license_url: z.literal(CC0_LICENSE_URL),
  rights_note: z.string().min(1),
  fixtures: z.array(fixtureSchema).length(12),
});

export type Fixture = z.infer<typeof fixtureSchema>;
export type FixtureManifest = z.infer<typeof fixtureManifestSchema>;

export type ChoiceValue = "left" | "right" | "tie" | "cant_tell";

export interface PairDefinition {
  id: string;
  phase: "training" | "holdout";
  leftId: string;
  rightId: string;
  repeatOf: string | null;
}

export interface ChoiceRecord {
  pairId: string;
  leftId: string;
  rightId: string;
  value: ChoiceValue;
  recordedAt: string;
}

export interface AxisEvidenceRef {
  pairId: string;
  chosenId: string;
  otherId: string;
  alignment: "support" | "contradiction";
}

export interface AxisClaim {
  id: string;
  key: AxisKey;
  label: string;
  oppositeLabel: string;
  weight: number;
  supportRefs: AxisEvidenceRef[];
  contradictionRefs: AxisEvidenceRef[];
  uncertainty: "supported" | "tentative";
}

export interface RankerProfile {
  basisVersion: "visible-2d-v1";
  algorithmVersion: "feature-difference-demo-v1";
  beta: Record<AxisKey, number>;
  directionalCount: number;
  neutralCount: number;
  qcRepeatCount: number;
  axes: AxisClaim[];
  wholeProfileAbstainReason: "INSUFFICIENT_DIRECTIONAL_CHOICES" | "EVIDENCE_SUPPORTS_ZERO_AXIS" | null;
}

export interface PredictionRecord {
  pairId: string;
  leftId: string;
  rightId: string;
  ordinal: "left" | "right" | "abstain";
  margin: number;
  probability: null;
  abstainReason: "LOW_MARGIN" | "ZERO_AXIS" | null;
  profileDigest: string;
}

export interface AxisBundle {
  schemaVersion: "axis-bundle-v1";
  scope: "photo-visual-only";
  axes: AxisClaim[];
  generatedBy: string;
}

export type DeliveryState =
  | { status: "delivered"; adapter: string }
  | { status: "failed"; code: "LANGUAGE_ADAPTER_FAILURE"; message: string };

export interface VisibleLineupCandidate {
  opaqueId: string;
  statements: string[];
  counterevidence: string;
}

export interface LineupPlan {
  planVersion: "lineup-plan-v1";
  order: string[];
  candidates: VisibleLineupCandidate[];
  ownOpaqueId: string;
  supported: boolean;
}

export interface PerturbationOption {
  opaqueId: string;
  statements: string[];
}

export interface PerturbationPlan {
  planVersion: "perturbation-plan-v1";
  order: string[];
  options: PerturbationOption[];
  ownOpaqueId: string;
  supported: boolean;
}

export interface ProfileLock {
  lockVersion: "profile-lock-v1";
  context: "long-study-photo-visual";
  createdAt: string;
  displayTheme: "light" | "dark";
  viewportClass: "mobile" | "desktop";
  fixtureSetVersion: string;
  fixtureManifestDigest: string;
  trainingInputDigest: string;
  algorithmVersion: "feature-difference-demo-v1";
  thresholdVersion: "demo-thresholds-v1";
  profile: RankerProfile;
  holdoutSchedule: PairDefinition[];
  holdoutPredictions: PredictionRecord[];
  axisBundle: AxisBundle;
  delivery: DeliveryState;
  lineupPlan: LineupPlan;
  perturbationPlan: PerturbationPlan;
  lockDigest: string;
}

export interface EditableAxisView {
  id: string;
  componentAxisIds: string[];
  label: string;
  status: "pending" | "accepted" | "rejected" | "merged";
}

export interface AxisEditRecord {
  id: string;
  operation: "accept" | "rename" | "reject" | "merge" | "undo";
  axisIds: string[];
  before: EditableAxisView[];
  after: EditableAxisView[];
  recordedAt: string;
}

export type SessionPhase =
  | "context"
  | "training"
  | "holdout"
  | "lineup"
  | "perturbation"
  | "axis-review"
  | "results";

export interface SessionState {
  schemaVersion: "session-v1";
  sessionId: string;
  revision: number;
  phase: SessionPhase;
  displayTheme: "light" | "dark";
  viewportClass: "mobile" | "desktop";
  contextLockedAt: string | null;
  boundFixtureSetVersion: string | null;
  boundFixtureBundleDigest: string | null;
  trainingCursor: number;
  trainingChoices: ChoiceRecord[];
  holdoutCursor: number;
  holdoutChoices: ChoiceRecord[];
  lock: ProfileLock | null;
  lineupSelection: string | null;
  perturbationSelection: string | null;
  editableAxes: EditableAxisView[];
  axisUndoStack: EditableAxisView[][];
  axisEdits: AxisEditRecord[];
  secondaryNote: string;
  lastNotice: string | null;
}
