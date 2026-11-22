// lib/paic/evaluateMemoryCandidates.ts

import type { MemoryCandidate } from "@/lib/paic/memoryCandidate";
import { UNKNOWN_CONVERSATION_ID } from "@/lib/paic/extractMemories";

// Propone un status para cada candidato "pending".
//
// Política v1 (conservadora): nunca aprueba automáticamente.
// - El extractor actual es heurístico y da 0.95 a frases como
//   "I am not a developer", así que una confianza alta no basta.
// - "approved" queda reservado para la decisión humana.
//
// Reglas, en orden:
// 1. Si ya no está "pending" → no se toca (respeta decisiones previas).
// 2. Si el extractor no sugiere guardarlo (shouldPersist = false) → "rejected".
// 3. Si el origen es desconocido → "review".
// 4. En cualquier otro caso → "review".
export function evaluateMemoryCandidates(
  candidates: MemoryCandidate[]
): MemoryCandidate[] {
  return candidates.map(evaluateCandidate);
}

function evaluateCandidate(candidate: MemoryCandidate): MemoryCandidate {
  if (candidate.status !== "pending") {
    return candidate;
  }

  if (!candidate.shouldPersist) {
    return {
      ...candidate,
      status: "rejected",
      evaluationReason: `Low heuristic confidence (${candidate.confidence}); the extractor does not suggest saving it.`,
    };
  }

  if (candidate.sourceConversationId === UNKNOWN_CONVERSATION_ID) {
    return {
      ...candidate,
      status: "review",
      evaluationReason: "Unknown origin: the source conversation is not known, a human must confirm it.",
    };
  }

  return {
    ...candidate,
    status: "review",
    evaluationReason: "Plausible memory from a user message; waiting for human approval.",
  };
}