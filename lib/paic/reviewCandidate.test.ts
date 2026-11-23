// lib/paic/reviewCandidate.test.ts
import { describe, it, expect } from "vitest";
import { approveCandidate, rejectCandidate } from "@/lib/paic/reviewCandidate";
import { evaluateMemoryCandidates } from "@/lib/paic/evaluateMemoryCandidates";
import type { MemoryCandidate } from "@/lib/paic/memoryCandidate";

// Crea un candidato válido y permite cambiar solo los campos que importan en cada test.
function makeCandidate(overrides: Partial<MemoryCandidate> = {}): MemoryCandidate {
  return {
    id: "candidate-1",
    sourceConversationId: "conversation-1",
    sourceMessageId: "m1",
    content: "My name is Atom",
    category: "identity",
    confidence: 0.95,
    reason: "Explicit statement made by the user.",
    shouldPersist: true,
    status: "review",
    ...overrides,
  };
}

describe("approveCandidate", () => {
  it("aprueba el candidato con un motivo por defecto", () => {
    const result = approveCandidate(makeCandidate());

    expect(result.status).toBe("approved");
    expect(result.evaluationReason).toBe("Approved by the user.");
  });

  it("guarda el motivo que escribe la persona", () => {
    const result = approveCandidate(makeCandidate(), "  Correct, this is my name.  ");

    expect(result.evaluationReason).toBe("Correct, this is my name.");
  });

  it("usa el motivo por defecto si el motivo está vacío", () => {
    const result = approveCandidate(makeCandidate(), "   ");

    expect(result.evaluationReason).toBe("Approved by the user.");
  });

  it("permite revertir un rechazo propuesto por el evaluador", () => {
    const rejected = makeCandidate({
      status: "rejected",
      evaluationReason: "Low heuristic confidence (0.6); the extractor does not suggest saving it.",
    });

    const result = approveCandidate(rejected);

    expect(result.status).toBe("approved");
    expect(result.evaluationReason).toBe("Approved by the user.");
  });
});

describe("rejectCandidate", () => {
  it("rechaza el candidato con un motivo por defecto", () => {
    const result = rejectCandidate(makeCandidate());

    expect(result.status).toBe("rejected");
    expect(result.evaluationReason).toBe("Rejected by the user.");
  });

  it("guarda el motivo que escribe la persona", () => {
    const result = rejectCandidate(makeCandidate(), "This is not true anymore.");

    expect(result.evaluationReason).toBe("This is not true anymore.");
  });
});

describe("decisiones humanas", () => {
  it("no modifican el candidato original", () => {
    const original = makeCandidate();

    approveCandidate(original);
    rejectCandidate(original);

    expect(original.status).toBe("review");
    expect(original.evaluationReason).toBeUndefined();
  });

  it("el evaluador respeta una aprobación humana", () => {
    const [evaluated] = evaluateMemoryCandidates([makeCandidate({ status: "pending" })]);
    expect(evaluated.status).toBe("review");

    const approved = approveCandidate(evaluated);
    const [reevaluated] = evaluateMemoryCandidates([approved]);

    expect(reevaluated.status).toBe("approved");
    expect(reevaluated.evaluationReason).toBe("Approved by the user.");
  });
});