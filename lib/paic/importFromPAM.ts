// lib/paic/importFromPAM.ts

import type {
  MemoryImportance,
  PAICDocument,
  PAICGoal,
  PAICMemory,
  PAICProject,
  PAICProvider,
  PAICSkill,
} from "@/types/paic";
import { createEmptyPAIC } from "@/lib/paic/createEmptyPAIC";
import { computeContentHash } from "@/lib/paic/exportToPAM";
import { validatePAM } from "@/lib/paic/pamSchemaValidator";
import { validatePAIC } from "@/lib/paic/validatePAIC";

// Adaptador PAM v1.0 → PAIC: el camino de vuelta de exportToPAM.
//
// 1. Valida el archivo contra el JSON Schema oficial de PAM. Un archivo que llega
//    de fuera no es de confianza.
// 2. Las memorias marcadas con metadata.paic.profile_field (creadas por exportToPAM)
//    reconstruyen el perfil: identity, preferences, skills, projects y goals.
// 3. El resto se convierte en PAICMemory.
// 4. Todo lo que no se puede importar o no se pudo comprobar se informa en
//    `warnings`. Nada se descarta en silencio (documento maestro §14.2).
//
// Es async porque comprueba cada content_hash con Web Crypto.

export interface ImportFromPAMOptions {
  // Momento de la importación. Se puede fijar para que los tests sean deterministas.
  now?: string;
}

export interface ImportFromPAMResult {
  document: PAICDocument;
  warnings: string[];
}

// --- Forma de lectura de un archivo PAM (ya validado contra el schema) ---

interface PAMInputMemory {
  id: string;
  type: PAICMemory["category"];
  custom_type?: string | null;
  status?: PAICMemory["status"];
  content: string;
  content_hash: string;
  summary?: string | null;
  tags?: string[];
  confidence?: { initial?: number; current?: number };
  temporal: {
    created_at: string;
    updated_at?: string | null;
    valid_until?: string | null;
    superseded_by?: string | null;
  };
  provenance: {
    platform: string;
    conversation_ref?: string | null;
    message_ref?: string | null;
    extraction_method?: PAICMemory["source"]["extractionMethod"] | null;
    extracted_at?: string | null;
    extractor?: string | null;
  };
  access?: unknown;
  embedding_ref?: string | null;
  metadata?: Record<string, unknown>;
}

interface PAMInput {
  owner: { id: string; created_at?: string };
  exported_by?: string | null;
  export_date?: string;
  memories: PAMInputMemory[];
  relations?: unknown[];
  integrity?: unknown;
  signature?: unknown;
}

const PROVIDERS: readonly PAICProvider[] = [
  "chatgpt", "claude", "gemini", "grok", "perplexity", "copilot",
  "deepseek", "local", "manual", "other", "unknown",
];
const IMPORTANCE: readonly MemoryImportance[] = ["low", "medium", "high", "critical"];

export async function importFromPAM(
  input: string | unknown,
  options: ImportFromPAMOptions = {}
): Promise<ImportFromPAMResult> {
  let parsed: unknown = input;
  if (typeof input === "string") {
    try {
      parsed = JSON.parse(input);
    } catch {
      throw new Error("Invalid JSON format...");
    }
  }

  const validation = validatePAM(parsed);
  if (!validation.isValid) {
    throw new Error(`Invalid PAM file: ${validation.errors.slice(0, 5).join("; ")}`);
  }

  const pam = parsed as PAMInput;
  const now = options.now ?? new Date().toISOString();
  const warnings: string[] = [];

  // Documento vacío: solo se rellena lo que trae el archivo.
  const document: PAICDocument = {
    ...createEmptyPAIC(),
    createdAt: pam.owner.created_at ?? pam.export_date ?? now,
    updatedAt: pam.export_date ?? now,
    identity: {},
    preferences: {},
    metadata: {
      ownerId: pam.owner.id,
      sourceProviders: [...new Set(pam.memories.map((m) => m.provenance.platform))],
      exportedFrom: pam.exported_by ?? "pam",
    },
  };

  for (const memory of pam.memories) {
    if ((await computeContentHash(memory.content)) !== memory.content_hash) {
      warnings.push(`Memory ${memory.id}: content_hash does not match its content (it may have been modified).`);
    }

    const paic = paicMetadata(memory);
    if (typeof paic?.profile_field === "string" && "profile_value" in paic) {
      if (applyProfileField(document, paic.profile_field, paic.profile_value)) {
        continue;
      }
      warnings.push(`Memory ${memory.id}: invalid profile field "${paic.profile_field}", imported as a regular memory.`);
    }

    document.memories.push(toPAICMemory(memory, now, warnings));
  }

  reportUnsupported(pam, warnings);

  const result = validatePAIC(document);
  if (!result.isValid) {
    throw new Error(`Imported document is not a valid PAIC document: ${result.errors.join(", ")}`);
  }

  return { document, warnings };
}

// metadata.paic, si existe y es un objeto. Solo lo escriben exports de PAIC.
function paicMetadata(memory: PAMInputMemory): Record<string, unknown> | undefined {
  const paic = memory.metadata?.paic;
  return paic && typeof paic === "object" && !Array.isArray(paic)
    ? (paic as Record<string, unknown>)
    : undefined;
}

