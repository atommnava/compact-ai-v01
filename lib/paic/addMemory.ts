import type {
    PAICDocument, 
    PAICMemory,
    MemoryImportance
} from "@/types/paic";

export interface AddMemoryInput {
    content : string;
    category : PAICMemory["category"];
    importance? : MemoryImportance;
    tags? : string[];
}

export function addMemory(
    document : PAICDocument,
    input : AddMemoryInput
): PAICDocument {
    const now = new Date().toISOString();

    const newMemory : PAICMemory = {
        id : `memory-${document.memories.length + 1}`,
        content : input.content,
        category : input.category,
        importance : input.importance ?? "medium",
        tags : input.tags ?? [],
        createdAt : now,
        updatedAt : now
    }

    return {
        ...document,
        updatedAt : now,
        memories : [
            ...document.memories,
            newMemory
        ]
    };
}