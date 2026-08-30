import { describe, expect, it } from "vitest";
import { TRAINING_SCHEDULE } from "../data/schedule";
import { isAllowedRenameForAxis, isAllowedVisualLabel } from "./language";
import { fitRanker } from "./ranker";
import { TEST_MANIFEST, trainingChoiceRecords } from "../../tests/fixtures";

describe("visible-only language boundary", () => {
  it.each([
    "电源很多",
    "很清净",
    "适合长坐",
    "消费能力高",
    "座位舒服",
    "网速很快"
  ])("rejects location, behavior or sensitive paraphrase: %s", (label) => {
    expect(isAllowedVisualLabel(label)).toBe(false);
  });

  it("binds rename synonyms to the current axis and polarity", () => {
    const profile = fitRanker(TEST_MANIFEST.fixtures, TRAINING_SCHEDULE, trainingChoiceRecords());
    const openness = profile.axes.find((axis) => axis.key === "openness");
    if (!openness) throw new Error("Missing openness axis");
    expect(isAllowedRenameForAxis("延展视线", openness)).toBe(true);
    expect(isAllowedRenameForAxis("丰富层次", openness)).toBe(false);
    expect(isAllowedRenameForAxis("包裹边界", openness)).toBe(false);
  });
});
