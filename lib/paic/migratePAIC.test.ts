// lib/paic/migratePAIC.test.ts
import { describe, it, expect } from "vitest";
import { isLegacyPAIC, migratePAIC, type PAICDocumentV01 } from "@/lib/paic/migratePAIC";
import { validatePAIC } from "@/lib/paic/validatePAIC";

const timestamp = "2026-11-01T00:00:00.000Z";

type MemoryV01 = PAICDocumentV01["memories"][number];

function makeMemoryV01(overrides: Partial<MemoryV01> = {}): MemoryV01 {
  return {
    id: "memory-1",
    content: "The user likes TypeScript.",
    category: "skill",
    importance: "medium",
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides,
  };
}

// Documento con la forma del contrato 0.1.
function makeLegacyDoc(memories: MemoryV01[]): PAICDocumentV01 {
  return {
    version: "0.1",
    createdAt: timestamp,
    updatedAt: timestamp,
    identity: { name: "Atom" },
    preferences: {},
    skills: [],
    projects: [],
    goals: [],
    memories,
  };
}

describe("migratePAIC", () => {
  it("sube la versión a 0.2 y conserva ids, contenido y fechas", () => {
    const migrated = migratePAIC(makeLegacyDoc([makeMemoryV01()]));

    expect(migrated.version).toBe("0.2");
    expect(migrated.updatedAt).toBe(timestamp);
    expect(migrated.memories[0]).toMatchObject({
      id: "memory-1",
      content: "The user likes TypeScript.",
      createdAt: timestamp,
    });
  });

  it("traduce las categorías a la taxonomía de PAM", () => {
    const migrated = migratePAIC(
      makeLegacyDoc([
        makeMemoryV01({ id: "a", category: "identity" }),
        makeMemoryV01({ id: "b", category: "technical" }),
        makeMemoryV01({ id: "c", category: "personal" }),
        makeMemoryV01({ id: "d", category: "other" }),
      ])
    );

    expect(
      migrated.memories.map((m) => ({ category: m.category, customCategory: m.customCategory }))
    ).toEqual([
      { category: "identity", customCategory: undefined },
      { category: "environment", customCategory: undefined },
      { category: "context", customCategory: undefined },
      { category: "custom", customCategory: "other" },
    ]);
  });

  it("marca todas las memorias como activas", () => {
    const migrated = migratePAIC(makeLegacyDoc([makeMemoryV01(), makeMemoryV01({ id: "b" })]));

    expect(migrated.memories.every((m) => m.status === "active")).toBe(true);
  });

  it("usa provider \"unknown\" cuando no se conoce el origen", () => {
    const migrated = migratePAIC(
      makeLegacyDoc([
        makeMemoryV01({ id: "sin-source" }),
        makeMemoryV01({ id: "sin-provider", source: { conversationId: "conv-9" } }),
      ])
    );

    expect(migrated.memories[0].source).toEqual({ provider: "unknown" });
    expect(migrated.memories[1].source).toEqual({ provider: "unknown", conversationId: "conv-9" });
  });

  it("conserva el provider cuando ya existía", () => {
    const migrated = migratePAIC(
      makeLegacyDoc([makeMemoryV01({ source: { provider: "chatgpt", messageId: "m1" } })])
    );

    expect(migrated.memories[0].source).toEqual({ provider: "chatgpt", messageId: "m1" });
  });

  it("no modifica el documento original", () => {
    const legacy = makeLegacyDoc([makeMemoryV01({ category: "other" })]);

    migratePAIC(legacy);

    expect(legacy.version).toBe("0.1");
    expect(legacy.memories[0].category).toBe("other");
    expect(legacy.memories[0]).not.toHaveProperty("status");
  });

  it("produce un documento que pasa la validación", () => {
    const migrated = migratePAIC(makeLegacyDoc([makeMemoryV01()]));

    expect(validatePAIC(migrated)).toEqual({ isValid: true, errors: [] });
  });
});

describe("isLegacyPAIC", () => {
  it("reconoce un documento 0.1 con memorias", () => {
    expect(isLegacyPAIC(makeLegacyDoc([]))).toBe(true);
  });

  it("descarta documentos 0.2, sin memorias o que no son objetos", () => {
    expect(isLegacyPAIC({ ...makeLegacyDoc([]), version: "0.2" })).toBe(false);
    expect(isLegacyPAIC({ version: "0.1" })).toBe(false);
    expect(isLegacyPAIC(null)).toBe(false);
    expect(isLegacyPAIC("0.1")).toBe(false);
  });
});
