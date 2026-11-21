// lib/paic/validatePaic.ts
import type { PAICDocument } from "@/types/paic"

export interface PAICValidationResult {
    isValid : boolean;
    errors : string[];
}

export function validatePAIC(document : unknown) : PAICValidationResult {
    const errors : string[] = [];

    if (!document || typeof document !== "object") {
        return {
            isValid : false,
            errors : ["Document must be an object"]
        };
    }
    const paic = document as Partial<PAICDocument>;

    if (paic.version !== "0.1") {
        errors.push("Invalid or missing PAIC version.");
    }
    if (!paic.createdAt) {
        errors.push("Missing createdAt");
    }
    if (!paic.updatedAt) {
        errors.push("Missing updatedAt");
    }
    if (!paic.identity) {
        errors.push("Missing preferences.");
    }
    if (!Array.isArray(paic.skills)) {
        errors.push("Skills must be an array");
    }
    if (!Array.isArray(paic.projects)) {
        errors.push("Projects must be an array");
    }
    if (!Array.isArray(paic.memories)) {
        errors.push("Memories must be an array.");
    }
    return {
        isValid : errors.length === 0,
        errors
    };
}