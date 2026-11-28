// lib/paic/exportToPAM.test.ts
import { describe, it, expect } from "vitest";
import {
  computeContentHash,
  exportToPAM,
  toPAMTag,
  PAIC_EXPORTER,
} from "@/lib/paic/exportToPAM";
import { validatePAM } from "@/lib/paic/pamSchemaValidator";
import { createEmptyPAIC } from "@/lib/paic/createEmptyPAIC";
import { addMemory } from "@/lib/paic/addMemory";
import { examplePAIC } from "@/lib/paic/examplePAIC";
import { importPAIC } from "@/lib/paic/importPAIC";
import { extractMemoriesFromConversation } from "@/lib/paic/extractMemories";
import { evaluateMemoryCandidates } from "@/lib/paic/evaluateMemoryCandidates";
import { approveCandidate } from "@/lib/paic/reviewCandidate";
import { persistApprovedCandidates } from "@/lib/paic/persistApprovedCandidates";
import type { Conversation } from "@/lib/paic/conversation";
import type { PAICDocument } from "@/types/paic";

const NOW = "2026-11-27T12:00:00.000Z";
const OPTIONS = { ownerId: "atom", now: NOW, exportId: "e47ac10b-58cc-4372-a567-0e02b2c3d479" };

// Documento con memorias que vienen de una conversación real, pasando por todo el flujo.
function documentFromConversation(): PAICDocument {
  const timestamp = "2026-11-27T00:00:00.000Z";
  const conversation: Conversation = {
    id: "conversation-42",
    provider: "claude",
    createdAt: timestamp,
    updatedAt: timestamp,
    messages: [
      { id: "m1", role: "user", content: "My name is Atom. I prefer detailed answers.", timestamp },
      { id: "m2", role: "assistant", content: "I am happy to help!", timestamp },
      { id: "m3", role: "user", content: "I am building a startup project.", timestamp },
    ],
  };

  const { candidates } = extractMemoriesFromConversation(conversation);
  const reviewed = evaluateMemoryCandidates(candidates).map((c) =>
    c.status === "review" ? approveCandidate(c) : c
  );
  return persistApprovedCandidates(createEmptyPAIC(), reviewed, { provider: "claude", now: NOW }).document;
}

describe("computeContentHash (PAM §6)", () => {
  it("reproduce el content_hash del ejemplo oficial de PAM", async () => {
    // Vector tomado de examples/example-memory-store.json del repositorio de PAM.
    const content =
      "User values systematic approaches to problem-solving and prefers comprehensive technical documentation over simplified explanations.";

    expect(await computeContentHash(content)).toBe(
      "sha256:191046caf76449b18bd0323524537d737f9c6042d71bbbe5ba46e4d8663c266a"
    );
  });

  it("da el mismo hash a textos que solo difieren en mayúsculas o espacios", async () => {
    expect(await computeContentHash("  I prefer   SHORT answers ")).toBe(
      await computeContentHash("i prefer short answers")
    );
  });
});

describe("toPAMTag", () => {
  it("convierte etiquetas al formato de PAM", () => {
    expect(toPAMTag("Startup")).toBe("startup");
    expect(toPAMTag("Next.js")).toBe("nextjs");
    expect(toPAMTag("  Programación web ")).toBe("programacion-web");
    expect(toPAMTag("-AI")).toBe("ai");
  });
});

