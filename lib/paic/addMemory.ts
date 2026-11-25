import type {
    PAICDocument,
    PAICMemory,
    MemoryCategory,
    MemoryImportance
} from "@/types/paic";

// Añade una memoria escrita a mano por la persona.
export interface AddMemoryInput {
    content : string;
    category : MemoryCategory;
    // Obligatorio cuando category es "custom" (regla de PAM §5.1).
    customCategory? : string;
    importance? : MemoryImportance;
    tags? : string[];
}

export function addMemory(
    document : PAICDocument,
    input : AddMemoryInput
): PAICDocument {
    if (input.category === "custom" && !input.customCategory?.trim()) {
        throw new Error('customCategory is required when category is "custom".');
    }

    const now = new Date().toISOString();

    const newMemory : PAICMemory = {
        // UUID: único aunque se borren memorias. El antiguo `memory-${length + 1}`
        // repetía ids al borrar y volver a añadir.
        id : crypto.randomUUID(),
        content : input.content,
        category : input.category,
        ...(input.category === "custom" && { customCategory : input.customCategory?.trim() }),
        importance : input.importance ?? "medium",
        status : "active",
        // La escribió la persona: no hay conversación ni confianza de extracción.
        source : { provider : "manual", extractionMethod : "manual" },
        tags : input.tags ?? [],
        createdAt : now,
        updatedAt : now
    };

    return {
        ...document,
        updatedAt : now,
        memories : [
            ...document.memories,
            newMemory
        ]
    };
}
