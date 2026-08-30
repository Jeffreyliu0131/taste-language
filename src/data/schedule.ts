import type { ChoiceValue, PairDefinition } from "../domain/types";

export const TRAINING_SCHEDULE: PairDefinition[] = [
  { id: "t01", phase: "training", leftId: "f01", rightId: "f02", repeatOf: null },
  { id: "t02", phase: "training", leftId: "f03", rightId: "f04", repeatOf: null },
  { id: "t03", phase: "training", leftId: "f05", rightId: "f06", repeatOf: null },
  { id: "t04", phase: "training", leftId: "f02", rightId: "f03", repeatOf: null },
  { id: "t05", phase: "training", leftId: "f04", rightId: "f01", repeatOf: null },
  { id: "t06", phase: "training", leftId: "f06", rightId: "f05", repeatOf: "t03" }
];

export const HOLDOUT_SCHEDULE: PairDefinition[] = [
  { id: "h01", phase: "holdout", leftId: "f07", rightId: "f08", repeatOf: null },
  { id: "h02", phase: "holdout", leftId: "f09", rightId: "f10", repeatOf: null },
  { id: "h03", phase: "holdout", leftId: "f11", rightId: "f12", repeatOf: null }
];

export const DEMO_PERSONA = {
  id: "quiet-observer-v1",
  description: "A deterministic replay fixture that usually prefers open sightlines and lower visual density.",
  trainingChoices: {
    t01: "left",
    t02: "left",
    t03: "left",
    t04: "right",
    t05: "right",
    t06: "right"
  } as Record<string, ChoiceValue>,
  holdoutChoices: {
    h01: "right",
    h02: "left",
    h03: "right"
  } as Record<string, ChoiceValue>
};
