import type { AxisBundle, AxisClaim, AxisKey, DeliveryState, RankerProfile } from "./types";

export interface TrainingProjection {
  readonly context: "long-study-photo-visual";
  readonly profile: RankerProfile;
  readonly fixtureSetVersion: string;
}

type DeepReadonly<T> =
  T extends readonly (infer Item)[]
    ? readonly DeepReadonly<Item>[]
    : T extends object
      ? { readonly [Key in keyof T]: DeepReadonly<T[Key]> }
      : T;

export type ReadonlyTrainingProjection = DeepReadonly<TrainingProjection>;

export interface LanguageAdapter {
  readonly id: string;
  proposeLabels(input: ReadonlyTrainingProjection): LanguageLabelProposal[];
}

export interface LanguageLabelProposal {
  axisId: string;
  label: string;
  oppositeLabel: string;
}

export class DeterministicTemplateAdapter implements LanguageAdapter {
  readonly id = "deterministic-template-adapter";

  proposeLabels(input: ReadonlyTrainingProjection): LanguageLabelProposal[] {
    return input.profile.axes.map((axis) => ({
      axisId: axis.id,
      label: axis.label,
      oppositeLabel: axis.oppositeLabel
    }));
  }
}

export const FORBIDDEN_VISUAL_CLAIM_PATTERN =
  /(安静|清净|安宁|噪声|吵|插座|电源|充电|舒适|久坐|长坐|座椅|座位|拥挤|拥堵|价格|便宜|昂贵|消费|店规|网速|网络|wifi|咖啡店|地点适合|适合学习|人格|身份|收入|富裕|健康|quiet|noise|outlet|power|comfortable|seat|crowd|price|income|personality|health)/i;

const ALLOWED_VISUAL_LABEL_PATTERN =
  /^(?:(?:开阔|开放|延展|通透|包裹|封闭|明确|柔和|硬朗|丰富|层叠|层次|留白|简洁|稀疏|密集|有序|秩序|杂乱|明亮|昏暗|冷色|暖色|冷暖|自然光|人工光|视线|边界|构图|材质|色彩|光线|画面|物件|空间视觉|视觉|与|和|偏向|相比|更|少|多|、|\/|\s|-)+)$/;

const AXIS_POLARITY_LABELS: Record<AxisKey, { positive: readonly string[]; negative: readonly string[] }> = {
  openness: {
    positive: ["开阔视线", "延展视线", "通透边界", "开放视线"],
    negative: ["包裹边界", "封闭边界", "明确边界"]
  },
  density: {
    positive: ["丰富层次", "层叠物件", "密集层次"],
    negative: ["留白秩序", "简洁留白", "稀疏物件"]
  }
};

export function isAllowedVisualLabel(label: string): boolean {
  const normalized = label.trim();
  return (
    normalized.length >= 2 &&
    normalized.length <= 28 &&
    !FORBIDDEN_VISUAL_CLAIM_PATTERN.test(normalized) &&
    ALLOWED_VISUAL_LABEL_PATTERN.test(normalized)
  );
}

function expectedPolarity(axis: AxisClaim): { preferred: readonly string[]; opposite: readonly string[] } {
  const labels = AXIS_POLARITY_LABELS[axis.key];
  return axis.weight >= 0
    ? { preferred: labels.positive, opposite: labels.negative }
    : { preferred: labels.negative, opposite: labels.positive };
}

export function isAllowedRenameForAxis(label: string, axis: AxisClaim): boolean {
  const normalized = label.trim();
  return isAllowedVisualLabel(normalized) && expectedPolarity(axis).preferred.includes(normalized);
}

function isAllowedAdapterPair(proposal: LanguageLabelProposal, axis: AxisClaim): boolean {
  const polarity = expectedPolarity(axis);
  return (
    isAllowedVisualLabel(proposal.label) &&
    isAllowedVisualLabel(proposal.oppositeLabel) &&
    polarity.preferred.includes(proposal.label.trim()) &&
    polarity.opposite.includes(proposal.oppositeLabel.trim())
  );
}

function deepFreeze<T>(value: T): DeepReadonly<T> {
  if (value !== null && typeof value === "object") {
    for (const nested of Object.values(value as Record<string, unknown>)) {
      deepFreeze(nested);
    }
    Object.freeze(value);
  }
  return value as DeepReadonly<T>;
}

export function generateLanguageSafely(
  adapter: LanguageAdapter,
  input: TrainingProjection
): { bundle: AxisBundle; delivery: DeliveryState } {
  const canonicalProfile = structuredClone(input.profile);
  const adapterInput = deepFreeze<TrainingProjection>({
    context: input.context,
    profile: structuredClone(canonicalProfile),
    fixtureSetVersion: input.fixtureSetVersion
  });
  try {
    const proposals = adapter.proposeLabels(adapterInput);
    if (proposals.length !== canonicalProfile.axes.length) {
      throw new Error("Language adapter returned an incomplete label projection");
    }
    const byAxisId = new Map(proposals.map((proposal) => [proposal.axisId, proposal]));
    if (byAxisId.size !== proposals.length) {
      throw new Error("Language adapter returned duplicate axis labels");
    }
    const axes = canonicalProfile.axes.map((axis) => {
      const proposal = byAxisId.get(axis.id);
      if (
        !proposal ||
        !isAllowedAdapterPair(proposal, axis)
      ) {
        throw new Error("Language adapter returned an unsupported claim");
      }
      return {
        ...axis,
        label: proposal.label.trim(),
        oppositeLabel: proposal.oppositeLabel.trim(),
        supportRefs: axis.supportRefs.map((ref) => ({ ...ref })),
        contradictionRefs: axis.contradictionRefs.map((ref) => ({ ...ref }))
      };
    });
    if (proposals.some((proposal) => !canonicalProfile.axes.some((axis) => axis.id === proposal.axisId))) {
      throw new Error("Language adapter returned an unknown axis");
    }
    const bundle: AxisBundle = {
      schemaVersion: "axis-bundle-v1",
      scope: "photo-visual-only",
      axes,
      generatedBy: adapter.id
    };
    return {
      bundle,
      delivery: { status: "delivered", adapter: adapter.id }
    };
  } catch {
    return {
      bundle: {
        schemaVersion: "axis-bundle-v1",
        scope: "photo-visual-only",
        axes: canonicalProfile.axes.map((axis) => ({
          ...axis,
          supportRefs: axis.supportRefs.map((ref) => ({ ...ref })),
          contradictionRefs: axis.contradictionRefs.map((ref) => ({ ...ref }))
        })),
        generatedBy: "deterministic-template-adapter"
      },
      delivery: {
        status: "failed",
        code: "LANGUAGE_ADAPTER_FAILURE",
        message: "语言模块没有返回符合照片可见边界的标签。"
      }
    };
  }
}
