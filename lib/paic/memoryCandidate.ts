import type { MemoryCategory } from "@/types/paic";

// Categoría de un candidato: las de PAICMemory más "other", el cajón de lo que
// el extractor no supo clasificar. Al convertirse en memoria, "other" pasa a
// category "custom" con customCategory "other" (PAM no tiene un tipo "other").
export type CandidateCategory = MemoryCategory | "other";

// Ciclo de vida de un candidato antes de convertirse en PAICMemory:
// - pending:  recién extraído, nadie lo ha evaluado todavía.
// - review:   evaluado, pero necesita una decisión humana.
// - approved: aceptado; podrá guardarse como memoria.
// - rejected: descartado; no se guardará.
export type MemoryCandidateStatus =
    | "pending"
    | "review"
    | "approved"
    | "rejected";

export interface MemoryCandidate {
    id: string;
    // Procedencia: de qué conversación y de qué mensaje sale el candidato.
    // Un id de mensaje (p. ej. "m2") solo es único dentro de su conversación,
    // así que hacen falta los dos para localizar el origen.
    sourceConversationId: string;
    sourceMessageId: string;
    content: string;
    category: CandidateCategory;
    confidence: number;
    reason: string;
    shouldPersist: boolean;
    status: MemoryCandidateStatus;
    // Por qué evaluateMemoryCandidates le asignó su status.
    // Vacío mientras el candidato sigue en "pending".
    evaluationReason?: string;
}