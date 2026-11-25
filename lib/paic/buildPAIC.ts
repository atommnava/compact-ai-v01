import type { PAICDocument } from "@/types/paic";
import { createEmptyPAIC } from "./createEmptyPAIC";

export interface BuildPAICInput {
    name? : string;
    occupation? : string;
    education?: string;
    languages? : string[];
    location? : string;
    summary? : string;
    interests? : string[];
}

export function buildPAIC(input : BuildPAICInput) : PAICDocument {
    const paic = createEmptyPAIC();
    const now = new Date().toISOString();

    paic.updatedAt = now;
    paic.identity = {
        ...paic.identity,
        name : input.name ?? "",
        occupation : input.occupation ?? "",
        education: input.education ?? "",
        languages : input.languages ?? [],
        location : input.location ?? "",
        summary : input.summary ?? "",
    };

    if (input.interests && input.interests.length > 0) {
        paic.memories = input.interests.map((interest) => ({
            id : crypto.randomUUID(),
            content : `User is interested in ${interest}.`,
            // Un interés es un gusto declarado: en PAM, "preference" (taste or stated desire).
            category : "preference",
            importance : "medium",
            status : "active",
            source : { provider : "manual", extractionMethod : "manual" },
            tags : ["interest", interest],
            createdAt : now,
            updatedAt : now,
        }));
    }
    return paic;
}