import { HOLDOUT_SCHEDULE, TRAINING_SCHEDULE } from "../data/schedule";
import { isAllowedRenameForAxis, isAllowedVisualLabel } from "../domain/language";
import type {
  AxisEditRecord,
  ChoiceRecord,
  ChoiceValue,
  EditableAxisView,
  PairDefinition,
  ProfileLock,
  SessionState
} from "../domain/types";

export type SessionAction =
  | { type: "SET_THEME"; theme: "light" | "dark" }
  | { type: "LOCK_CONTEXT"; now: string; fixtureSetVersion: string; bundleDigest: string }
  | { type: "RECORD_TRAINING"; pair: PairDefinition; value: ChoiceValue; now: string }
  | { type: "UNDO_TRAINING" }
  | { type: "LOCK_PROFILE"; lock: ProfileLock }
  | { type: "RECORD_HOLDOUT"; pair: PairDefinition; value: ChoiceValue; now: string }
  | { type: "UNDO_HOLDOUT" }
  | { type: "COMPLETE_HOLDOUT" }
  | { type: "SUBMIT_LINEUP"; selection: string }
  | { type: "SUBMIT_PERTURBATION"; selection: string }
  | { type: "ACCEPT_AXIS"; axisId: string; now: string }
  | { type: "REJECT_AXIS"; axisId: string; now: string }
  | { type: "RENAME_AXIS"; axisId: string; label: string; now: string }
  | { type: "MERGE_AXES"; now: string }
  | { type: "UNDO_AXIS_EDIT"; now: string }
  | { type: "SET_SECONDARY_NOTE"; note: string }
  | { type: "FINISH_REVIEW" }
  | { type: "CLEAR_NOTICE" };

interface InitialSessionOptions {
  theme: "light" | "dark";
  viewportClass: "mobile" | "desktop";
  sessionId: string;
}

export function createInitialSession(options: InitialSessionOptions): SessionState {
  return {
    schemaVersion: "session-v1",
    sessionId: options.sessionId,
    revision: 0,
    phase: "context",
    displayTheme: options.theme,
    viewportClass: options.viewportClass,
    contextLockedAt: null,
    boundFixtureSetVersion: null,
    boundFixtureBundleDigest: null,
    trainingCursor: 0,
    trainingChoices: [],
    holdoutCursor: 0,
    holdoutChoices: [],
    lock: null,
    lineupSelection: null,
    perturbationSelection: null,
    editableAxes: [],
    axisUndoStack: [],
    axisEdits: [],
    secondaryNote: "",
    lastNotice: null
  };
}

function bump(state: SessionState, patch: Partial<SessionState>): SessionState {
  return { ...state, ...patch, revision: state.revision + 1 };
}

function choiceFrom(pair: PairDefinition, value: ChoiceValue, now: string): ChoiceRecord {
  return {
    pairId: pair.id,
    leftId: pair.leftId,
    rightId: pair.rightId,
    value,
    recordedAt: now
  };
}

function expectedPair(
  schedule: readonly PairDefinition[],
  cursor: number,
  pair: PairDefinition
): boolean {
  const expected = schedule[cursor];
  return expected?.id === pair.id && expected.leftId === pair.leftId && expected.rightId === pair.rightId;
}

function editableFromLock(lock: ProfileLock): EditableAxisView[] {
  return lock.axisBundle.axes.map((axis) => ({
    id: axis.id,
    componentAxisIds: [axis.id],
    label: axis.label,
    status: "pending"
  }));
}

function recordAxisEdit(
  state: SessionState,
  operation: AxisEditRecord["operation"],
  axisIds: string[],
  after: EditableAxisView[],
  now: string
): SessionState {
  const edit: AxisEditRecord = {
    id: `edit-${state.axisEdits.length + 1}`,
    operation,
    axisIds,
    before: structuredClone(state.editableAxes),
    after: structuredClone(after),
    recordedAt: now
  };
  return bump(state, {
    editableAxes: after,
    axisUndoStack: [...state.axisUndoStack, structuredClone(state.editableAxes)],
    axisEdits: [...state.axisEdits, edit],
    lastNotice: operation === "rename" ? "名称已更新，三组冻结预测没有改变。" : "候选轴状态已更新。"
  });
}

