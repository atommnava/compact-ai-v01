// lib/paic/exportPAIC.ts

import type { PAICDocument } from "@/types/paic";
import { validatePAIC } from "./validatePaic";

export function exportPAIC(document : PAICDocument) : string {
    const validation = validatePAIC(document);

    if (!validation.isValid) {
        throw new Error (
            `Invalid PAIC document: ${validation.errors.join(", ")}`
        );
    }
    return JSON.stringify(document, null, 2);
}