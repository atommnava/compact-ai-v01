export type PAICVersion = "0.1";
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

export interface PAICMemory {
    id : string;
    content : string;
    category :
        | "identity"
        | "preference"
        | "project"
        | "skill"
        | "goal"
        | "relationship"
        | "technical"
        | "personal"
        | "other";
    
    importance : MemoryImportance;
    source? : PAICMemorySource;
    tags? : string[];
    createdAt : string;
    updatedAt : string;
}

export interface PAICMemorySource {
    provider? : "chatgpt" | "claude" | "gemini" | "deepseek" | "copilot" | "other";
    conversationId? : string;
    messageId? : string;
    importedAt? : string;
}

export interface PAICMetaData {
    ownerId? : string;
    sourceProviders? : string[];
    exportedFrom? : string;
    checkSum? : string;
    notes? : string;
}

