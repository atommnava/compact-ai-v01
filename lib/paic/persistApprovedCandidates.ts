// lib/paic/persistApprovedCandidates.ts

import type { PAICDocument, PAICMemory, PAICProvider } from "@/types/paic";
import type { MemoryCandidate } from "@/lib/paic/memoryCandidate";
import { UNKNOWN_CONVERSATION_ID } from "@/lib/paic/extractMemories";
import { normalizeContent } from "@/lib/paic/normalizeContent";

// Último paso del flujo: los candidatos "approved" se convierten en PAICMemory
// y se añaden al documento.
//
//   extract → evaluate → approve/reject → persistApprovedCandidates
//
// Reglas:
// - Solo se guardan los candidatos con status "approved"; el resto se ignora.
// - Si el contenido ya existe como memoria activa (o se repite en el mismo lote),
//   no se duplica: se informa en `skipped` con la memoria que ya lo contiene.
// - Devuelve un documento nuevo; no modifica ni el documento ni los candidatos.

// Versión del extractor por reglas (formato "nombre/semver" de PAM §11.2).
export const RULE_EXTRACTOR = "paic-rules/0.1.0";

export interface PersistOptions {
  // Plataforma de la conversación de origen. Por defecto "unknown".
  provider?: PAICProvider;
  // Momento del guardado. Se puede fijar para que los tests sean deterministas.
  now?: string;
}

export interface SkippedCandidate {
  candidateId: string;
  reason: "duplicate";
  // Memoria que ya tiene ese mismo contenido.
  existingMemoryId: string;
}

export interface PersistResult {
  document: PAICDocument;
  persisted: PAICMemory[];
  skipped: SkippedCandidate[];
}

export function persistApprovedCandidates(
  document: PAICDocument,
  candidates: MemoryCandidate[],
  options: PersistOptions = {}
): PersistResult {
  const now = options.now ?? new Date().toISOString();
  const provider = options.provider ?? "unknown";

  // Contenido normalizado → id de la memoria activa que ya lo contiene.
  const knownContent = new Map<string, string>();
  for (const memory of document.memories) {
    if (memory.status === "active") {
      knownContent.set(normalizeContent(memory.content), memory.id);
    }
  }

  const persisted: PAICMemory[] = [];
  const skipped: SkippedCandidate[] = [];

  for (const candidate of candidates) {
    if (candidate.status !== "approved") {
      continue;
    }

    const key = normalizeContent(candidate.content);
    const existingMemoryId = knownContent.get(key);

    if (existingMemoryId) {
      skipped.push({ candidateId: candidate.id, reason: "duplicate", existingMemoryId });
      continue;
    }

    const memory = toMemory(candidate, provider, now);
    persisted.push(memory);
    knownContent.set(key, memory.id);
  }

  if (persisted.length === 0) {
    return { document, persisted, skipped };
  }

  return {
    document: {
      ...document,
      updatedAt: now,
      memories: [...document.memories, ...persisted],
    },
    persisted,
    skipped,
  };
}

function toMemory(
  candidate: MemoryCandidate,
  provider: PAICProvider,
  now: string
): PAICMemory {
  // Si el texto no vino de una conversación real, sus ids son provisionales
  // ("unknown-conversation", "unknown-message-N"): no se guardan como procedencia.
  const knownOrigin = candidate.sourceConversationId !== UNKNOWN_CONVERSATION_ID;

  return {
    id: crypto.randomUUID(),
    content: candidate.content,
    // PAM no tiene "other": se guarda como custom + customCategory "other".
    ...(candidate.category === "other"
      ? { category: "custom" as const, customCategory: "other" }
      : { category: candidate.category }),
    // Los candidatos no traen importancia; la persona podrá ajustarla después.
    importance: "medium",
    confidence: candidate.confidence,
    status: "active",
    source: {
      provider,
      ...(knownOrigin && {
        conversationId: candidate.sourceConversationId,
        messageId: candidate.sourceMessageId,
      }),
      // El extractor solo procesa frases literales del usuario.
      extractionMethod: "explicit_user_input",
      extractor: RULE_EXTRACTOR,
      importedAt: now,
    },
    createdAt: now,
    updatedAt: now,
  };
}
