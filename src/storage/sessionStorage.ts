import { demoDigest } from "../domain/digest";
import type { EditableAxisView, SessionState } from "../domain/types";
import { HOLDOUT_SCHEDULE, TRAINING_SCHEDULE } from "../data/schedule";
import { z } from "zod";

export const SESSION_STORAGE_KEY = "taste-language:session-v1";

export type StorageLoadResult =
  | { status: "empty" }
  | { status: "ready"; state: SessionState }
  | { status: "corrupt"; reason: string }
  | { status: "unavailable"; reason: string };

export function storageSnapshotsMatch(
  expected: StorageLoadResult,
  current: StorageLoadResult
): boolean {
  if (expected.status === "empty") return current.status === "empty";
  if (expected.status !== "ready" || current.status !== "ready") return false;
  return (
    expected.state.sessionId === current.state.sessionId &&
    expected.state.revision === current.state.revision &&
    demoDigest(expected.state) === demoDigest(current.state)
  );
}

interface StoredEnvelope {
  schemaVersion: "storage-envelope-v1";
  revision: number;
  digest: string;
  payload: SessionState;
}

export interface StoragePort {
  load(): StorageLoadResult;
  save(state: SessionState): void;
  remove(): void;
}

const pairSchema = z.object({
  id: z.string().min(1),
  phase: z.enum(["training", "holdout"]),
  leftId: z.string().min(1),
  rightId: z.string().min(1),
  repeatOf: z.string().nullable()
});
const choiceSchema = z.object({
  pairId: z.string().min(1),
  leftId: z.string().min(1),
  rightId: z.string().min(1),
  value: z.enum(["left", "right", "tie", "cant_tell"]),
  recordedAt: z.string().min(1)
});
const evidenceRefSchema = z.object({
  pairId: z.string().min(1),
  chosenId: z.string().min(1),
  otherId: z.string().min(1),
  alignment: z.enum(["support", "contradiction"])
});
const axisClaimSchema = z.object({
  id: z.string().min(1),
  key: z.enum(["openness", "density"]),
  label: z.string().min(1),
  oppositeLabel: z.string().min(1),
  weight: z.number(),
  supportRefs: z.array(evidenceRefSchema),
  contradictionRefs: z.array(evidenceRefSchema),
  uncertainty: z.enum(["supported", "tentative"])
});
const profileSchema = z.object({
  basisVersion: z.literal("visible-2d-v1"),
  algorithmVersion: z.literal("feature-difference-demo-v1"),
  beta: z.object({ openness: z.number(), density: z.number() }),
  directionalCount: z.number().int().nonnegative(),
  neutralCount: z.number().int().nonnegative(),
  qcRepeatCount: z.number().int().nonnegative(),
  axes: z.array(axisClaimSchema).max(2),
  wholeProfileAbstainReason: z.enum(["INSUFFICIENT_DIRECTIONAL_CHOICES", "EVIDENCE_SUPPORTS_ZERO_AXIS"]).nullable()
});
const predictionSchema = z.object({
  pairId: z.string().min(1),
  leftId: z.string().min(1),
  rightId: z.string().min(1),
  ordinal: z.enum(["left", "right", "abstain"]),
  margin: z.number(),
  probability: z.null(),
  abstainReason: z.enum(["LOW_MARGIN", "ZERO_AXIS"]).nullable(),
  profileDigest: z.string().startsWith("demo-")
});
const axisBundleSchema = z.object({
  schemaVersion: z.literal("axis-bundle-v1"),
  scope: z.literal("photo-visual-only"),
  axes: z.array(axisClaimSchema).max(2),
  generatedBy: z.string().min(1)
});
const lineupCandidateSchema = z.object({
  opaqueId: z.string().min(1),
  statements: z.array(z.string().min(1)).min(1).max(2),
  counterevidence: z.string().min(1)
});
const lineupPlanSchema = z.object({
  planVersion: z.literal("lineup-plan-v1"),
  order: z.array(z.string().min(1)).max(4),
  candidates: z.array(lineupCandidateSchema).max(4),
  ownOpaqueId: z.string().min(1),
  supported: z.boolean()
}).superRefine((plan, context) => {
  const candidateIds = new Set(plan.candidates.map((candidate) => candidate.opaqueId));
  const orderIds = new Set(plan.order);
  if (plan.supported && (
    plan.order.length !== 4 || orderIds.size !== 4 || candidateIds.size !== 4 ||
    !candidateIds.has(plan.ownOpaqueId) || plan.order.some((id) => !candidateIds.has(id))
  )) {
    context.addIssue({ code: "custom", message: "invalid supported lineup closure" });
  }
  if (!plan.supported && (
    plan.order.length !== 0 || plan.candidates.length !== 0 || plan.ownOpaqueId !== "unsupported"
  )) {
    context.addIssue({ code: "custom", message: "invalid unsupported lineup closure" });
  }
});
const perturbationPlanSchema = z.object({
  planVersion: z.literal("perturbation-plan-v1"),
  order: z.array(z.string().min(1)).max(2),
  options: z.array(z.object({ opaqueId: z.string().min(1), statements: z.array(z.string().min(1)).min(1).max(2) })).max(2),
  ownOpaqueId: z.string().min(1),
  supported: z.boolean()
}).superRefine((plan, context) => {
  const optionIds = new Set(plan.options.map((option) => option.opaqueId));
  const orderIds = new Set(plan.order);
  if (plan.supported && (
    plan.order.length !== 2 || orderIds.size !== 2 || optionIds.size !== 2 ||
    !optionIds.has(plan.ownOpaqueId) || plan.order.some((id) => !optionIds.has(id))
  )) {
    context.addIssue({ code: "custom", message: "invalid supported perturbation closure" });
  }
  if (!plan.supported && (
    plan.order.length !== 0 || plan.options.length !== 0 || plan.ownOpaqueId !== "unsupported"
  )) {
    context.addIssue({ code: "custom", message: "invalid unsupported perturbation closure" });
  }
});
const lockSchema = z.object({
  lockVersion: z.literal("profile-lock-v1"),
  context: z.literal("long-study-photo-visual"),
  createdAt: z.string().min(1),
  displayTheme: z.enum(["light", "dark"]),
  viewportClass: z.enum(["mobile", "desktop"]),
  fixtureSetVersion: z.string().min(1),
  fixtureManifestDigest: z.string().startsWith("demo-"),
  trainingInputDigest: z.string().startsWith("demo-"),
  algorithmVersion: z.literal("feature-difference-demo-v1"),
  thresholdVersion: z.literal("demo-thresholds-v1"),
  profile: profileSchema,
  holdoutSchedule: z.array(pairSchema).length(HOLDOUT_SCHEDULE.length),
  holdoutPredictions: z.array(predictionSchema).length(HOLDOUT_SCHEDULE.length),
  axisBundle: axisBundleSchema,
  delivery: z.union([
    z.object({ status: z.literal("delivered"), adapter: z.string().min(1) }),
    z.object({ status: z.literal("failed"), code: z.literal("LANGUAGE_ADAPTER_FAILURE"), message: z.string().min(1) })
  ]),
  lineupPlan: lineupPlanSchema,
  perturbationPlan: perturbationPlanSchema,
  lockDigest: z.string().startsWith("demo-")
});
const editableAxisSchema = z.object({
  id: z.string().min(1),
  componentAxisIds: z.array(z.string().min(1)).min(1).max(2),
  label: z.string().min(1).max(28),
  status: z.enum(["pending", "accepted", "rejected", "merged"])
});
const axisEditSchema = z.object({
  id: z.string().min(1),
  operation: z.enum(["accept", "rename", "reject", "merge", "undo"]),
  axisIds: z.array(z.string().min(1)).min(1).max(2),
  before: z.array(editableAxisSchema).max(2),
  after: z.array(editableAxisSchema).max(2),
  recordedAt: z.string().min(1)
});
const sessionStateSchema = z.object({
  schemaVersion: z.literal("session-v1"),
  sessionId: z.string().min(1).max(80),
  revision: z.number().int().nonnegative(),
  phase: z.enum(["context", "training", "holdout", "lineup", "perturbation", "axis-review", "results"]),
  displayTheme: z.enum(["light", "dark"]),
  viewportClass: z.enum(["mobile", "desktop"]),
  contextLockedAt: z.string().nullable(),
  boundFixtureSetVersion: z.string().nullable(),
  boundFixtureBundleDigest: z.string().nullable(),
  trainingCursor: z.number().int().min(0).max(TRAINING_SCHEDULE.length),
  trainingChoices: z.array(choiceSchema).max(TRAINING_SCHEDULE.length),
  holdoutCursor: z.number().int().min(0).max(HOLDOUT_SCHEDULE.length),
  holdoutChoices: z.array(choiceSchema).max(HOLDOUT_SCHEDULE.length),
  lock: lockSchema.nullable(),
  lineupSelection: z.string().nullable(),
  perturbationSelection: z.string().nullable(),
  editableAxes: z.array(editableAxisSchema).max(2),
  axisUndoStack: z.array(z.array(editableAxisSchema).max(2)).max(50),
  axisEdits: z.array(axisEditSchema).max(100),
  secondaryNote: z.string().max(400),
  lastNotice: z.string().nullable()
}).superRefine((session, context) => {
  const addIssue = (message: string) => context.addIssue({ code: "custom", message });
  if (session.trainingCursor !== session.trainingChoices.length || session.holdoutCursor !== session.holdoutChoices.length) {
    addIssue("cursor and choice count mismatch");
  }
  const requiresLock = !["context", "training"].includes(session.phase);
  if (requiresLock !== Boolean(session.lock)) {
    addIssue("phase and lock mismatch");
  }
  if (session.phase === "context" && (session.boundFixtureSetVersion || session.boundFixtureBundleDigest)) {
    addIssue("context phase cannot carry bound bundle");
  }
  if (session.phase === "context" && session.contextLockedAt) {
    addIssue("context phase cannot be locked");
  }
  if (session.phase === "context" && (
    session.trainingCursor !== 0 || session.trainingChoices.length !== 0
  )) {
    addIssue("context phase cannot carry training progress");
  }
  if (session.phase !== "context" && (
    !session.contextLockedAt || !session.boundFixtureSetVersion || !session.boundFixtureBundleDigest
  )) {
    addIssue("active phase missing context or bundle binding");
  }
  const trainingClosure = session.trainingChoices.every((choice, index) => {
    const pair = TRAINING_SCHEDULE[index];
    return pair && choice.pairId === pair.id && choice.leftId === pair.leftId && choice.rightId === pair.rightId;
  });
  const holdoutClosure = session.holdoutChoices.every((choice, index) => {
    const pair = HOLDOUT_SCHEDULE[index];
    return pair && choice.pairId === pair.id && choice.leftId === pair.leftId && choice.rightId === pair.rightId;
  });
  if (!trainingClosure || !holdoutClosure) {
    addIssue("choice schedule closure mismatch");
  }

  const afterTraining = ["holdout", "lineup", "perturbation", "axis-review", "results"].includes(session.phase);
  const afterHoldout = ["lineup", "perturbation", "axis-review", "results"].includes(session.phase);
  if (afterTraining && session.trainingChoices.length !== TRAINING_SCHEDULE.length) {
    addIssue("post-training phase requires complete training choices");
  }
  if (afterHoldout && session.holdoutChoices.length !== HOLDOUT_SCHEDULE.length) {
    addIssue("post-holdout phase requires complete holdout choices");
  }
  if (["context", "training"].includes(session.phase) && session.holdoutChoices.length > 0) {
    addIssue("pre-holdout phase cannot carry holdout choices");
  }
  if (["context", "training", "holdout", "lineup"].includes(session.phase) && session.lineupSelection) {
    addIssue("phase cannot carry lineup selection yet");
  }
  if (["context", "training", "holdout", "lineup", "perturbation"].includes(session.phase) && session.perturbationSelection) {
    addIssue("phase cannot carry perturbation selection yet");
  }
  if (!["axis-review", "results"].includes(session.phase) && (
    session.editableAxes.length > 0 || session.axisEdits.length > 0 ||
    session.axisUndoStack.length > 0 || session.secondaryNote.length > 0
  )) {
    addIssue("phase cannot carry axis editing state yet");
  }
  if (session.phase === "results" && session.editableAxes.some((axis) => axis.status === "pending")) {
    addIssue("results phase cannot carry pending axes");
  }

  if (session.lock) {
    const { lockDigest, ...lockPayload } = session.lock;
    if (lockDigest !== demoDigest(lockPayload)) {
      addIssue("profile lock digest mismatch");
    }
    if (JSON.stringify(session.lock.holdoutSchedule) !== JSON.stringify(HOLDOUT_SCHEDULE)) {
      addIssue("holdout schedule drift");
    }
    if (
      session.lock.fixtureSetVersion !== session.boundFixtureSetVersion ||
      session.lock.fixtureManifestDigest !== session.boundFixtureBundleDigest ||
      session.lock.displayTheme !== session.displayTheme ||
      session.lock.viewportClass !== session.viewportClass
    ) {
      addIssue("lock/session binding mismatch");
    }
    const expectedTrainingInputDigest = demoDigest({
      context: "long-study-photo-visual",
      choices: session.trainingChoices.map(({ pairId, leftId, rightId, value }) => ({
        pairId,
        leftId,
        rightId,
        value
      })),
      fixtureSetVersion: session.lock.fixtureSetVersion,
      fixtureBundleDigest: session.lock.fixtureManifestDigest,
      basisVersion: session.lock.profile.basisVersion,
      algorithmVersion: session.lock.profile.algorithmVersion
    });
    if (session.lock.trainingInputDigest !== expectedTrainingInputDigest) {
      addIssue("training choices/profile digest mismatch");
    }
    const profileDigest = demoDigest(session.lock.profile);
    const predictionsClose = session.lock.holdoutPredictions.every((prediction, index) => {
      const pair = HOLDOUT_SCHEDULE[index];
      return pair && prediction.pairId === pair.id && prediction.leftId === pair.leftId &&
        prediction.rightId === pair.rightId && prediction.profileDigest === profileDigest &&
        prediction.probability === null;
    });
    if (!predictionsClose) {
      addIssue("prediction/profile closure mismatch");
    }
    const axesClose = session.lock.axisBundle.axes.every((axis) => {
      const profileAxis = session.lock?.profile.axes.find((candidate) => candidate.id === axis.id);
      return profileAxis && axis.key === profileAxis.key && axis.weight === profileAxis.weight &&
        demoDigest(axis.supportRefs) === demoDigest(profileAxis.supportRefs) &&
        demoDigest(axis.contradictionRefs) === demoDigest(profileAxis.contradictionRefs);
    });
    if (!axesClose || session.lock.axisBundle.axes.length !== session.lock.profile.axes.length) {
      addIssue("language evidence closure mismatch");
    }

    const axisCount = session.lock.axisBundle.axes.length;
    if (
      session.lock.lineupPlan.supported !== (axisCount === 2) ||
      session.lock.perturbationPlan.supported !== (axisCount === 2)
    ) {
      addIssue("language plan support does not match axis count");
    }
    const validLineupSelection = session.lineupSelection === null || (
      session.lock.lineupPlan.supported
        ? session.lineupSelection === "none" || session.lock.lineupPlan.order.includes(session.lineupSelection)
        : session.lineupSelection === "unsupported"
    );
    const validPerturbationSelection = session.perturbationSelection === null || (
      session.lock.perturbationPlan.supported
        ? session.perturbationSelection === "none" || session.lock.perturbationPlan.order.includes(session.perturbationSelection)
        : session.perturbationSelection === "unsupported"
    );
    if (!validLineupSelection || !validPerturbationSelection) {
      addIssue("language selection references an unknown option");
    }
    if (["perturbation", "axis-review", "results"].includes(session.phase) && !session.lineupSelection) {
      addIssue("phase requires lineup selection");
    }
    if (["axis-review", "results"].includes(session.phase) && !session.perturbationSelection) {
      addIssue("phase requires perturbation selection");
    }

    const sourceAxisIds = session.lock.axisBundle.axes.map((axis) => axis.id);
    const sourceAxisIdSet = new Set(sourceAxisIds);
    const frozenInitialAxes: EditableAxisView[] = session.lock.axisBundle.axes.map((axis) => ({
      id: axis.id,
      componentAxisIds: [axis.id],
      label: axis.label,
      status: "pending" as const
    }));
    const coversFrozenAxes = (axes: typeof session.editableAxes): boolean => {
      const componentIds = axes.flatMap((axis) => axis.componentAxisIds);
      return (
        componentIds.length === sourceAxisIds.length &&
        new Set(componentIds).size === componentIds.length &&
        componentIds.every((id) => sourceAxisIdSet.has(id))
      );
    };
    const editCollections = session.axisEdits.flatMap((edit) => [edit.before, edit.after]);
    if (
      [...session.axisUndoStack, ...editCollections].some((axes) => !coversFrozenAxes(axes)) ||
      (["axis-review", "results"].includes(session.phase) && !coversFrozenAxes(session.editableAxes))
    ) {
      addIssue("editable axes do not exactly cover frozen axes");
    }

    if (["axis-review", "results"].includes(session.phase)) {
      let replayCurrent: EditableAxisView[] = structuredClone(frozenInitialAxes);
      const replayStack: typeof session.axisUndoStack = [];
      for (const [index, edit] of session.axisEdits.entries()) {
        if (edit.id !== `edit-${index + 1}` || demoDigest(edit.before) !== demoDigest(replayCurrent)) {
          addIssue("axis edit lineage mismatch");
          break;
        }
        if (edit.operation === "undo") {
          const previous = replayStack.pop();
          if (!previous || demoDigest(edit.after) !== demoDigest(previous)) {
            addIssue("axis undo lineage mismatch");
            break;
          }
        } else {
          replayStack.push(structuredClone(edit.before));
        }
        replayCurrent = structuredClone(edit.after);
      }
      if (
        demoDigest(replayCurrent) !== demoDigest(session.editableAxes) ||
        demoDigest(replayStack) !== demoDigest(session.axisUndoStack)
      ) {
        addIssue("axis edit replay does not match session state");
      }
    }
  }
});
const envelopeSchema = z.object({
  schemaVersion: z.literal("storage-envelope-v1"),
  revision: z.number().int().nonnegative(),
  digest: z.string().startsWith("demo-"),
  payload: sessionStateSchema
});

