// lib/paic/persistApprovedCandidates.test.ts
import { describe, it, expect } from "vitest";
import {
  persistApprovedCandidates,
  RULE_EXTRACTOR,
} from "@/lib/paic/persistApprovedCandidates";
import { createEmptyPAIC } from "@/lib/paic/createEmptyPAIC";
import { addMemory } from "@/lib/paic/addMemory";
import {
  extractMemories,
  extractMemoriesFromConversation,
} from "@/lib/paic/extractMemories";
import { evaluateMemoryCandidates } from "@/lib/paic/evaluateMemoryCandidates";
import { approveCandidate } from "@/lib/paic/reviewCandidate";
import { validatePAIC } from "@/lib/paic/validatePAIC";
import type { MemoryCandidate } from "@/lib/paic/memoryCandidate";
import type { Conversation } from "@/lib/paic/conversation";

const NOW = "2026-11-27T12:00:00.000Z";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

// Crea un candidato aprobado y permite cambiar solo los campos que importan en cada test.
function makeCandidate(overrides: Partial<MemoryCandidate> = {}): MemoryCandidate {
  return {
    id: "candidate-1",
    sourceConversationId: "conversation-1",
    sourceMessageId: "m1",
    content: "I prefer detailed answers",
    category: "preference",
    confidence: 0.85,
    reason: "User explicitly describes a preference.",
    shouldPersist: true,
    status: "approved",
    evaluationReason: "Approved by the user.",
    ...overrides,
  };
}

