import manifestJson from "../public/fixtures/manifest.json";
import { DEMO_PERSONA, HOLDOUT_SCHEDULE, TRAINING_SCHEDULE } from "../src/data/schedule";
import { fixtureManifestSchema, type ChoiceRecord, type ChoiceValue } from "../src/domain/types";

export const TEST_MANIFEST = fixtureManifestSchema.parse(manifestJson);

export function trainingChoiceRecords(): ChoiceRecord[] {
  return TRAINING_SCHEDULE.map((pair) => {
    const value = DEMO_PERSONA.trainingChoices[pair.id];
    if (!value) throw new Error(`Missing demo choice for ${pair.id}`);
    return {
      pairId: pair.id,
      leftId: pair.leftId,
      rightId: pair.rightId,
      value,
      recordedAt: "2026-08-30T00:00:00.000Z"
    };
  });
}

export function holdoutChoiceRecords(): ChoiceRecord[] {
  return HOLDOUT_SCHEDULE.map((pair) => {
    const value = DEMO_PERSONA.holdoutChoices[pair.id];
    if (!value) throw new Error(`Missing demo choice for ${pair.id}`);
    return {
      pairId: pair.id,
      leftId: pair.leftId,
      rightId: pair.rightId,
      value,
      recordedAt: "2026-08-30T00:01:00.000Z"
    };
  });
}

export function neutralTrainingChoices(value: Extract<ChoiceValue, "tie" | "cant_tell">): ChoiceRecord[] {
  return TRAINING_SCHEDULE.map((pair) => ({
    pairId: pair.id,
    leftId: pair.leftId,
    rightId: pair.rightId,
    value,
    recordedAt: "2026-08-30T00:00:00.000Z"
  }));
}
