// lib/paic/extractMemories.test.ts
import { describe, it, expect } from "vitest";
import {
  extractMemories,
  extractMemoriesFromConversation,
} from "@/lib/paic/extractMemories";
import type { Conversation } from "@/lib/paic/conversation";

describe("extractMemories: comportamiento actual", () => {
  it("devuelve una lista vacía si el texto está vacío", () => {
    expect(extractMemories({ text: "   " })).toEqual({ candidates: [] });
  });

  it("reproduce la salida registrada en el documento maestro (§12.3)", () => {
    const text = `
      My name is Atom.
      I study IT and programming.
      I am building a startup project.
      I prefer detailed technical explanations.
      I want to create a portable AI identity standard.
    `;

    const { candidates } = extractMemories({ text });

    const resumen = candidates.map((c) => ({
      content: c.content,
      category: c.category,
      confidence: c.confidence,
      shouldPersist: c.shouldPersist,
    }));

    expect(resumen).toEqual([
      { content: "My name is Atom", category: "identity", confidence: 0.95, shouldPersist: true },
      { content: "I study IT and programming", category: "identity", confidence: 0.6, shouldPersist: false },
      { content: "I am building a startup project", category: "project", confidence: 0.95, shouldPersist: true },
      { content: "I prefer detailed technical explanations", category: "preference", confidence: 0.85, shouldPersist: true },
      { content: "I want to create a portable AI identity standard.", category: "goal", confidence: 0.85, shouldPersist: true },
    ]);
  });

  it("asigna ids secuenciales y un sourceMessageId provisional", () => {
    const { candidates } = extractMemories({ text: "My name is Atom. I prefer short answers." });

    expect(candidates.map((c) => c.id)).toEqual(["candidate-1", "candidate-2"]);
    expect(candidates.map((c) => c.sourceMessageId)).toEqual([
      "unknown-message-1",
      "unknown-message-2",
    ]);
  });

  it("crea todos los candidatos con status \"pending\"", () => {
    const { candidates } = extractMemories({ text: "My name is Atom. I prefer short answers." });

    expect(candidates).toHaveLength(2);
    expect(candidates.every((c) => c.status === "pending")).toBe(true);
  });

  // Errores conocidos (auditoría del 20 nov 2026). Se convierten en tests reales cuando se arreglen.
  it.todo("no guarda negaciones como 'I am not a developer'");
  it.todo("no convierte preguntas como 'Do you work at Google?' en memoria");
  it.todo("da confianza alta a 'I study IT and programming'");
});

describe("extractMemoriesFromConversation", () => {
  const timestamp = "2026-11-20T00:00:00.000Z";

  const conversation: Conversation = {
    id: "conversation-test",
    createdAt: timestamp,
    updatedAt: timestamp,
    messages: [
      { id: "m1", role: "system", content: "I am a helpful assistant.", timestamp },
      { id: "m2", role: "user", content: "My name is Atom. I prefer detailed answers.", timestamp },
      { id: "m3", role: "assistant", content: "I'm happy to help you with that!", timestamp },
      { id: "m4", role: "user", content: "I am building a startup project.", timestamp },
    ],
  };

  it("solo genera candidatos a partir de mensajes del usuario", () => {
    const { candidates } = extractMemoriesFromConversation(conversation);

    expect(candidates.map((c) => c.content)).toEqual([
      "My name is Atom",
      "I prefer detailed answers.",
      "I am building a startup project.",
    ]);
  });

  it("enlaza cada candidato con el id real de su mensaje", () => {
    const { candidates } = extractMemoriesFromConversation(conversation);

    expect(candidates.map((c) => c.sourceMessageId)).toEqual(["m2", "m2", "m4"]);
  });

  it("numera los candidatos de forma continua en toda la conversación", () => {
    const { candidates } = extractMemoriesFromConversation(conversation);

    expect(candidates.map((c) => c.id)).toEqual([
      "candidate-1",
      "candidate-2",
      "candidate-3",
    ]);
    expect(candidates.every((c) => c.status === "pending")).toBe(true);
  });

  it("devuelve una lista vacía si no hay mensajes del usuario", () => {
    const soloAsistente: Conversation = {
      ...conversation,
      messages: [{ id: "a1", role: "assistant", content: "I am fine, thank you!", timestamp }],
    };

    expect(extractMemoriesFromConversation(soloAsistente)).toEqual({ candidates: [] });
  });
});