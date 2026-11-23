// lib/paic/reviewCandidate.ts

import type { MemoryCandidate } from "@/lib/paic/memoryCandidate";

// Decisiones humanas sobre un candidato.
//
// - La persona tiene la última palabra: puede aprobar o rechazar un candidato
//   en cualquier status, incluso revertir un "rejected" propuesto por el evaluador.
// - Devuelven una copia; nunca modifican el candidato original.
// - Una vez decidido, evaluateMemoryCandidates ya no lo toca (solo evalúa "pending").

const DEFAULT_APPROVE_REASON = "Approved by the user.";
const DEFAULT_REJECT_REASON = "Rejected by the user.";

export function approveCandidate(
    candidate: MemoryCandidate,
    reason?: string
): MemoryCandidate {
    return {
        ...candidate,
        status: "approved",
        evaluationReason: reason?.trim() || DEFAULT_APPROVE_REASON,
    };
}

export function rejectCandidate(
    candidate: MemoryCandidate,
    reason?: string
): MemoryCandidate {
    return {
        ...candidate,
        status: "rejected",
        evaluationReason: reason?.trim() || DEFAULT_REJECT_REASON,
    };
}