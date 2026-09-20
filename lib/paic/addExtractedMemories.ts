import type {
    PAICMemory,
    PAICDocument
} from '@/types/paic';

export function addExtractedMemories(document: PAICDocument, memories: PAICMemory[]) : PAICDocument {
    if (memories.length === 0) {
        return document;
    }

    const now = new Date().toISOString();
    return {
        ...document,
        updatedAt: now,
        memories: [...document.memories, ...memories]
    };
}