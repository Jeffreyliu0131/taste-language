import { useMemo, useState, type Dispatch } from "react";
import { Button, Callout, TextArea, TextField } from "@radix-ui/themes";
import {
  ArrowCounterClockwise,
  ArrowsMerge,
  Check,
  PencilSimple,
  Warning,
  X
} from "@phosphor-icons/react";
import { useStepFocus } from "../components/useStepFocus";
import type {
  AxisClaim,
  EditableAxisView,
  Fixture,
  SessionState
} from "../domain/types";
import type { SessionAction } from "../session/reducer";

interface Props {
  session: SessionState;
  fixturesById: Map<string, Fixture>;
  dispatch: Dispatch<SessionAction>;
  now: () => string;
}

function letterFor(order: string[], value: string | null): string {
  if (value === "none") return "都不像";
  if (value === "unsupported") return "不支持";
  if (!value) return "未提交";
  const index = order.indexOf(value);
  return index >= 0 ? String.fromCharCode(65 + index) : "未知";
}

function uniqueFixtureIds(ids: string[]): string[] {
  return [...new Set(ids)];
}

function EvidenceStrip({
  title,
  fixtureIds,
  fixturesById,
  emptyText
}: {
  title: string;
  fixtureIds: string[];
  fixturesById: Map<string, Fixture>;
  emptyText: string;
}) {
  const ids = uniqueFixtureIds(fixtureIds).slice(0, 3);
  return (
    <section className="evidence-group">
      <h3>{title}</h3>
      {ids.length === 0 ? <p className="evidence-empty">{emptyText}</p> : null}
      <div className="evidence-strip">
        {ids.map((id) => {
          const fixture = fixturesById.get(id);
          if (!fixture) return null;
          return (
            <figure key={id}>
              <img src={fixture.path} alt={`训练证据样本 ${id}`} width={fixture.width} height={fixture.height} />
              <figcaption>{id}</figcaption>
            </figure>
          );
        })}
      </div>
    </section>
  );
}

function RenameAxis({
  axis,
  notice,
  onClearNotice,
  onRename
}: {
  axis: EditableAxisView;
  notice: string | null;
  onClearNotice: () => void;
  onRename: (label: string) => void;
}) {
  const [label, setLabel] = useState(axis.label);
  const isError = notice?.startsWith("这个名称") ?? false;
  const messageId = `rename-message-${axis.id}`;
  return (
    <div className="rename-control">
      <div className="rename-row">
        <TextField.Root
          value={label}
          maxLength={28}
          aria-label="新的候选轴名称"
          aria-invalid={isError || undefined}
          aria-describedby={notice ? messageId : undefined}
          onChange={(event) => {
            setLabel(event.currentTarget.value);
            if (notice) onClearNotice();
          }}
        >
          <TextField.Slot><PencilSimple aria-hidden="true" /></TextField.Slot>
        </TextField.Root>
        <Button variant="soft" onClick={() => onRename(label)}>保存名称</Button>
      </div>
      {notice ? (
        <p id={messageId} className={isError ? "field-message error" : "field-message success"} role={isError ? "alert" : "status"}>
          {notice}
        </p>
      ) : null}
    </div>
  );
}