describe("persistApprovedCandidates", () => {
  it("solo guarda los candidatos aprobados", () => {
    const { persisted } = persistApprovedCandidates(
      createEmptyPAIC(),
      [
        makeCandidate({ id: "a", content: "uno", status: "approved" }),
        makeCandidate({ id: "b", content: "dos", status: "pending" }),
        makeCandidate({ id: "c", content: "tres", status: "review" }),
        makeCandidate({ id: "d", content: "cuatro", status: "rejected" }),
      ],
      { now: NOW }
    );

    expect(persisted.map((m) => m.content)).toEqual(["uno"]);
  });

  it("convierte el candidato en una memoria con procedencia completa", () => {
    const { document, persisted } = persistApprovedCandidates(
      createEmptyPAIC(),
      [makeCandidate()],
      { provider: "chatgpt", now: NOW }
    );

    expect(persisted[0].id).toMatch(UUID);
    expect(persisted[0]).toMatchObject({
      content: "I prefer detailed answers",
      category: "preference",
      importance: "medium",
      confidence: 0.85,
      status: "active",
      source: {
        provider: "chatgpt",
        conversationId: "conversation-1",
        messageId: "m1",
        extractionMethod: "explicit_user_input",
        extractor: RULE_EXTRACTOR,
        importedAt: NOW,
      },
      createdAt: NOW,
      updatedAt: NOW,
    });
    expect(document.memories).toEqual(persisted);
    expect(document.updatedAt).toBe(NOW);
  });

  it("guarda la categoría \"other\" como custom + customCategory \"other\"", () => {
    const { persisted } = persistApprovedCandidates(
      createEmptyPAIC(),
      [makeCandidate({ category: "other" })],
      { now: NOW }
    );

    expect(persisted[0].category).toBe("custom");
    expect(persisted[0].customCategory).toBe("other");
  });

  it("usa provider \"unknown\" si no se indica la plataforma", () => {
    const { persisted } = persistApprovedCandidates(createEmptyPAIC(), [makeCandidate()], { now: NOW });

    expect(persisted[0].source.provider).toBe("unknown");
  });

  it("no guarda ids provisionales cuando el texto no viene de una conversación", () => {
    const [candidate] = extractMemories({ text: "My name is Atom." }).candidates;

    const { persisted } = persistApprovedCandidates(
      createEmptyPAIC(),
      [approveCandidate(candidate)],
      { now: NOW }
    );

    expect(persisted[0].source).not.toHaveProperty("conversationId");
    expect(persisted[0].source).not.toHaveProperty("messageId");
  });

  it("no duplica un contenido que ya existe como memoria activa", () => {
    const document = addMemory(createEmptyPAIC(), {
      content: "I prefer detailed answers",
      category: "preference",
    });
    const existingId = document.memories[0].id;

    const result = persistApprovedCandidates(
      document,
      [makeCandidate({ id: "dup", content: "  i PREFER   detailed answers " })],
      { now: NOW }
    );

    expect(result.persisted).toEqual([]);
    expect(result.skipped).toEqual([
      { candidateId: "dup", reason: "duplicate", existingMemoryId: existingId },
    ]);
    expect(result.document).toBe(document);
  });

  it("no duplica un contenido repetido dentro del mismo lote", () => {
    const result = persistApprovedCandidates(
      createEmptyPAIC(),
      [
        makeCandidate({ id: "first", content: "Call me Atom" }),
        makeCandidate({ id: "second", content: "call me atom" }),
      ],
      { now: NOW }
    );

    expect(result.persisted).toHaveLength(1);
    expect(result.skipped).toEqual([
      { candidateId: "second", reason: "duplicate", existingMemoryId: result.persisted[0].id },
    ]);
  });

  it("una memoria retirada no impide volver a guardar el mismo contenido", () => {
    const withMemory = addMemory(createEmptyPAIC(), {
      content: "I prefer detailed answers",
      category: "preference",
    });
    const retracted = {
      ...withMemory,
      memories: withMemory.memories.map((m) => ({ ...m, status: "retracted" as const })),
    };

    const { persisted, skipped } = persistApprovedCandidates(retracted, [makeCandidate()], { now: NOW });

    expect(persisted).toHaveLength(1);
    expect(skipped).toEqual([]);
  });

  it("devuelve el mismo documento si no hay nada que guardar", () => {
    const document = createEmptyPAIC();

    const result = persistApprovedCandidates(
      document,
      [makeCandidate({ status: "review" })],
      { now: NOW }
    );

    expect(result.document).toBe(document);
    expect(result.persisted).toEqual([]);
    expect(result.skipped).toEqual([]);
  });

  it("no modifica el documento ni los candidatos originales", () => {
    const document = createEmptyPAIC();
    const candidate = makeCandidate();

    persistApprovedCandidates(document, [candidate], { now: NOW });

    expect(document.memories).toHaveLength(0);
    expect(candidate).toEqual(makeCandidate());
  });
});

describe("flujo completo: conversación → memorias", () => {
  it("extrae, evalúa, aprueba y guarda memorias válidas", () => {
    const timestamp = "2026-11-27T00:00:00.000Z";
    const conversation: Conversation = {
      id: "conversation-42",
      provider: "claude",
      createdAt: timestamp,
      updatedAt: timestamp,
      messages: [
        { id: "m1", role: "user", content: "My name is Atom. Hello there.", timestamp },
        { id: "m2", role: "assistant", content: "I am happy to help!", timestamp },
        { id: "m3", role: "user", content: "I am building a startup project.", timestamp },
      ],
    };

    const { candidates } = extractMemoriesFromConversation(conversation);
    const evaluated = evaluateMemoryCandidates(candidates);
    // La persona aprueba todo lo que quedó en revisión.
    const reviewed = evaluated.map((c) => (c.status === "review" ? approveCandidate(c) : c));

    const { document, persisted } = persistApprovedCandidates(createEmptyPAIC(), reviewed, {
      provider: "claude",
      now: NOW,
    });

    expect(persisted.map((m) => ({ content: m.content, category: m.category, messageId: m.source.messageId }))).toEqual([
      { content: "My name is Atom", category: "identity", messageId: "m1" },
      { content: "I am building a startup project.", category: "project", messageId: "m3" },
    ]);
    expect(validatePAIC(document)).toEqual({ isValid: true, errors: [] });
  });
});