describe("exportToPAM", () => {
  it("genera un archivo PAM válido según el JSON Schema oficial", async () => {
    const pam = await exportToPAM(documentFromConversation(), OPTIONS);

    expect(validatePAM(pam)).toEqual({ isValid: true, errors: [] });
  });

  it("rellena la raíz del archivo PAM", async () => {
    const pam = await exportToPAM(createEmptyPAIC(), OPTIONS);

    expect(pam).toMatchObject({
      schema: "portable-ai-memory",
      schema_version: "1.0",
      export_id: OPTIONS.exportId,
      exported_by: PAIC_EXPORTER,
      export_date: NOW,
      export_type: "full",
      owner: { id: "atom" },
      memories: [],
    });
    expect(validatePAM(pam).isValid).toBe(true);
  });

  it("traduce una memoria extraída con toda su procedencia", async () => {
    const document = documentFromConversation();
    const pam = await exportToPAM(document, OPTIONS);
    const original = document.memories[0];

    expect(pam.memories[0]).toEqual({
      id: original.id,
      type: "identity",
      status: "active",
      content: "My name is Atom",
      content_hash: await computeContentHash("My name is Atom"),
      confidence: { initial: 0.95, current: 0.95 },
      temporal: { created_at: NOW, updated_at: NOW },
      provenance: {
        platform: "claude",
        conversation_ref: "conversation-42",
        message_ref: "m1",
        extraction_method: "explicit_user_input",
        extractor: "paic-rules/0.1.0",
      },
      metadata: { paic: { importance: "medium", imported_at: NOW } },
    });
  });

  it("crea el índice de conversaciones con las memorias de cada una (PAM §14.1)", async () => {
    const document = documentFromConversation();
    const pam = await exportToPAM(document, OPTIONS);

    expect(pam.conversations_index).toEqual([
      {
        id: "conversation-42",
        platform: "claude",
        temporal: { created_at: NOW },
        derived_memories: document.memories.map((m) => m.id),
      },
    ]);
  });

  it("no crea índice de conversaciones si ninguna memoria viene de una", async () => {
    const document = addMemory(createEmptyPAIC(), { content: "Call me Atom.", category: "instruction" });
    const pam = await exportToPAM(document, OPTIONS);

    expect(pam).not.toHaveProperty("conversations_index");
    expect(pam.memories[0].provenance).toEqual({ platform: "manual", extraction_method: "manual" });
  });

  it("exporta custom_type, etiquetas normalizadas y sin confianza si la memoria es manual", async () => {
    const document = addMemory(createEmptyPAIC(), {
      content: "Has a pilot license.",
      category: "custom",
      customCategory: "certification",
      tags: ["Aviation", "aviation", "Next.js", "  "],
    });
    const pam = await exportToPAM(document, OPTIONS);

    expect(pam.memories[0]).toMatchObject({
      type: "custom",
      custom_type: "certification",
      tags: ["aviation", "nextjs"],
    });
    expect(pam.memories[0]).not.toHaveProperty("confidence");
    expect(validatePAM(pam).isValid).toBe(true);
  });

  it("exporta también memorias retiradas: PAM nunca las borra", async () => {
    const base = addMemory(createEmptyPAIC(), { content: "Lives in Mexico.", category: "fact" });
    const document: PAICDocument = {
      ...base,
      memories: base.memories.map((m) => ({ ...m, status: "retracted" })),
    };

    const pam = await exportToPAM(document, OPTIONS);

    expect(pam.memories[0].status).toBe("retracted");
  });

  it("usa metadata.ownerId del documento si no se indica ownerId", async () => {
    const document: PAICDocument = { ...createEmptyPAIC(), metadata: { ownerId: "owner-7" } };

    const pam = await exportToPAM(document, { now: NOW });

    expect(pam.owner).toEqual({ id: "owner-7" });
  });

  it("exige un ownerId: no lo inventa", async () => {
    await expect(exportToPAM(createEmptyPAIC(), { now: NOW })).rejects.toThrow("ownerId is required");
  });

  it("exporta examplePAIC y un documento migrado desde 0.1 como PAM válido", async () => {
    const migrated = importPAIC(
      JSON.stringify({
        version: "0.1",
        createdAt: NOW,
        updatedAt: NOW,
        identity: {},
        preferences: {},
        skills: [],
        projects: [],
        goals: [],
        memories: [
          { id: "memory-1", content: "Uses VS Code.", category: "technical", importance: "low", createdAt: NOW, updatedAt: NOW },
          { id: "memory-2", content: "Misc note.", category: "other", importance: "low", createdAt: NOW, updatedAt: NOW },
        ],
      })
    );

    for (const document of [examplePAIC, migrated]) {
      const result = validatePAM(await exportToPAM(document, OPTIONS));
      expect(result.errors).toEqual([]);
    }
  });
});
