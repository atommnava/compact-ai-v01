// lib/paic/addMemory.test.ts
import { describe, it, expect } from "vitest";
import { addMemory } from "@/lib/paic/addMemory";
import { createEmptyPAIC } from "@/lib/paic/createEmptyPAIC";

describe("addMemory", () => {
  it("no repite ids después de borrar una memoria (error de la versión 0.1)", () => {
    let doc = createEmptyPAIC();
    doc = addMemory(doc, { content: "a", category: "fact" });
    doc = addMemory(doc, { content: "b", category: "fact" });

    // Borrar la primera y añadir otra: con `memory-${length + 1}` salían dos "memory-2".
    doc = { ...doc, memories: doc.memories.slice(1) };
    doc = addMemory(doc, { content: "c", category: "fact" });

    const ids = doc.memories.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("crea la memoria activa y con origen manual", () => {
    const doc = addMemory(createEmptyPAIC(), { content: "Call me Atom.", category: "instruction" });

    expect(doc.memories[0]).toMatchObject({
      content: "Call me Atom.",
      category: "instruction",
      importance: "medium",
      status: "active",
      source: { provider: "manual", extractionMethod: "manual" },
    });
    expect(doc.memories[0]).not.toHaveProperty("confidence");
  });

  it("exige customCategory cuando la categoría es \"custom\"", () => {
    expect(() =>
      addMemory(createEmptyPAIC(), { content: "x", category: "custom" })
    ).toThrow("customCategory is required");

    expect(() =>
      addMemory(createEmptyPAIC(), { content: "x", category: "custom", customCategory: "   " })
    ).toThrow("customCategory is required");
  });

  it("guarda customCategory solo cuando la categoría es \"custom\"", () => {
    const custom = addMemory(createEmptyPAIC(), {
      content: "Has a pilot license.",
      category: "custom",
      customCategory: " certification ",
    });
    const normal = addMemory(createEmptyPAIC(), {
      content: "Lives in Mexico.",
      category: "fact",
      customCategory: "ignored",
    });

    expect(custom.memories[0].customCategory).toBe("certification");
    expect(normal.memories[0]).not.toHaveProperty("customCategory");
  });

  it("no modifica el documento original", () => {
    const original = createEmptyPAIC();

    addMemory(original, { content: "a", category: "fact" });

    expect(original.memories).toHaveLength(0);
  });
});
