// lib/paic/profileToMemories.test.ts
import { describe, it, expect } from "vitest";
import { profileToMemories, PROFILE_MEMORY_PREFIX } from "@/lib/paic/profileToMemories";
import { examplePAIC } from "@/lib/paic/examplePAIC";
import { createEmptyPAIC } from "@/lib/paic/createEmptyPAIC";
import type { PAICDocument } from "@/types/paic";

// Devuelve { campo: { category, content } } para comparar fácilmente.
function byField(document: PAICDocument) {
  return Object.fromEntries(
    profileToMemories(document).map(({ field, memory }) => [
      field,
      { category: memory.category, content: memory.content },
    ])
  );
}

describe("profileToMemories", () => {
  it("convierte cada sección del perfil en memorias del tipo de PAM adecuado", () => {
    const profile = byField(examplePAIC);

    expect(profile["identity.name"]).toEqual({ category: "identity", content: "The user's name is Atom." });
    expect(profile["identity.languages"]).toEqual({ category: "identity", content: "The user speaks Spanish and English." });
    expect(profile["identity.summary"]).toEqual({
      category: "context",
      content: "Profile summary: Interested in AI, software development, drones, startups, and technology.",
    });
    expect(profile["preferences.responseStyle"]).toEqual({ category: "instruction", content: "Prefers detailed responses." });
    expect(profile["preferences.preferredLanguage"]).toEqual({ category: "instruction", content: "Prefers responses in Spanish." });
    expect(profile["skills.skill-1"]).toEqual({
      category: "skill",
      content: "Skill: TypeScript (intermediate, Programming). Evidence: PAIC Project.",
    });
    expect(profile["goals.goal-1"]).toEqual({
      category: "goal",
      content: "Goal: Build PAIC MVP. Create the first functional version of the PAIC standard. Timeframe: long term. Status: in process.",
    });
    expect(profile["projects.project-1"].category).toBe("project");
    expect(profile["projects.project-1"].content).toContain("Project: PAIC (status: planning).");
    expect(profile["projects.project-1"].content).toContain("Technologies: Next.js, React, TypeScript, PostgreSQL and Supabase.");
  });

  it("crea memorias activas, manuales y con ids estables entre exports", () => {
    const first = profileToMemories(examplePAIC);
    const second = profileToMemories(examplePAIC);

    expect(first.map((p) => p.memory.id)).toEqual(second.map((p) => p.memory.id));
    for (const { field, memory } of first) {
      expect(memory.id).toBe(`${PROFILE_MEMORY_PREFIX}${field}`);
      expect(memory.status).toBe("active");
      expect(memory.source).toEqual({ provider: "manual", extractionMethod: "manual" });
      expect(memory.tags).toEqual(["profile", field.split(".")[0]]);
    }
  });

  it("no crea memorias para campos vacíos", () => {
    const document: PAICDocument = {
      ...createEmptyPAIC(),
      identity: { name: "  ", occupation: "", languages: [] },
      preferences: {},
    };

    expect(profileToMemories(document)).toEqual([]);
  });

  it("expresa también las preferencias en negativo", () => {
    const document: PAICDocument = {
      ...createEmptyPAIC(),
      preferences: { formatting: { prefersBullets: false, prefersExamples: false } },
    };

    expect(byField(document)).toEqual({
      "preferences.formatting.prefersBullets": { category: "instruction", content: "Prefers not to use bullet points." },
      "preferences.formatting.prefersExamples": { category: "instruction", content: "Prefers explanations without examples." },
    });
  });

  it("usa las fechas del proyecto cuando las tiene", () => {
    const document: PAICDocument = {
      ...createEmptyPAIC(),
      preferences: {},
      projects: [
        { id: "p1", name: "Drone", status: "active", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-02-01T00:00:00.000Z" },
      ],
    };

    const [{ memory }] = profileToMemories(document);

    expect(memory.createdAt).toBe("2026-01-01T00:00:00.000Z");
    expect(memory.updatedAt).toBe("2026-02-01T00:00:00.000Z");
  });

  it("convierte las preferencias por defecto de createEmptyPAIC en 7 instrucciones", () => {
    // Comportamiento actual, a revisar: createEmptyPAIC rellena preferencias por
    // defecto, y al exportarlas parecen preferencias que la persona declaró.
    const fields = profileToMemories(createEmptyPAIC()).map((p) => p.field);

    expect(fields).toEqual([
      "preferences.responseStyle",
      "preferences.tone",
      "preferences.preferredLanguage",
      "preferences.explanationDepth",
      "preferences.formatting.prefersBullets",
      "preferences.formatting.prefersExamples",
      "preferences.formatting.prefersStepByStep",
    ]);
  });
});
