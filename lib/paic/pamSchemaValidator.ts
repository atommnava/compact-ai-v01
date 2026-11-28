// lib/paic/pamSchemaValidator.ts
//
// Valida un objeto contra el JSON Schema oficial de PAM v1.0 (copia en vendor/pam/).
// Se usa en los tests; ajv y ajv-formats son dependencias de desarrollo.

import Ajv2020 from "ajv/dist/2020";
import addFormats from "ajv-formats";
import pamSchema from "@/vendor/pam/portable-ai-memory.schema.json";

const ajv = new Ajv2020({ allErrors: true });
addFormats(ajv);

const validate = ajv.compile(pamSchema);

export interface PAMValidationResult {
  isValid: boolean;
  // Errores legibles, p. ej. "/memories/0/tags/0 must match pattern ...".
  errors: string[];
}

export function validatePAM(value: unknown): PAMValidationResult {
  const isValid = validate(value);
  const errors = (validate.errors ?? []).map(
    (error) => `${error.instancePath || "/"} ${error.message ?? "is invalid"}`
  );
  return { isValid, errors };
}