export class LocalStorageAdapter implements StoragePort {
  load(): StorageLoadResult {
    let raw: string | null;
    try {
      raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
    } catch (error) {
      return {
        status: "unavailable",
        reason: error instanceof Error ? error.message : "Browser storage is unavailable"
      };
    }
    if (!raw) return { status: "empty" };

    try {
      const parsed = envelopeSchema.safeParse(JSON.parse(raw));
      if (!parsed.success) {
        return { status: "corrupt", reason: "Stored session did not match the required schema" };
      }
      const envelope = parsed.data;
      if (
        envelope.revision !== envelope.payload.revision ||
        envelope.digest !== demoDigest(envelope.payload)
      ) {
        return { status: "corrupt", reason: "Stored session digest or revision did not match" };
      }
      return { status: "ready", state: envelope.payload };
    } catch (error) {
      return {
        status: "corrupt",
        reason: error instanceof Error ? error.message : "Stored session could not be parsed"
      };
    }
  }

  save(state: SessionState): void {
    sessionStateSchema.parse(state);
    const envelope: StoredEnvelope = {
      schemaVersion: "storage-envelope-v1",
      revision: state.revision,
      digest: demoDigest(state),
      payload: state
    };
    window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(envelope));
  }

  remove(): void {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
  }
}

export class MemoryStorageAdapter implements StoragePort {
  private state: SessionState | null = null;

  load(): StorageLoadResult {
    return this.state
      ? { status: "ready", state: structuredClone(this.state) }
      : { status: "empty" };
  }

  save(state: SessionState): void {
    this.state = structuredClone(state);
  }

  remove(): void {
    this.state = null;
  }
}
