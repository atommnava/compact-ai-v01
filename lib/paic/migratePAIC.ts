// lib/paic/migratePAIC.ts

import type {
    LegacyPAICVersion,
    MemoryCategory,
    MemoryImportance,
    PAICDocument,
    PAICMemory
} from "@/types/paic";

// --- Forma del contrato 0.1 (solo lo necesario para migrar) ---

type CategoryV01 =
    | "identity"
    | "preference"
    | "project"
    | "skill"
    | "goal"
    | "relationship"
    | "technical"
    | "personal"
    | "other";

interface PAICMemoryV01 {
    id : string;
    content : string;
    category : CategoryV01;
    importance : MemoryImportance;
    source? : {
        provider? : "chatgpt" | "claude" | "gemini" | "deepseek" | "copilot" | "other";
        conversationId? : string;
        messageId? : string;
        importedAt? : string;
    };
    tags? : string[];
    createdAt : string;
    updatedAt : string;
}

export interface PAICDocumentV01 extends Omit<PAICDocument, "version" | "memories"> {
    version : LegacyPAICVersion;
    memories : PAICMemoryV01[];
}

// Las 6 categorías compartidas con PAM se mantienen; las otras 3 se traducen.
const CATEGORY_MAP : Record<CategoryV01, MemoryCategory> = {
    identity : "identity",
    preference : "preference",
    project : "project",
    skill : "skill",
    goal : "goal",
    relationship : "relationship",
    technical : "environment", // PAM: "technical or physical environment details"
    personal : "context",
    other : "custom",          // PAM no tiene "other": custom + customCategory "other"
};

// ¿Es un documento 0.1 que se puede migrar?
// Si le faltan las memorias no se migra: validatePAIC reportará el error real.
export function isLegacyPAIC(value : unknown) : value is PAICDocumentV01 {
    if (!value || typeof value !== "object") {
        return false;
    }
    const doc = value as { version? : unknown; memories? : unknown };
    return doc.version === "0.1" && Array.isArray(doc.memories);
}

// Convierte un documento 0.1 en 0.2. Devuelve una copia; no modifica la entrada.
// No cambia updatedAt: migrar no es una edición hecha por la persona.
export function migratePAIC(document : PAICDocumentV01) : PAICDocument {
    return {
        ...document,
        version : "0.2",
        memories : document.memories.map(migrateMemory),
    };
}

function migrateMemory(memory : PAICMemoryV01) : PAICMemory {
    const category = CATEGORY_MAP[memory.category];

    return {
        ...memory,
        category,
        ...(memory.category === "other" && { customCategory : "other" }),
        status : "active",
        // PAM exige saber la plataforma de origen. En 0.1 era opcional:
        // si no la conocemos, lo decimos ("unknown") en lugar de inventarla.
        source : {
            ...memory.source,
            provider : memory.source?.provider ?? "unknown",
        },
    };
}
