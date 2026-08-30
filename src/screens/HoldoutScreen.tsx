import { Button, Callout } from "@radix-ui/themes";
import { ArrowCounterClockwise, EyeSlash, Warning } from "@phosphor-icons/react";
import type { Dispatch } from "react";
import { PairComparison } from "../components/PairComparison";
import { useStepFocus } from "../components/useStepFocus";
import { HOLDOUT_SCHEDULE } from "../data/schedule";
import type { Fixture, SessionState } from "../domain/types";
import type { SessionAction } from "../session/reducer";

interface Props {
  session: SessionState;
  fixturesById: Map<string, Fixture>;
  dispatch: Dispatch<SessionAction>;
  now: () => string;
  onRetryFixtures: () => void;
}

export function HoldoutScreen({ session, fixturesById, dispatch, now, onRetryFixtures }: Props) {
  const pair = HOLDOUT_SCHEDULE[session.holdoutCursor];
  const completeHeadingRef = useStepFocus(pair ? `holdout-active-${pair.id}` : "holdout-complete");
  if (pair) {
    const left = fixturesById.get(pair.leftId);
    const right = fixturesById.get(pair.rightId);
    if (!left || !right) {
      return (
        <section className="phase-close error-state" role="alert">
          <Warning size={32} aria-hidden="true" />
          <h1>这组新照片无法安全显示</h1>
          <p>{pair.id} 引用了未注册的本地照片。当前验证已停止，不会显示空白内容，也不会允许作答。</p>
          <Button onClick={onRetryFixtures}>重新校验本地照片</Button>
        </section>
      );
    }
    return (
      <PairComparison
        phase="holdout"
        pair={pair}
        left={left}
        right={right}
        index={session.holdoutCursor}
        total={HOLDOUT_SCHEDULE.length}
        canUndo={session.holdoutChoices.length > 0}
        onChoose={(value) => dispatch({ type: "RECORD_HOLDOUT", pair, value, now: now() })}
        onUndo={() => dispatch({ type: "UNDO_HOLDOUT" })}
      />
    );
  }

  return (
    <section className="phase-close">
      <p className="step-context">3 组新照片已完成</p>
      <h1 ref={completeHeadingRef} tabIndex={-1}>你的选择已记录，预测仍然隐藏</h1>
      <p>接下来会有两次语言辨认。完成后再一起揭示逐项预测、候选语言来源和训练证据。</p>
      <Callout.Root color="gray">
        <Callout.Icon><EyeSlash aria-hidden="true" /></Callout.Icon>
        <Callout.Text>
          浏览器界面会继续隐藏预测值和候选来源。主动检查开发者工具仍可能看到它们，因此这不是研究级盲测。
        </Callout.Text>
      </Callout.Root>
      <div className="phase-close-actions">
        <Button variant="soft" color="gray" onClick={() => dispatch({ type: "UNDO_HOLDOUT" })}>
          <ArrowCounterClockwise aria-hidden="true" />修改最后一题
        </Button>
        <Button size="3" onClick={() => dispatch({ type: "COMPLETE_HOLDOUT" })}>
          继续辨认候选语言
        </Button>
      </div>
    </section>
  );
}