export function AxisReviewScreen({ session, fixturesById, dispatch, now }: Props) {
  const headingRef = useStepFocus("axis-review");
  const [activeAxisId, setActiveAxisId] = useState(session.editableAxes[0]?.id ?? "");
  const lock = session.lock;
  const activeAxis = session.editableAxes.find((axis) => axis.id === activeAxisId) ?? session.editableAxes[0];

  const sourceClaims = useMemo(() => {
    if (!lock || !activeAxis) return [];
    return lock.axisBundle.axes.filter((claim) => activeAxis.componentAxisIds.includes(claim.id));
  }, [activeAxis, lock]);

  if (!lock) return null;
  const lineupOwnLetter = letterFor(lock.lineupPlan.order, lock.lineupPlan.ownOpaqueId);
  const lineupChoiceLetter = letterFor(lock.lineupPlan.order, session.lineupSelection);
  const perturbOwnLetter = letterFor(lock.perturbationPlan.order, lock.perturbationPlan.ownOpaqueId);
  const perturbChoiceLetter = letterFor(lock.perturbationPlan.order, session.perturbationSelection);
  const pendingAxes = session.editableAxes.some((axis) => axis.status === "pending");

  const supportIds = sourceClaims.flatMap((claim) => claim.supportRefs.map((ref) => ref.chosenId));
  const oppositeIds = sourceClaims.flatMap((claim) => claim.supportRefs.map((ref) => ref.otherId));
  const contradictionIds = sourceClaims.flatMap((claim) =>
    claim.contradictionRefs.map((ref) => ref.chosenId)
  );
  const uncertainty = sourceClaims.some((claim) => claim.uncertainty === "tentative")
    ? "暂定"
    : "支持较清楚";

  return (
    <section className="axis-review-screen">
      <div className="step-heading compact">
        <div>
          <p className="step-context">证据与修正</p>
          <h1 ref={headingRef} tabIndex={-1}>检查证据，再决定怎么表达</h1>
          <p>你可以接受、改名、否定或合并候选轴。任何编辑都不会改写已经冻结的三组预测。</p>
        </div>
        <Button
          variant="soft"
          color="gray"
          disabled={session.axisUndoStack.length === 0}
          onClick={() => dispatch({ type: "UNDO_AXIS_EDIT", now: now() })}
        >
          <ArrowCounterClockwise aria-hidden="true" />撤销编辑
        </Button>
      </div>

      <div className="blind-reveal">
        <div>
          <span>第一次语言辨认</span>
          <strong>你选了 {lineupChoiceLetter}，冻结候选是 {lineupOwnLetter}</strong>
        </div>
        <div>
          <span>第二次方向辨认</span>
          <strong>你选了 {perturbChoiceLetter}，原方向是 {perturbOwnLetter}</strong>
        </div>
        <p>这两次选择只帮助你检查语言是否具体可辨，不构成正式的反通用描述验证。</p>
      </div>

      {lock.delivery.status === "failed" ? (
        <Callout.Root color="red">
          <Callout.Icon><Warning aria-hidden="true" /></Callout.Icon>
          <Callout.Text>
            候选语言生成失败：{lock.delivery.message}。下方只显示确定性证据摘要，这不能记作 0 个轴。
          </Callout.Text>
        </Callout.Root>
      ) : null}

      {session.editableAxes.length === 0 ? (
        <div className="zero-axis-panel">
          <Warning size={28} aria-hidden="true" />
          <h2>当前证据支持 0 个候选轴</h2>
          <p>方向选择不足、矛盾过多或分数未过演示阈值时，系统保持拒答，不补写偏好语言。</p>
        </div>
      ) : (
        <div className="axis-editor-grid">
          <nav className="axis-index" aria-label="候选轴">
            {session.editableAxes.map((axis) => (
              <button
                type="button"
                key={axis.id}
                className={axis.id === activeAxis?.id ? "active" : ""}
                aria-current={axis.id === activeAxis?.id ? "true" : undefined}
                onClick={() => setActiveAxisId(axis.id)}
              >
                <span>{axis.label}</span>
                <small>{axis.status === "pending" ? "待处置" : axis.status === "accepted" ? "已接受" : axis.status === "rejected" ? "已否定" : "已合并"}</small>
              </button>
            ))}
            {session.editableAxes.filter((axis) => axis.status !== "rejected").length === 2 ? (
              <Button variant="soft" color="gray" onClick={() => dispatch({ type: "MERGE_AXES", now: now() })}>
                <ArrowsMerge aria-hidden="true" />合并为一个表达
              </Button>
            ) : null}
          </nav>

          {activeAxis ? (
            <article className="axis-workspace">
              <header>
                <div>
                  <p className="axis-state">{uncertainty}</p>
                  <h2>{activeAxis.label}</h2>
                </div>
                <span className={`axis-status status-${activeAxis.status}`}>
                  {activeAxis.status === "pending" ? "待处置" : activeAxis.status === "accepted" ? "已接受" : activeAxis.status === "rejected" ? "已否定" : "已合并"}
                </span>
              </header>

              <div className="evidence-ledger">
                <EvidenceStrip title="支持这个方向的选择" fixtureIds={supportIds} fixturesById={fixturesById} emptyText="没有足够的支持样本。" />
                <EvidenceStrip title="同组没有选择的另一张" fixtureIds={oppositeIds} fixturesById={fixturesById} emptyText="没有可显示的对照照片。" />
                <EvidenceStrip title="与这个方向冲突的选择" fixtureIds={contradictionIds} fixturesById={fixturesById} emptyText="当前 6 组选择中没有观察到明确冲突。" />
              </div>

              <details className="score-detail">
                <summary>查看计算细节</summary>
                {sourceClaims.map((claim: AxisClaim) => (
                  <p key={claim.id}>
                    {claim.key}: margin weight {claim.weight.toFixed(3)}，support {claim.supportRefs.length}，contradiction {claim.contradictionRefs.length}。这是 score unit，不是概率。
                  </p>
                ))}
              </details>

              <RenameAxis
                key={`${activeAxis.id}:${activeAxis.label}`}
                axis={activeAxis}
                notice={session.lastNotice?.includes("名称") ? session.lastNotice : null}
                onClearNotice={() => dispatch({ type: "CLEAR_NOTICE" })}
                onRename={(label) => dispatch({ type: "RENAME_AXIS", axisId: activeAxis.id, label, now: now() })}
              />
              <div className="axis-actions">
                <Button onClick={() => dispatch({ type: "ACCEPT_AXIS", axisId: activeAxis.id, now: now() })}>
                  <Check aria-hidden="true" />接受
                </Button>
                <Button variant="soft" color="red" onClick={() => dispatch({ type: "REJECT_AXIS", axisId: activeAxis.id, now: now() })}>
                  <X aria-hidden="true" />否定
                </Button>
              </div>
            </article>
          ) : null}
        </div>
      )}

      <div className={`notice-region ${session.lastNotice?.startsWith("这个名称") ? "error" : ""}`} aria-live="polite">
        {session.lastNotice && !session.lastNotice.includes("名称") ? <p>{session.lastNotice}</p> : null}
      </div>

      <section className="secondary-note">
        <label htmlFor="secondary-note">我注意到的可见细节（可选）</label>
        <p>这段备注现在才会被记录，只用于补充你自己的表达。它不会进入计算、候选轴或已冻结预测。</p>
        <TextArea
          id="secondary-note"
          maxLength={400}
          value={session.secondaryNote}
          placeholder="例如：我在意桌面周围是否留有视觉空白。"
          onChange={(event) => dispatch({ type: "SET_SECONDARY_NOTE", note: event.currentTarget.value })}
        />
        <span>{session.secondaryNote.length} / 400</span>
      </section>

      <div className="review-finish">
        {pendingAxes ? <p>每个候选轴都需要接受、改名、否定，或与另一个轴合并。</p> : <p>候选轴已经处理完成。下一页只整理现有记录，不会重新计算。</p>}
        <Button size="3" disabled={pendingAxes} onClick={() => dispatch({ type: "FINISH_REVIEW" })}>
          查看分开的三份结果
        </Button>
      </div>
    </section>
  );
}
