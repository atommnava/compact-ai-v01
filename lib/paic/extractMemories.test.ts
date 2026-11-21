// lib/paic/extractMemories.test.ts
import { describe, it, expect } from "vitest";
import { extractMemories } from "@/lib/paic/extractMemories";

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
  it.todo("no convierte texto del asistente en memoria del usuario");
  it.todo("no convierte preguntas como 'Do you work at Google?' en memoria");
  it.todo("da confianza alta a 'I study IT and programming'");
});