function sanitizeNote(note: string): string {
  return [...note]
    .filter((character) => {
      const code = character.charCodeAt(0);
      return code === 9 || code === 10 || code === 13 || (code >= 32 && code !== 127);
    })
    .join("")
    .slice(0, 400);
}

export function sessionReducer(state: SessionState, action: SessionAction): SessionState {
  switch (action.type) {
    case "SET_THEME":
      if (state.phase !== "context" || state.contextLockedAt) return state;
      return bump(state, { displayTheme: action.theme, lastNotice: null });

    case "LOCK_CONTEXT":
      if (state.phase !== "context") return state;
      return bump(state, {
        phase: "training",
        contextLockedAt: action.now,
        boundFixtureSetVersion: action.fixtureSetVersion,
        boundFixtureBundleDigest: action.bundleDigest,
        lastNotice: "学习情境与显示模式已锁定。"
      });

    case "RECORD_TRAINING":
      if (
        state.phase !== "training" ||
        !expectedPair(TRAINING_SCHEDULE, state.trainingCursor, action.pair)
      ) {
        return state;
      }
      return bump(state, {
        trainingChoices: [...state.trainingChoices, choiceFrom(action.pair, action.value, action.now)],
        trainingCursor: state.trainingCursor + 1,
        lastNotice: `已记录第 ${state.trainingCursor + 1} 组照片选择。`
      });

    case "UNDO_TRAINING":
      if (state.phase !== "training" || state.trainingChoices.length === 0 || state.lock) return state;
      return bump(state, {
        trainingChoices: state.trainingChoices.slice(0, -1),
        trainingCursor: Math.max(0, state.trainingCursor - 1),
        lastNotice: "上一组训练选择已撤销。"
      });

    case "LOCK_PROFILE":
      if (
        state.phase !== "training" ||
        state.trainingChoices.length !== TRAINING_SCHEDULE.length ||
        state.lock
      ) {
        return state;
      }
      return bump(state, {
        phase: "holdout",
        lock: action.lock,
        holdoutCursor: 0,
        holdoutChoices: [],
        lastNotice: "前 6 组选择、候选轴、语言候选位置和 3 组未见照片预测已同时冻结。"
      });

    case "RECORD_HOLDOUT":
      if (
        state.phase !== "holdout" ||
        !state.lock ||
        !expectedPair(HOLDOUT_SCHEDULE, state.holdoutCursor, action.pair)
      ) {
        return state;
      }
      return bump(state, {
        holdoutChoices: [...state.holdoutChoices, choiceFrom(action.pair, action.value, action.now)],
        holdoutCursor: state.holdoutCursor + 1,
        lastNotice: `已记录第 ${state.holdoutCursor + 1} 组未见照片选择。`
      });

    case "UNDO_HOLDOUT":
      if (state.phase !== "holdout" || state.holdoutChoices.length === 0) return state;
      return bump(state, {
        holdoutChoices: state.holdoutChoices.slice(0, -1),
        holdoutCursor: Math.max(0, state.holdoutCursor - 1),
        lastNotice: "上一组未见照片选择已撤销。冻结预测没有改变。"
      });

    case "COMPLETE_HOLDOUT":
      if (
        state.phase !== "holdout" ||
        !state.lock ||
        state.holdoutChoices.length !== HOLDOUT_SCHEDULE.length
      ) {
        return state;
      }
      return bump(state, { phase: "lineup", lastNotice: null });

    case "SUBMIT_LINEUP": {
      if (state.phase !== "lineup" || !state.lock) return state;
      const valid = state.lock.lineupPlan.supported
        ? action.selection === "none" || state.lock.lineupPlan.order.includes(action.selection)
        : action.selection === "unsupported";
      if (!valid) return state;
      return bump(state, {
        phase: "perturbation",
        lineupSelection: action.selection,
        lastNotice: "候选语言已确认，来源仍然隐藏。"
      });
    }

    case "SUBMIT_PERTURBATION": {
      if (state.phase !== "perturbation" || !state.lock) return state;
      const valid = state.lock.perturbationPlan.supported
        ? action.selection === "none" || state.lock.perturbationPlan.order.includes(action.selection)
        : action.selection === "unsupported";
      if (!valid) return state;
      return bump(state, {
        phase: "axis-review",
        perturbationSelection: action.selection,
        editableAxes: editableFromLock(state.lock),
        lastNotice: "两次语言辨认已完成。现在可以查看证据并编辑候选轴。"
      });
    }

    case "ACCEPT_AXIS": {
      if (state.phase !== "axis-review") return state;
      const after = state.editableAxes.map((axis) =>
        axis.id === action.axisId ? { ...axis, status: "accepted" as const } : axis
      );
      return recordAxisEdit(state, "accept", [action.axisId], after, action.now);
    }

    case "REJECT_AXIS": {
      if (state.phase !== "axis-review") return state;
      const after = state.editableAxes.map((axis) =>
        axis.id === action.axisId ? { ...axis, status: "rejected" as const } : axis
      );
      return recordAxisEdit(state, "reject", [action.axisId], after, action.now);
    }

    case "RENAME_AXIS": {
      if (state.phase !== "axis-review") return state;
      const label = action.label.trim();
      const target = state.editableAxes.find((axis) => axis.id === action.axisId);
      if (!target) return state;
      const sourceClaim = target.componentAxisIds.length === 1
        ? state.lock?.axisBundle.axes.find((axis) => axis.id === target.componentAxisIds[0])
        : null;
      const allowed = sourceClaim
        ? isAllowedRenameForAxis(label, sourceClaim)
        : isAllowedVisualLabel(label);
      if (!allowed) {
        return bump(state, {
          lastNotice: "这个名称包含照片无法验证的信息，或改变了当前轴的方向，因此没有保存。候选轴分值和冻结预测都没有改变。"
        });
      }
      const after = state.editableAxes.map((axis) =>
        axis.id === action.axisId ? { ...axis, label, status: "accepted" as const } : axis
      );
      return recordAxisEdit(state, "rename", [action.axisId], after, action.now);
    }

    case "MERGE_AXES": {
      if (state.phase !== "axis-review") return state;
      const activeAxes = state.editableAxes.filter((axis) => axis.status !== "rejected");
      if (activeAxes.length !== 2) {
        return bump(state, { lastNotice: "只有两个仍有效的轴才能合并。" });
      }
      const first = activeAxes[0];
      const second = activeAxes[1];
      if (!first || !second) return state;
      const merged: EditableAxisView = {
        id: "axis-merged",
        componentAxisIds: [...first.componentAxisIds, ...second.componentAxisIds],
        label: `${first.label}与${second.label}`,
        status: "merged"
      };
      return recordAxisEdit(
        state,
        "merge",
        [first.id, second.id],
        [merged],
        action.now
      );
    }

    case "UNDO_AXIS_EDIT": {
      if (state.phase !== "axis-review" || state.axisUndoStack.length === 0) return state;
      const previous = state.axisUndoStack[state.axisUndoStack.length - 1];
      if (!previous) return state;
      const edit: AxisEditRecord = {
        id: `edit-${state.axisEdits.length + 1}`,
        operation: "undo",
        axisIds: previous.flatMap((axis) => axis.componentAxisIds),
        before: structuredClone(state.editableAxes),
        after: structuredClone(previous),
        recordedAt: action.now
      };
      return bump(state, {
        editableAxes: structuredClone(previous),
        axisUndoStack: state.axisUndoStack.slice(0, -1),
        axisEdits: [...state.axisEdits, edit],
        lastNotice: "上一次候选轴编辑已撤销。冻结预测没有改变。"
      });
    }

    case "SET_SECONDARY_NOTE":
      if (state.phase !== "axis-review" && state.phase !== "results") return state;
      return bump(state, { secondaryNote: sanitizeNote(action.note), lastNotice: null });

    case "FINISH_REVIEW":
      if (
        state.phase !== "axis-review" ||
        state.editableAxes.some((axis) => axis.status === "pending")
      ) {
        return state;
      }
      return bump(state, { phase: "results", lastNotice: null });

    case "CLEAR_NOTICE":
      return state.lastNotice ? { ...state, lastNotice: null } : state;
  }
}
