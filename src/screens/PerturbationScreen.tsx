import { useState, type Dispatch } from "react";
import { Button, Callout } from "@radix-ui/themes";
import { ArrowsLeftRight, Warning } from "@phosphor-icons/react";
import { useStepFocus } from "../components/useStepFocus";
import type { SessionState } from "../domain/types";
import type { SessionAction } from "../session/reducer";

interface Props {
  session: SessionState;
  dispatch: Dispatch<SessionAction>;
}

export function PerturbationScreen({ session, dispatch }: Props) {
  const [selection, setSelection] = useState<string | null>(null);
  const headingRef = useStepFocus("perturbation");
  const plan = session.lock?.perturbationPlan;
  if (!plan) return null;

  if (!plan.supported) {
    const axisCount = session.lock?.axisBundle.axes.length ?? 0;
    return (
      <section className="empty-state">
        <Warning size={32} aria-hidden="true" />
        <p className="step-context">方向对照不足</p>
        <h1 ref={headingRef} tabIndex={-1}>没有可比较的双轴候选语言</h1>
        <p>
          {axisCount === 0
            ? "0 个轴无法通过交换措辞变成有意义的方向对照。"
            : "1 个轴无法组成结构一致的双轴方向对照。原轴仍会进入下一步证据编辑。"}
        </p>
        <Button onClick={() => dispatch({ type: "SUBMIT_PERTURBATION", selection: "unsupported" })}>
          记录为无法对照，查看证据
        </Button>
      </section>
    );
  }

  const byId = new Map(plan.options.map((option) => [option.opaqueId, option]));
  return (
    <section className="lineup-screen perturbation-screen">
      <div className="step-heading compact">
        <div>
          <p className="step-context">第二次语言辨认</p>
          <h1 ref={headingRef} tabIndex={-1}>方向换过以后，哪一种仍然更像你？</h1>
          <p>两种表述的结构完全相同，只交换一个视觉轴的方向。候选来源仍然隐藏。</p>
        </div>
        <ArrowsLeftRight size={28} aria-hidden="true" />
      </div>

      <fieldset className="perturbation-options">
        <legend className="sr-only">选择更接近你的表述</legend>
        {plan.order.map((opaqueId, index) => {
          const option = byId.get(opaqueId);
          if (!option) return null;
          const letter = String.fromCharCode(65 + index);
          return (
            <label className="specimen-option" key={opaqueId}>
              <input
                type="radio"
                name="perturbation"
                value={opaqueId}
                checked={selection === opaqueId}
                onChange={() => setSelection(opaqueId)}
              />
              <span className="candidate-letter" aria-hidden="true">{letter}</span>
              <span className="candidate-copy">
                {option.statements.map((statement) => <span key={statement}>{statement}</span>)}
              </span>
            </label>
          );
        })}
        <label className="specimen-option none-option">
          <input
            type="radio"
            name="perturbation"
            value="none"
            checked={selection === "none"}
            onChange={() => setSelection("none")}
          />
          <span className="candidate-letter" aria-hidden="true">?</span>
          <span className="candidate-copy"><span>两种表述都不接近。</span></span>
        </label>
      </fieldset>

      <Callout.Root color="gray" className="blind-note">
        <Callout.Text>确认后会揭示两次选择与冻结候选的关系，再让你检查照片证据并编辑语言。</Callout.Text>
      </Callout.Root>
      <Button size="3" disabled={!selection} onClick={() => selection && dispatch({ type: "SUBMIT_PERTURBATION", selection })}>
        确认方向，查看证据
      </Button>
    </section>
  );
}
