// lib/paic/profileToMemories.ts

import type { MemoryCategory, PAICDocument, PAICMemory } from "@/types/paic";

// PAM solo tiene memorias. Para no perder el perfil de PAIC al exportar
// (identity, preferences, skills, projects, goals), cada dato se convierte en
// una memoria con el tipo de PAM que mejor le corresponde:
//
//   identity.*        → identity   ("The user's name is Atom.")
//   identity.summary  → context
//   preferences.*     → instruction ("Prefers detailed responses.")
//   skills[]          → skill
//   projects[]        → project
//   goals[]           → goal
//
// Cada memoria lleva su campo de origen (`field`, p. ej. "preferences.tone") para
// poder reconstruir el perfil al reimportar el archivo en PAIC.
// Los campos vacíos no generan memoria.

// Prefijo de los ids: estables entre exports ("paic-profile:preferences.tone").
export const PROFILE_MEMORY_PREFIX = "paic-profile:";

export interface ProfileMemory {
  // Campo del perfil del que sale, p. ej. "identity.name" o "skills.skill-1".
  field: string;
  // Valor original del campo (texto, lista, booleano u objeto completo).
  // Se exporta en metadata.paic.profile_value para reconstruir el perfil sin
  // tener que interpretar el texto de la memoria.
  value: unknown;
  memory: PAICMemory;
}

export function profileToMemories(document: PAICDocument): ProfileMemory[] {
  const result: ProfileMemory[] = [];

  const add = (
    field: string,
    category: MemoryCategory,
    // false/undefined/"" = campo vacío → no se crea memoria.
    content: string | false | undefined,
    // Para skills/projects/goals: el objeto completo. Si no se indica, se lee
    // del documento siguiendo el campo ("preferences.tone" → document.preferences.tone).
    options: { value?: unknown; dates?: { createdAt?: string; updatedAt?: string } } = {}
  ) => {
    if (!content) {
      return;
    }
    const { dates } = options;
    result.push({
      field,
      value: "value" in options ? options.value : valueAt(document, field),
      memory: {
        id: `${PROFILE_MEMORY_PREFIX}${field}`,
        content,
        category,
        importance: "medium",
        status: "active",
        // El perfil lo escribe la persona (o se construye con buildPAIC).
        source: { provider: "manual", extractionMethod: "manual" },
        tags: ["profile", field.split(".")[0]],
        createdAt: dates?.createdAt ?? document.createdAt,
        updatedAt: dates?.updatedAt ?? dates?.createdAt ?? document.updatedAt,
      },
    });
  };

  // --- identity ---
  const { identity } = document;
  add("identity.name", "identity", filled(identity.name) && `The user's name is ${identity.name}.`);
  add("identity.occupation", "identity", filled(identity.occupation) && `The user's occupation is ${identity.occupation}.`);
  add("identity.education", "identity", filled(identity.education) && `The user's education: ${identity.education}.`);
  add("identity.languages", "identity", listOf(identity.languages) && `The user speaks ${listOf(identity.languages)}.`);
  add("identity.location", "identity", filled(identity.location) && `The user is located in ${identity.location}.`);
  add("identity.summary", "context", filled(identity.summary) && `Profile summary: ${identity.summary}`);

  // --- preferences (cómo quiere que la IA le responda → instruction) ---
  const { preferences } = document;
  add("preferences.responseStyle", "instruction", preferences.responseStyle && RESPONSE_STYLE[preferences.responseStyle]);
  add("preferences.tone", "instruction", preferences.tone && `Prefers a ${preferences.tone} tone.`);
  add("preferences.preferredLanguage", "instruction", filled(preferences.preferredLanguage) && `Prefers responses in ${preferences.preferredLanguage}.`);
  add("preferences.explanationDepth", "instruction", preferences.explanationDepth && `Prefers ${preferences.explanationDepth}-level explanations.`);

  const formatting = preferences.formatting ?? {};
  add("preferences.formatting.prefersBullets", "instruction", yesNo(formatting.prefersBullets, "Prefers bullet points.", "Prefers not to use bullet points."));
  add("preferences.formatting.prefersExamples", "instruction", yesNo(formatting.prefersExamples, "Prefers explanations with examples.", "Prefers explanations without examples."));
  add("preferences.formatting.prefersStepByStep", "instruction", yesNo(formatting.prefersStepByStep, "Prefers step-by-step explanations.", "Prefers explanations that are not step by step."));

  // --- skills ---
  for (const skill of document.skills) {
    const details = [skill.level, skill.category].filter(Boolean).join(", ");
    const evidence = listOf(skill.evidence);
    add(
      `skills.${skill.id}`,
      "skill",
      sentences(`Skill: ${skill.name}${details ? ` (${details})` : ""}.`, evidence && `Evidence: ${evidence}.`),
      { value: skill }
    );
  }

  // --- projects ---
  for (const project of document.projects) {
    add(
      `projects.${project.id}`,
      "project",
      sentences(
        `Project: ${project.name} (status: ${project.status}).`,
        filled(project.description) && endWithPeriod(project.description),
        listOf(project.technologies) && `Technologies: ${listOf(project.technologies)}.`,
        project.goals?.length ? `Goals: ${project.goals.join("; ")}.` : undefined,
        project.notes?.length ? `Notes: ${project.notes.join("; ")}.` : undefined
      ),
      { value: project, dates: { createdAt: project.createdAt, updatedAt: project.updatedAt } }
    );
  }

  // --- goals ---
  for (const goal of document.goals) {
    add(
      `goals.${goal.id}`,
      "goal",
      sentences(
        `Goal: ${goal.title}.`,
        filled(goal.description) && endWithPeriod(goal.description),
        goal.timeframe && `Timeframe: ${goal.timeframe.replace("_", " ")}.`,
        goal.status && `Status: ${goal.status.replace("_", " ")}.`
      ),
      { value: goal }
    );
  }

  return result;
}

const RESPONSE_STYLE = {
  short: "Prefers short responses.",
  balanced: "Prefers balanced-length responses.",
  detailed: "Prefers detailed responses.",
} as const;

// Lee un valor siguiendo un campo con puntos: valueAt(doc, "preferences.formatting.prefersBullets").
function valueAt(document: PAICDocument, field: string): unknown {
  let current: unknown = document;
  for (const key of field.split(".")) {
    if (!current || typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

// --- utilidades de texto ---

function filled(value: string | undefined): boolean {
  return Boolean(value?.trim());
}

// ["Spanish", "English", "French"] → "Spanish, English and French"
function listOf(items: string[] | undefined): string | undefined {
  const clean = (items ?? []).map((item) => item.trim()).filter(Boolean);
  if (clean.length === 0) {
    return undefined;
  }
  if (clean.length === 1) {
    return clean[0];
  }
  return `${clean.slice(0, -1).join(", ")} and ${clean[clean.length - 1]}`;
}

function yesNo(value: boolean | undefined, yes: string, no: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  return value ? yes : no;
}

function endWithPeriod(text: string | undefined): string {
  const trimmed = (text ?? "").trim();
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

// Une las frases que existen, separadas por un espacio.
function sentences(...parts: (string | false | undefined)[]): string {
  return parts.filter((part): part is string => Boolean(part)).join(" ");
}
