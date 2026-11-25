// types/paic.ts

// Versión actual del contrato. Los documentos "0.1" se migran al importarlos
// (ver lib/paic/migratePAIC.ts).
export type PAICVersion = "0.2";
export type LegacyPAICVersion = "0.1";

// Utilidad de recordar algo. No es lo mismo que confidence (calidad de la evidencia).
export type MemoryImportance = "low" | "medium" | "high" | "critical";
export type ProjectStatus =
    | "idea"
    | "planning"
    | "active"
    | "paused"
    | "completed"
    | "archived";

export interface PAICDocument {
    version: PAICVersion,
    createdAt: string;
    updatedAt: string;

    identity: PAICIdentity;
    preferences: PAICPreferences;
    skills: PAICSkill[];
    projects: PAICProject[];
    goals: PAICGoal[];
    memories: PAICMemory[];

    metadata? : PAICMetaData;
}

export interface PAICIdentity {
    name? : string;
    occupation? : string;
    education? : string;
    languages?: string[];
    location? : string;

    summary?: string;
}

export interface PAICPreferences {
    responseStyle? : "short" | "balanced" | "detailed";
    tone? : "casual" | "professional" | "technical" | "friendly";
    preferredLanguage? : string;
    explanationDepth? : "basic" | "intermediate" | "advanced";
    formatting? : {
        prefersBullets? : boolean;
        prefersExamples? : boolean;
        prefersStepByStep? : boolean;
    }
}

export interface PAICSkill {
    id : string;
    name : string;
    level? : "begginer" | "intermediate" | "advanced" | "expert";
    category? : string;
    evidence? : string[];
}

export interface PAICProject {
    id : string;
    name: string;
    description? : string;
    status : ProjectStatus;
    technologies? : string[];
    goals?: string[];
    notes?: string[];
    createdAt? : string;
    updatedAt? : string;
}

export interface PAICGoal {
    id : string;
    title : string;
    description? : string;
    timeframe? : "short_term" | "medium_term" | "long_term";
    status? : "not_started" | "in_process" | "completed" | "abandoned";
    relatedProjects? : string[];
}

// --- Memorias, alineadas con PAM v1.0 (https://portable-ai-memory.org/spec/v1.0/) ---

// Mismos valores que el "type" de PAM (§5). "custom" exige customCategory.
export type MemoryCategory =
    | "fact"
    | "preference"
    | "skill"
    | "context"
    | "relationship"
    | "goal"
    | "instruction"
    | "identity"
    | "environment"
    | "project"
    | "custom";

// Ciclo de vida de una memoria ya guardada (PAM §7). Una memoria "retracted"
// nunca se borra físicamente: se conserva para auditoría y para poder deshacer.
export type MemoryStatus =
    | "active"
    | "superseded"
    | "deprecated"
    | "retracted"
    | "archived";

// Cómo se obtuvo la memoria (PAM §11.3, lista cerrada).
export type ExtractionMethod =
    | "llm_inference"
    | "explicit_user_input"
    | "api_export"
    | "browser_extraction"
    | "manual";

// Plataformas recomendadas por PAM (§11.4) más las propias de PAIC.
// "unknown" = origen desconocido (p. ej. memorias migradas desde la versión 0.1).
export type PAICProvider =
    | "chatgpt"
    | "claude"
    | "gemini"
    | "grok"
    | "perplexity"
    | "copilot"
    | "deepseek"
    | "local"
    | "manual"
    | "other"
    | "unknown";

export interface PAICMemory {
    id : string;
    content : string;
    category : MemoryCategory;
    // Obligatorio cuando category === "custom" (p. ej. "other").
    customCategory? : string;

    importance : MemoryImportance;
    // Calidad de la evidencia, de 0 a 1. Ausente si la escribió la persona a mano.
    confidence? : number;
    status : MemoryStatus;
    source : PAICMemorySource;
    tags? : string[];

    createdAt : string;
    updatedAt : string;
    // Hasta cuándo es válida (para memorias que caducan).
    validUntil? : string;
    // Id de la memoria que la reemplaza (cuando status === "superseded").
    supersededBy? : string;
}

// Procedencia de la memoria (equivale a "provenance" en PAM §11).
export interface PAICMemorySource {
    provider : PAICProvider;
    conversationId? : string;
    messageId? : string;
    extractionMethod? : ExtractionMethod;
    extractedAt? : string;
    // Sistema que la extrajo, formato "nombre/semver" (p. ej. "paic-rules/0.1.0").
    extractor? : string;
    // Cuándo llegó a PAIC. No existe en PAM: al exportar viajará en metadata.
    importedAt? : string;
}

export interface PAICMetaData {
    ownerId? : string;
    sourceProviders? : string[];
    exportedFrom? : string;
    checkSum? : string;
    notes? : string;
}

