import { Button } from "@radix-ui/themes";
import { ArrowCounterClockwise, Keyboard } from "@phosphor-icons/react";
import type { KeyboardEvent } from "react";
import { useStepFocus } from "./useStepFocus";
import type { ChoiceValue, Fixture, PairDefinition } from "../domain/types";

interface PairComparisonProps {
  phase: "training" | "holdout";
  pair: PairDefinition;
  left: Fixture;
  right: Fixture;
  index: number;
  total: number;
  canUndo: boolean;
  onChoose: (value: ChoiceValue) => void;
  onUndo: () => void;
}

export function PairComparison({
  phase,
  pair,
  left,
  right,
  index,
  total,
  canUndo,
  onChoose,
  onUndo
}: PairComparisonProps) {
  const headingRef = useStepFocus(pair.id);
  const phaseLabel = phase === "training" ? "形成偏好" : "未见照片验证";

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest("input, textarea, select, [role='dialog']")) return;
    const key = event.key.toLowerCase();
    const value = key === "a" ? "left" : key === "b" ? "right" : key === "t" ? "tie" : key === "n" ? "cant_tell" : null;
    if (!value) return;
    event.preventDefault();
    onChoose(value);
  };

  return (
    <section className="comparison-workbench" onKeyDown={onKeyDown} aria-labelledby="pair-title">
      <div className="step-heading">
        <div>
          <p className="step-context">{phaseLabel} {index + 1} / {total}</p>
          <h1 id="pair-title" ref={headingRef} tabIndex={-1}>
            独自长时间学习时，你更想看到哪种空间？
          </h1>
          <p>
            {phase === "training"
              ? "只比较构图、光线、视觉边界和物件层次。先凭感觉选择，不需要解释。"
              : "这两张照片没有出现在前 6 组中。系统预测已经锁定，现在仍不会显示。"}
          </p>
          {phase === "holdout" ? (
            <details className="method-note">
              <summary>为什么先隐藏预测？</summary>
              <p>先记录你的选择，再到结果页对照，可以避免答案提示你。但预测仍存在当前浏览器中，所以这只是界面隐藏，不是真正的研究级盲测。</p>
            </details>
          ) : null}
        </div>
        <div className="keyboard-hint"><Keyboard aria-hidden="true" />A / B / T / N</div>
      </div>

      <fieldset className="pair-fieldset">
        <legend className="sr-only">选择照片 A、照片 B、同样适合或看不出来</legend>
        <div className="pair-grid">
          <figure className="sample-board">
            <div className="sample-image-wrap">
              <img src={left.path} alt="合成空间图像 A" width={left.width} height={left.height} />
            </div>
            <figcaption>
              <span>照片 A</span>
              <button type="button" className="sample-choice" onClick={() => onChoose("left")} aria-keyshortcuts="A">
                选择 A
              </button>
            </figcaption>
          </figure>
          <figure className="sample-board">
            <div className="sample-image-wrap">
              <img src={right.path} alt="合成空间图像 B" width={right.width} height={right.height} />
            </div>
            <figcaption>
              <span>照片 B</span>
              <button type="button" className="sample-choice" onClick={() => onChoose("right")} aria-keyshortcuts="B">
                选择 B
              </button>
            </figcaption>
          </figure>
        </div>
        <div className="neutral-actions">
          <Button variant="soft" color="gray" onClick={() => onChoose("tie")} aria-keyshortcuts="T">
            同样适合
          </Button>
          <Button variant="soft" color="gray" onClick={() => onChoose("cant_tell")} aria-keyshortcuts="N">
            看不出来
          </Button>
          <Button variant="ghost" color="gray" disabled={!canUndo} onClick={onUndo}>
            <ArrowCounterClockwise aria-hidden="true" />撤销上一题
          </Button>
        </div>
      </fieldset>
    </section>
  );
}
