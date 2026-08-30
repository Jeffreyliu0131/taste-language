import type { SessionPhase } from "../domain/types";

const STAGES = [
  { id: "context", label: "锁定情境", phases: ["context"] },
  { id: "choice", label: "照片选择", phases: ["training", "holdout"] },
  { id: "language", label: "语言辨认", phases: ["lineup", "perturbation"] },
  { id: "review", label: "证据编辑", phases: ["axis-review"] },
  { id: "results", label: "查看结果", phases: ["results"] }
] as const;

export function ExperienceProgress({ phase }: { phase: SessionPhase }) {
  const activeIndex = STAGES.findIndex((stage) =>
    (stage.phases as readonly SessionPhase[]).includes(phase)
  );

  return (
    <nav className="experience-progress" aria-label="体验进度">
      <ol>
        {STAGES.map((stage, index) => (
          <li
            key={stage.id}
            className={index < activeIndex ? "complete" : index === activeIndex ? "current" : "upcoming"}
            aria-current={index === activeIndex ? "step" : undefined}
          >
            <span aria-hidden="true" />
            <strong>{stage.label}</strong>
          </li>
        ))}
      </ol>
    </nav>
  );
}
