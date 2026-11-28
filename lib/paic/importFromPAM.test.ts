// lib/paic/importFromPAM.test.ts
import { describe, it, expect } from "vitest";
import { importFromPAM } from "@/lib/paic/importFromPAM";
import { computeContentHash, exportToPAM } from "@/lib/paic/exportToPAM";
import { examplePAIC } from "@/lib/paic/examplePAIC";
import { createEmptyPAIC } from "@/lib/paic/createEmptyPAIC";
import { extractMemoriesFromConversation } from "@/lib/paic/extractMemories";
import { evaluateMemoryCandidates } from "@/lib/paic/evaluateMemoryCandidates";
import { approveCandidate } from "@/lib/paic/reviewCandidate";
import { persistApprovedCandidates } from "@/lib/paic/persistApprovedCandidates";
import { validatePAIC } from "@/lib/paic/validatePAIC";
import type { Conversation } from "@/lib/paic/conversation";
import type { PAICDocument } from "@/types/paic";

const NOW = "2026-11-27T12:00:00.000Z";
const LATER = "2026-11-28T09:00:00.000Z";
const EXPORT = { ownerId: "atom", now: NOW, exportId: "e47ac10b-58cc-4372-a567-0e02b2c3d479" };

function documentFromConversation(): PAICDocument {
  const timestamp = "2026-11-27T00:00:00.000Z";
  const conversation: Conversation = {
    id: "conversation-42",
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

// Archivo PAM válido escrito por "otro sistema" (sin metadata.paic).
async function foreignPAM() {
  const content = "Works as a data engineer.";
  return {
    schema: "portable-ai-memory",
    schema_version: "1.0",
    owner: { id: "user-123" },
    memories: [
      {
        id: "f0e1d2c3-b4a5-4968-8776-655443322110",
        type: "fact",
        content,
        content_hash: await computeContentHash(content),
        summary: "Data engineer",
        confidence: { initial: 0.9, current: 0.7 },
        temporal: { created_at: "2026-10-01T00:00:00Z" },
        provenance: { platform: "mistral", extraction_method: "llm_inference" },
      },
    ],
    relations: [
      {
        id: "r1",
        from: "f0e1d2c3-b4a5-4968-8776-655443322110",
        to: "f0e1d2c3-b4a5-4968-8776-655443322110",
        type: "related_to",
        created_at: "2026-10-01T00:00:00Z",
      },
    ],
  };
}

describe("importFromPAM: ida y vuelta PAIC → PAM → PAIC", () => {
  it("reconstruye el perfil y las memorias de examplePAIC sin perder nada", async () => {
    const pam = await exportToPAM(examplePAIC, EXPORT);
    const { document, warnings } = await importFromPAM(JSON.stringify(pam), { now: LATER });

    expect(warnings).toEqual([]);
    expect(document.identity).toEqual(examplePAIC.identity);
    expect(document.preferences).toEqual(examplePAIC.preferences);
    expect(document.skills).toEqual(examplePAIC.skills);
    expect(document.projects).toEqual(examplePAIC.projects);
    expect(document.goals).toEqual(examplePAIC.goals);
    // Incluye las etiquetas originales ("PAIC", "Startup"), no solo las de PAM ("paic", "startup").
    expect(document.memories).toEqual(examplePAIC.memories);
    expect(document.metadata?.ownerId).toBe("atom");
    expect(validatePAIC(document)).toEqual({ isValid: true, errors: [] });
  });

  it("conserva la procedencia completa de las memorias extraídas", async () => {
    const original = documentFromConversation();

    const { document } = await importFromPAM(await exportToPAM(original, EXPORT), { now: LATER });

    // importedAt sigue siendo el del primer guardado, no el de esta importación.
    expect(document.memories).toEqual(original.memories);
  });

  it("deja el perfil vacío si el archivo no lo incluía", async () => {
    const pam = await exportToPAM(examplePAIC, { ...EXPORT, includeProfile: false });

    const { document } = await importFromPAM(pam, { now: LATER });

    expect(document.identity).toEqual({});
    expect(document.preferences).toEqual({});
    expect(document.skills).toEqual([]);
    expect(document.memories).toHaveLength(2);
  });
});

describe("importFromPAM: archivos de otros sistemas", () => {
  it("importa la memoria y avisa de todo lo que no pudo importar", async () => {
    const { document, warnings } = await importFromPAM(await foreignPAM(), { now: LATER });

    expect(document.memories).toEqual([
      {
        id: "f0e1d2c3-b4a5-4968-8776-655443322110",
        content: "Works as a data engineer.",
        category: "fact",
        importance: "medium",
        confidence: 0.7,
        status: "active",
        source: { provider: "other", extractionMethod: "llm_inference", importedAt: LATER },
        createdAt: "2026-10-01T00:00:00Z",
        updatedAt: "2026-10-01T00:00:00Z",
      },
    ]);
    expect(warnings).toEqual([
      'Memory f0e1d2c3-b4a5-4968-8776-655443322110: platform "mistral" is not known to PAIC, imported as "other".',
      "1 relation(s) between memories were not imported (not supported yet).",
      "1 memory summary(ies) were not imported (PAIC has no summary field).",
    ]);
    expect(document.metadata).toEqual({
      ownerId: "user-123",
      sourceProviders: ["mistral"],
      exportedFrom: "pam",
    });
  });

  it("avisa si el contenido de una memoria no coincide con su content_hash", async () => {
    const pam = await exportToPAM(examplePAIC, { ...EXPORT, includeProfile: false });
    pam.memories[0].content = "The user wants to sell all their data.";

    const { document, warnings } = await importFromPAM(pam, { now: LATER });

    expect(warnings).toEqual([
      "Memory memory-1: content_hash does not match its content (it may have been modified).",
    ]);
    expect(document.memories[0].content).toBe("The user wants to sell all their data.");
  });

  it("importa como memoria normal un campo de perfil con un valor inválido", async () => {
    const pam = await exportToPAM(examplePAIC, EXPORT);
    const tone = pam.memories.find((m) => m.id === "paic-profile:preferences.tone")!;
    (tone.metadata!.paic as Record<string, unknown>).profile_value = "angry";

    const { document, warnings } = await importFromPAM(pam, { now: LATER });

    expect(document.preferences.tone).toBeUndefined();
    expect(document.memories.map((m) => m.id)).toContain("paic-profile:preferences.tone");
    expect(warnings).toEqual([
      'Memory paic-profile:preferences.tone: invalid profile field "preferences.tone", imported as a regular memory.',
    ]);
  });
});

describe("importFromPAM: archivos inválidos", () => {
  it("rechaza texto que no es JSON", async () => {
    await expect(importFromPAM("not json")).rejects.toThrow("Invalid JSON format");
  });

  it("rechaza archivos que no cumplen el schema de PAM", async () => {
    const withoutOwner: Record<string, unknown> = await foreignPAM();
    delete withoutOwner.owner;

    await expect(importFromPAM(withoutOwner)).rejects.toThrow("Invalid PAM file");
    await expect(importFromPAM({ schema: "something-else" })).rejects.toThrow("Invalid PAM file");
  });
});
