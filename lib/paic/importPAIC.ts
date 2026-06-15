import { validatePAIC } from "@/lib/paic/validatePaic";
import { PAICDocument } from "@/types/paic";

export function importPAIC(json : string) : PAICDocument {
    let parsed : unknown;

    try {
        parsed = JSON.parse(json);
    } catch {
        throw new Error("Invalid JSON format...");
    }

    const validation = validatePAIC(parsed);

    if (!validation.isValid) {
        throw new Error(
            `Invalid PAIC document: ${validation.errors.join(", ")}`
        );
    }
    return parsed as PAICDocument;
}