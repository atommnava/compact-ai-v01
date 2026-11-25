// lib/paic/importPAIC.test.ts
import { describe, it, expect } from "vitest";
import { importPAIC } from "@/lib/paic/importPAIC";
import { exportPAIC } from "@/lib/paic/exportPAIC";
import { createEmptyPAIC } from "@/lib/paic/createEmptyPAIC";
import { addMemory } from "@/lib/paic/addMemory";

describe("importPAIC", () => {
  it("importa un documento 0.2 sin cambiarlo (ida y vuelta con exportPAIC)", () => {
    const original = addMemory(createEmptyPAIC(), {
      content: "Explain things step by step.",
      category: "instruction",
    });

    expect(importPAIC(exportPAIC(original))).toEqual(original);
  });

  it("migra un documento 0.1 a 0.2 al importarlo", () => {
    const legacyJSON = JSON.stringify({
      version: "0.1",
      createdAt: "2026-11-01T00:00:00.000Z",
      updatedAt: "2026-11-01T00:00:00.000Z",
      identity: {},
      preferences: {},
      skills: [],
      projects: [],
      goals: [],
      memories: [
        {
          id: "memory-1",
          content: "Uses a MacBook with VS Code.",
          category: "technical",
          importance: "low",
          createdAt: "2026-11-01T00:00:00.000Z",
          updatedAt: "2026-11-01T00:00:00.000Z",
        },
      ],
    });

    const imported = importPAIC(legacyJSON);

    expect(imported.version).toBe("0.2");
    expect(imported.memories[0]).toMatchObject({
      id: "memory-1",
      category: "environment",
      status: "active",
      source: { provider: "unknown" },
    });
  });

  it("rechaza texto que no es JSON", () => {
    expect(() => importPAIC("not json")).toThrow("Invalid JSON format");
  });

  it("rechaza documentos con una versión desconocida", () => {
    const doc = { ...createEmptyPAIC(), version: "0.3" };

    expect(() => importPAIC(JSON.stringify(doc))).toThrow("Invalid or missing PAIC version");
  });

  it("rechaza un documento 0.1 sin memorias en lugar de migrarlo", () => {
    const withoutMemories: Record<string, unknown> = { ...createEmptyPAIC(), version: "0.1" };
    delete withoutMemories.memories;

    expect(() => importPAIC(JSON.stringify(withoutMemories))).toThrow("Memories must be an array");
  });
});