function toPAICMemory(memory: PAMInputMemory, now: string, warnings: string[]): PAICMemory {
  const paic = paicMetadata(memory);
  const { provenance, temporal } = memory;

  const knownProvider = (PROVIDERS as readonly string[]).includes(provenance.platform);
  if (!knownProvider) {
    warnings.push(`Memory ${memory.id}: platform "${provenance.platform}" is not known to PAIC, imported as "other".`);
  }

  const importance = IMPORTANCE.includes(paic?.importance as MemoryImportance)
    ? (paic?.importance as MemoryImportance)
    : "medium";
  const confidence = memory.confidence?.current ?? memory.confidence?.initial;
  const originalTags = isStringArray(paic?.tags) ? paic.tags : undefined;
  const tags = originalTags ?? memory.tags;
  // importedAt = cuándo llegó a PAIC. Si el archivo lo exportó PAIC, se conserva;
  // si viene de otro sistema, llega ahora.
  const importedAt = paic ? stringOrUndefined(paic.imported_at) : now;

  return {
    id: memory.id,
    content: memory.content,
    category: memory.type,
    ...(memory.type === "custom" && memory.custom_type && { customCategory: memory.custom_type }),
    importance,
    ...(confidence !== undefined && { confidence }),
    status: memory.status ?? "active",
    source: {
      provider: knownProvider ? (provenance.platform as PAICProvider) : "other",
      ...(provenance.conversation_ref && { conversationId: provenance.conversation_ref }),
      ...(provenance.message_ref && { messageId: provenance.message_ref }),
      ...(provenance.extraction_method && { extractionMethod: provenance.extraction_method }),
      ...(provenance.extracted_at && { extractedAt: provenance.extracted_at }),
      ...(provenance.extractor && { extractor: provenance.extractor }),
      ...(importedAt && { importedAt }),
    },
    ...(tags && tags.length > 0 && { tags }),
    createdAt: temporal.created_at,
    updatedAt: temporal.updated_at ?? temporal.created_at,
    ...(temporal.valid_until && { validUntil: temporal.valid_until }),
    ...(temporal.superseded_by && { supersededBy: temporal.superseded_by }),
  };
}

// --- Reconstrucción del perfil ---
//
// metadata viene de fuera: cada valor se comprueba antes de ponerlo en el perfil.
// Si no tiene la forma esperada, se devuelve false y la memoria se importa como
// una memoria normal (con un aviso).

const RESPONSE_STYLES = ["short", "balanced", "detailed"];
const TONES = ["casual", "professional", "technical", "friendly"];
const DEPTHS = ["basic", "intermediate", "advanced"];
const PROJECT_STATUSES = ["idea", "planning", "active", "paused", "completed", "archived"];

function applyProfileField(document: PAICDocument, field: string, value: unknown): boolean {
  const [section, key, subkey] = field.split(".");
  const { identity, preferences } = document;

  if (section === "identity") {
    if (key === "languages" && isStringArray(value)) {
      identity.languages = value;
      return true;
    }
    if (["name", "occupation", "education", "location", "summary"].includes(key) && typeof value === "string") {
      identity[key as "name" | "occupation" | "education" | "location" | "summary"] = value;
      return true;
    }
    return false;
  }

  if (section === "preferences") {
    if (key === "responseStyle" && oneOf(value, RESPONSE_STYLES)) {
      preferences.responseStyle = value as typeof preferences.responseStyle;
      return true;
    }
    if (key === "tone" && oneOf(value, TONES)) {
      preferences.tone = value as typeof preferences.tone;
      return true;
    }
    if (key === "explanationDepth" && oneOf(value, DEPTHS)) {
      preferences.explanationDepth = value as typeof preferences.explanationDepth;
      return true;
    }
    if (key === "preferredLanguage" && typeof value === "string") {
      preferences.preferredLanguage = value;
      return true;
    }
    if (
      key === "formatting" &&
      ["prefersBullets", "prefersExamples", "prefersStepByStep"].includes(subkey) &&
      typeof value === "boolean"
    ) {
      preferences.formatting = { ...preferences.formatting, [subkey]: value };
      return true;
    }
    return false;
  }

  if (!isRecord(value) || typeof value.id !== "string") {
    return false;
  }

  if (section === "skills" && typeof value.name === "string") {
    document.skills.push(value as unknown as PAICSkill);
    return true;
  }
  if (section === "projects" && typeof value.name === "string" && oneOf(value.status, PROJECT_STATUSES)) {
    document.projects.push(value as unknown as PAICProject);
    return true;
  }
  if (section === "goals" && typeof value.title === "string") {
    document.goals.push(value as unknown as PAICGoal);
    return true;
  }
  return false;
}

// Lo que PAM permite y PAIC todavía no maneja: se informa, no se oculta.
function reportUnsupported(pam: PAMInput, warnings: string[]): void {
  if (pam.relations?.length) {
    warnings.push(`${pam.relations.length} relation(s) between memories were not imported (not supported yet).`);
  }
  if (pam.signature) {
    warnings.push("The file is signed, but the signature was not verified (not supported yet).");
  }
  if (pam.integrity) {
    warnings.push("The integrity checksum was not verified (not supported yet).");
  }
  const withSummary = pam.memories.filter((m) => m.summary).length;
  if (withSummary > 0) {
    warnings.push(`${withSummary} memory summary(ies) were not imported (PAIC has no summary field).`);
  }
  const withAccess = pam.memories.filter((m) => m.access).length;
  if (withAccess > 0) {
    warnings.push(`${withAccess} memory access rule(s) were not imported (not supported yet).`);
  }
  const withEmbedding = pam.memories.filter((m) => m.embedding_ref).length;
  if (withEmbedding > 0) {
    warnings.push(`${withEmbedding} embedding reference(s) were not imported (not supported yet).`);
  }
}

// --- utilidades ---

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function oneOf(value: unknown, options: string[]): boolean {
  return typeof value === "string" && options.includes(value);
}

function stringOrUndefined(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}
