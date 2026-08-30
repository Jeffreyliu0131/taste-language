import { Button, Callout } from "@radix-ui/themes";
import { Lock, ArrowCounterClockwise, Warning } from "@phosphor-icons/react";
import type { Dispatch } from "react";
import { PairComparison } from "../components/PairComparison";
import { useStepFocus } from "../components/useStepFocus";
import { TRAINING_SCHEDULE } from "../data/schedule";
import type { Fixture, SessionState } from "../domain/types";
import type { SessionAction } from "../session/reducer";

interface Props {
  session: SessionState;
  fixturesById: Map<string, Fixture>;
  dispatch: Dispatch<SessionAction>;
  now: () => string;
  onFreeze: () => void;
  onRetryFixtures: () => void;
}

export function TrainingScreen({ session, fixturesById, dispatch, now, onFreeze, onRetryFixtures }: Props) {
  const pair = TRAINING_SCHEDULE[session.trainingCursor];
  const completeHeadingRef = useStepFocus(pair ? `training-active-${pair.id}` : "training-complete");
  if (pair) {
    const left = fixturesById.get(pair.leftId);
    const right = fixturesById.get(pair.rightId);
    if (!left || !right) {
      return (
        <section className="phase-close error-state" role="alert">
          <Warning size={32} aria-hidden="true" />
          <h1>这组照片无法安全显示</h1>
          <p>{pair.id} 引用了未注册的本地照片。当前题已停止，不会显示空白内容，也不会允许作答。</p>
          <Button onClick={onRetryFixtures}>重新校验本地照片</Button>
        </section>
      );
    }
    return (
      <PairComparison
        phase="training"
        pair={pair}
        left={left}
        right={right}
        index={session.trainingCursor}
        total={TRAINING_SCHEDULE.length}
        canUndo={session.trainingChoices.length > 0}
        onChoose={(value) => dispatch({ type: "RECORD_TRAINING", pair, value, now: now() })}
        onUndo={() => dispatch({ type: "UNDO_TRAINING" })}
      />
    );
  }

  const directional = session.trainingChoices.filter(
    (choice) => choice.value === "left" || choice.value === "right"
  ).length;
  return (
    <section className="phase-close">
      <p className="step-context">6 组选择已完成</p>
      <h1 ref={completeHeadingRef} tabIndex={-1}>确认冻结后，后面的选择不会改写结果</h1>
      <p>已记录 {session.trainingChoices.length} 组选择，其中 {directional} 组有明确方向。最后一组是位置互换检查，只用于观察前后是否一致。</p>
      <div className="freeze-contract" aria-label="冻结内容">
        <strong>确认后会同时锁定</strong>
        <ul>
          <li>这 6 组选择形成的偏好摘要</li>
          <li>0-2 个候选视觉轴</li>
          <li>接下来 3 组未见照片的逐项预测</li>
          <li>两次语言辨认中候选项的位置</li>
        </ul>
      </div>
      <Callout.Root color="amber">
        <Callout.Icon><Lock aria-hidden="true" /></Callout.Icon>
        <Callout.Text>
          信息不足时可以得到 0 个轴或拒绝预测。系统不会为了给出结果而补写语言，也不会生成概率。
        </Callout.Text>
      </Callout.Root>
      <div className="phase-close-actions">
        <Button variant="soft" color="gray" onClick={() => dispatch({ type: "UNDO_TRAINING" })}>
          <ArrowCounterClockwise aria-hidden="true" />修改最后一题
        </Button>
        <Button size="3" onClick={onFreeze}>确认冻结，进入 3 组新照片</Button>
      </div>
    </section>
  );
}
