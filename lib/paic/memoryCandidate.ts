import type { PAICMemory } from "@/types/paic";

export interface MemoryCandidate {
    id: string;
    sourceMessageId: string;
    content: string;
    category: PAICMemory["category"];
    confidence: number;
    reason: string;
    shouldPersist: boolean;
}