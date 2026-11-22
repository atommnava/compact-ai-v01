// lib/paic/evaluateMemoryCandidates.test.ts
import { describe, it, expect } from "vitest";
import { evaluateMemoryCandidates } from "@/lib/paic/evaluateMemoryCandidates";
import {
  extractMemoriesFromConversation,
  UNKNOWN_CONVERSATION_ID,
} from "@/lib/paic/extractMemories";
import type { MemoryCandidate } from "@/lib/paic/memoryCandidate";
import type { Conversation } from "@/lib/paic/conversation";

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
    status: "pending",
    ...overrides,
  };
}

describe("evaluateMemoryCandidates", () => {
  it("rechaza los candidatos que el extractor no sugiere guardar", () => {
    const [result] = evaluateMemoryCandidates([
      makeCandidate({ confidence: 0.6, shouldPersist: false }),
    ]);

    expect(result.status).toBe("rejected");
    expect(result.evaluationReason).toContain("0.6");
  });

  it("manda a revisión los candidatos de origen desconocido", () => {
    const [result] = evaluateMemoryCandidates([
      makeCandidate({ sourceConversationId: UNKNOWN_CONVERSATION_ID }),
    ]);

    expect(result.status).toBe("review");
    expect(result.evaluationReason).toContain("Unknown origin");
  });

  it("nunca aprueba automáticamente, aunque la confianza sea alta", () => {
    const [result] = evaluateMemoryCandidates([makeCandidate({ confidence: 0.95 })]);

    expect(result.status).toBe("review");
    expect(result.evaluationReason).toBeDefined();
  });

  it("no cambia candidatos que ya tienen una decisión", () => {
    const decided = [
      makeCandidate({ id: "a", status: "approved" }),
      makeCandidate({ id: "b", status: "rejected" }),
      makeCandidate({ id: "c", status: "review" }),
    ];

    expect(evaluateMemoryCandidates(decided)).toEqual(decided);
  });

  it("no modifica los candidatos originales", () => {
    const original = makeCandidate();

    evaluateMemoryCandidates([original]);

    expect(original.status).toBe("pending");
    expect(original.evaluationReason).toBeUndefined();
  });

  it("evalúa la salida real del extractor de conversaciones", () => {
    const timestamp = "2026-11-22T00:00:00.000Z";
    const conversation: Conversation = {
      id: "conversation-1",
      createdAt: timestamp,
      updatedAt: timestamp,
      messages: [
        { id: "m1", role: "user", content: "Hello, how are you?", timestamp },
        { id: "m2", role: "assistant", content: "I am fine, thank you!", timestamp },
        { id: "m3", role: "user", content: "I am building a startup project.", timestamp },
      ],
    };

    const { candidates } = extractMemoriesFromConversation(conversation);
    const evaluated = evaluateMemoryCandidates(candidates);

    expect(evaluated.map((c) => ({ content: c.content, status: c.status }))).toEqual([
      { content: "Hello, how are you?", status: "rejected" },
      { content: "I am building a startup project.", status: "review" },
    ]);
  });
});