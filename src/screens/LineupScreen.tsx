import { useState, type Dispatch } from "react";
import { Button, Callout } from "@radix-ui/themes";
import { Question, Warning } from "@phosphor-icons/react";
import { useStepFocus } from "../components/useStepFocus";
import type { SessionState } from "../domain/types";
import type { SessionAction } from "../session/reducer";

interface Props {
  session: SessionState;
  dispatch: Dispatch<SessionAction>;
}

export function LineupScreen({ session, dispatch }: Props) {
  const [selection, setSelection] = useState<string | null>(null);
  const headingRef = useStepFocus("lineup");
  const plan = session.lock?.lineupPlan;
  if (!plan) return null;

  if (!plan.supported) {
    const axisCount = session.lock?.axisBundle.axes.length ?? 0;
    return (
      <section className="empty-state">
        <Warning size={32} aria-hidden="true" />
        <p className="step-context">候选语言不足</p>
        <h1 ref={headingRef} tabIndex={-1}>
          {axisCount === 0 ? "当前证据支持 0 个候选轴" : "当前只有 1 个候选轴，无法组成四项对照"}
        </h1>
        <p>
          {axisCount === 0
            ? "系统不会为了填满界面而编写一组看似准确的语言。这和语言生成失败是两种不同状态。"
            : "四项对照需要两个不同的视觉轴。这个轴仍会进入证据编辑，但系统不会复制出几个假选项。"}
        </p>
        <Button onClick={() => dispatch({ type: "SUBMIT_LINEUP", selection: "unsupported" })}>
          记录为无法对照，继续
        </Button>
      </section>
    );
  }

  const byId = new Map(plan.candidates.map((candidate) => [candidate.opaqueId, candidate]));
  return (
    <section className="lineup-screen">
      <div className="step-heading compact">
        <div>
          <p className="step-context">第一次语言辨认</p>
          <h1 ref={headingRef} tabIndex={-1}>哪一组说法更接近你的选择方式？</h1>
          <p>四组选项保持相同结构，其中只有一组来自刚才冻结的候选轴。你也可以选择“都不像”。</p>
        </div>
        <Question size={28} aria-hidden="true" />
      </div>

      <fieldset className="specimen-list">
        <legend className="sr-only">选择最接近你的候选语言</legend>
        {plan.order.map((opaqueId, index) => {
          const candidate = byId.get(opaqueId);
          if (!candidate) return null;
          const letter = String.fromCharCode(65 + index);
          return (
            <label className="specimen-option" key={opaqueId}>
              <input
                type="radio"
                name="lineup"
                value={opaqueId}
                checked={selection === opaqueId}
                onChange={() => setSelection(opaqueId)}
              />
              <span className="candidate-letter" aria-hidden="true">{letter}</span>
              <span className="candidate-copy">
                {candidate.statements.map((statement) => <span key={statement}>{statement}</span>)}
                <small>{candidate.counterevidence}</small>
              </span>
            </label>
          );
        })}
        <label className="specimen-option none-option">
          <input
            type="radio"
            name="lineup"
            value="none"
            checked={selection === "none"}
            onChange={() => setSelection("none")}
          />
          <span className="candidate-letter" aria-hidden="true">?</span>
          <span className="candidate-copy"><span>这些说法都不像我的选择方式。</span></span>
        </label>
      </fieldset>

      <Callout.Root color="gray" className="blind-note">
        <Callout.Text>提交后还不会揭示来源。下一题会只交换一个方向，检查你是在辨认具体内容，还是认同通用说法。</Callout.Text>
      </Callout.Root>
      <Button size="3" disabled={!selection} onClick={() => selection && dispatch({ type: "SUBMIT_LINEUP", selection })}>
        确认这组说法
      </Button>
    </section>
  );
}
