import { validatePAIC } from "@/lib/paic/validatePAIC";
import { isLegacyPAIC, migratePAIC } from "@/lib/paic/migratePAIC";
import type { PAICDocument } from "@/types/paic";

// Lee un documento PAIC en JSON. Los documentos 0.1 se migran a 0.2 antes de validar.
export function importPAIC(json : string) : PAICDocument {
    let parsed : unknown;

    try {
        parsed = JSON.parse(json);
    } catch {
        throw new Error("Invalid JSON format...");
    }

    const document = isLegacyPAIC(parsed) ? migratePAIC(parsed) : parsed;
    const validation = validatePAIC(document);

    if (!validation.isValid) {
        throw new Error(
            `Invalid PAIC document: ${validation.errors.join(", ")}`
        );
    }
    return document as PAICDocument;
}
