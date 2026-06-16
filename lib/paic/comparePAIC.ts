import type { PAICDocument } from "@/types/paic";

export interface PAICComparisonResult {
    isEqual : boolean;
    original : PAICDocument;
    imported : PAICDocument;
}

export function comparePAIC (
    original : PAICDocument,
    imported : PAICDocument
) : PAICComparisonResult {
    const originalJSON = JSON.stringify(original);
    const importedJSON = JSON.stringify(imported);

    return {
        isEqual : originalJSON === importedJSON,
        original,
        imported
    };
}