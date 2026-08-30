import { demoDigest, seededOrder } from "./digest";
import type {
  AxisBundle,
  AxisClaim,
  LineupPlan,
  PerturbationPlan,
  VisibleLineupCandidate
} from "./types";

type CandidateKind = "own" | "polarity" | "axis-swap" | "second-axis-swap";

function copyAxis(axis: AxisClaim, flipped: boolean): { label: string; oppositeLabel: string } {
  return flipped
    ? { label: axis.oppositeLabel, oppositeLabel: axis.label }
    : { label: axis.label, oppositeLabel: axis.oppositeLabel };
}

function candidateStatements(bundle: AxisBundle, kind: CandidateKind): string[] {
  return bundle.axes.map((axis, index) => {
    const flipped =
      kind === "polarity" ||
      (kind === "axis-swap" && index === 0) ||
      (kind === "second-axis-swap" && index === 1);
    const labels = copyAxis(axis, flipped);
    return `更常选择${labels.label}，而不是${labels.oppositeLabel}。`;
  });
}

export function buildLineupPlan(bundle: AxisBundle, seed: string): LineupPlan {
  if (bundle.axes.length !== 2) {
    return {
      planVersion: "lineup-plan-v1",
      order: [],
      candidates: [],
      ownOpaqueId: "unsupported",
      supported: false
    };
  }

  const kinds: CandidateKind[] = ["own", "polarity", "axis-swap", "second-axis-swap"];
  const counterevidence = "证据与反例将在提交后统一揭示。";
  const candidates = kinds.map((kind): VisibleLineupCandidate => ({
    opaqueId: `c-${demoDigest(`${seed}:${kind}`).slice(-8)}`,
    statements: candidateStatements(bundle, kind),
    counterevidence
  }));
  const order = seededOrder(
    candidates.map((candidate) => candidate.opaqueId),
    `${seed}:lineup-order`
  );
  const own = candidates[kinds.indexOf("own")];
  if (!own) throw new Error("Own candidate missing");

  return {
    planVersion: "lineup-plan-v1",
    order,
    candidates,
    ownOpaqueId: own.opaqueId,
    supported: true
  };
}

export function buildPerturbationPlan(bundle: AxisBundle, seed: string): PerturbationPlan {
  if (bundle.axes.length !== 2) {
    return {
      planVersion: "perturbation-plan-v1",
      order: [],
      options: [],
      ownOpaqueId: "unsupported",
      supported: false
    };
  }

  const ownOpaqueId = `p-${demoDigest(`${seed}:own`).slice(-8)}`;
  const perturbedOpaqueId = `p-${demoDigest(`${seed}:perturbed`).slice(-8)}`;
  const ownStatements = candidateStatements(bundle, "own");
  const perturbedStatements = candidateStatements(bundle, "axis-swap");
  const options = [
    { opaqueId: ownOpaqueId, statements: ownStatements },
    { opaqueId: perturbedOpaqueId, statements: perturbedStatements }
  ];
  return {
    planVersion: "perturbation-plan-v1",
    order: seededOrder(
      options.map((option) => option.opaqueId),
      `${seed}:perturbation-order`
    ),
    options,
    ownOpaqueId,
    supported: true
  };
}
