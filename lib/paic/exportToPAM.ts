// lib/paic/exportToPAM.ts

import type { PAICDocument, PAICMemory } from "@/types/paic";
import { normalizeContent } from "@/lib/paic/normalizeContent";
import { profileToMemories } from "@/lib/paic/profileToMemories";

// Adaptador PAIC → PAM v1.0 (https://portable-ai-memory.org/spec/v1.0/).
//
// PAIC guarda sus datos en camelCase y con campos propios (importance, importedAt).
// PAM usa snake_case y rechaza cualquier campo que no conozca
// (additionalProperties: false), así que aquí se traduce campo por campo.
// Lo que PAM no tiene viaja en metadata.paic, para no perderlo.
//
// Es async porque el content_hash usa Web Crypto (crypto.subtle), que funciona
// igual en Node y en el navegador.

export const PAM_SCHEMA_VERSION = "1.0";
export const PAM_SPEC_URI = "https://portable-ai-memory.org/spec/v1.0";
// Sistema que genera el export, formato "nombre/semver" (PAM §3.2).
export const PAIC_EXPORTER = "paic/0.1.0";

// --- Forma del archivo PAM (solo los campos que genera PAIC) ---

export interface PAMMemory {
  id: string;
  type: PAICMemory["category"];
  custom_type?: string;
  status: PAICMemory["status"];
  content: string;
  content_hash: string;
  tags?: string[];
  confidence?: { initial: number; current: number };
  temporal: {
    created_at: string;
    updated_at?: string;
    valid_until?: string;
    superseded_by?: string;
  };
  provenance: {
    platform: string;
    conversation_ref?: string;
    message_ref?: string;
    extraction_method?: string;
    extracted_at?: string;
    extractor?: string;
  };
  metadata?: Record<string, unknown>;
}

export interface PAMConversationIndexEntry {
  id: string;
  platform: string;
  temporal: { created_at: string };
  derived_memories: string[];
}

export interface PAMExport {
  schema: "portable-ai-memory";
  schema_version: string;
  spec_uri: string;
  export_id: string;
  exported_by: string;
  export_date: string;
  export_type: "full";
  owner: { id: string };
  memories: PAMMemory[];
  conversations_index?: PAMConversationIndexEntry[];
}

export interface ExportToPAMOptions {
  // Identificador del dueño. Si no se indica, se usa metadata.ownerId del documento.
  ownerId?: string;
  // Momento del export y su id. Se pueden fijar para que los tests sean deterministas.
  now?: string;
  exportId?: string;
  // Incluir el perfil (identity, preferences, skills, projects, goals) convertido
  // en memorias. Por defecto sí: PAM solo tiene memorias y, sin esto, se perdería.
  includeProfile?: boolean;
}

export async function exportToPAM(
  document: PAICDocument,
  options: ExportToPAMOptions = {}
): Promise<PAMExport> {
  const ownerId = options.ownerId ?? document.metadata?.ownerId;
  if (!ownerId?.trim()) {
    // PAM exige owner.id. No lo inventamos: quien exporta debe decir de quién es.
    throw new Error("ownerId is required to export to PAM.");
  }

  const profile = options.includeProfile === false ? [] : profileToMemories(document);
  const memories = await Promise.all([
    ...profile.map(({ memory, field }) => toPAMMemory(memory, field)),
    ...document.memories.map((memory) => toPAMMemory(memory)),
  ]);
  const conversationsIndex = buildConversationsIndex(memories);

  return {
    schema: "portable-ai-memory",
    schema_version: PAM_SCHEMA_VERSION,
    spec_uri: PAM_SPEC_URI,
    export_id: options.exportId ?? crypto.randomUUID(),
    exported_by: PAIC_EXPORTER,
    export_date: options.now ?? new Date().toISOString(),
    export_type: "full",
    owner: { id: ownerId.trim() },
    memories,
    ...(conversationsIndex.length > 0 && { conversations_index: conversationsIndex }),
  };
}

// content_hash de PAM §6: "sha256:" + hex(SHA-256(UTF-8(normalize(content))))
export async function computeContentHash(content: string): Promise<string> {
  const bytes = new TextEncoder().encode(normalizeContent(content));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const hex = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
  return `sha256:${hex}`;
}

// Las etiquetas de PAM solo admiten minúsculas, números, "_" y "-" (^[a-z0-9][a-z0-9_-]*$).
// Ejemplos: "Startup" → "startup", "Next.js" → "nextjs", "Programación web" → "programacion-web".
export function toPAMTag(tag: string): string {
  return tag
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // quita acentos
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9_-]/g, "")
    .replace(/^[-_]+/, "");
}

// profileField: campo del perfil del que sale la memoria (ver profileToMemories).
async function toPAMMemory(memory: PAICMemory, profileField?: string): Promise<PAMMemory> {
  if (memory.category === "custom" && !memory.customCategory) {
    throw new Error(`Memory ${memory.id} has category "custom" but no customCategory.`);
  }

  // Sin duplicados ni vacías (PAM exige uniqueItems).
  const tags = [...new Set((memory.tags ?? []).map(toPAMTag).filter(Boolean))];
  const { source } = memory;

  return {
    id: memory.id,
    type: memory.category,
    ...(memory.category === "custom" && { custom_type: memory.customCategory }),
    status: memory.status,
    content: memory.content,
    content_hash: await computeContentHash(memory.content),
    ...(tags.length > 0 && { tags }),
    ...(memory.confidence !== undefined && {
      confidence: { initial: memory.confidence, current: memory.confidence },
    }),
    temporal: {
      created_at: memory.createdAt,
      updated_at: memory.updatedAt,
      ...(memory.validUntil && { valid_until: memory.validUntil }),
      ...(memory.supersededBy && { superseded_by: memory.supersededBy }),
    },
    provenance: {
      platform: source.provider,
      ...(source.conversationId && { conversation_ref: source.conversationId }),
      ...(source.messageId && { message_ref: source.messageId }),
      ...(source.extractionMethod && { extraction_method: source.extractionMethod }),
      ...(source.extractedAt && { extracted_at: source.extractedAt }),
      ...(source.extractor && { extractor: source.extractor }),
    },
    // Lo que PAM no tiene: se conserva para poder reimportarlo en PAIC.
    metadata: {
      paic: {
        importance: memory.importance,
        ...(source.importedAt && { imported_at: source.importedAt }),
        // Permite reconstruir el perfil al reimportar en PAIC.
        ...(profileField && { profile_field: profileField }),
      },
    },
  };
}

// PAM §14.1: cada conversation_ref debe tener su entrada en conversations_index,
// con la lista de memorias que salieron de ella (derived_memories).
// PAIC no guarda la fecha de la conversación: usamos la de la memoria más antigua
// que salió de ella, que es lo más cercano que conocemos.
function buildConversationsIndex(memories: PAMMemory[]): PAMConversationIndexEntry[] {
  const index = new Map<string, PAMConversationIndexEntry>();

  for (const memory of memories) {
    const conversationId = memory.provenance.conversation_ref;
    if (!conversationId) {
      continue;
    }

    const entry = index.get(conversationId);
    if (!entry) {
      index.set(conversationId, {
        id: conversationId,
        platform: memory.provenance.platform,
        temporal: { created_at: memory.temporal.created_at },
        derived_memories: [memory.id],
      });
      continue;
    }

    entry.derived_memories.push(memory.id);
    if (memory.temporal.created_at < entry.temporal.created_at) {
      entry.temporal.created_at = memory.temporal.created_at;
    }
  }

  return [...index.values()];
}
