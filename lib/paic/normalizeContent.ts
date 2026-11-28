// lib/paic/normalizeContent.ts

// Normaliza el texto de una memoria según PAM §6.1, para comparar contenidos.
// Es la misma normalización que PAM usa para su content_hash, así que la
// reutilizaremos al exportar.
//
//   1. Quitar espacios al principio y al final.
//   2. Pasar a minúsculas.
//   3. Normalización Unicode NFC ("é" escrita de dos formas distintas queda igual).
//   4. Juntar espacios repetidos en uno solo.
//
// Ejemplo: "  I prefer   Short answers " → "i prefer short answers"
export function normalizeContent(content: string): string {
  return content
    .trim()
    .toLowerCase()
    .normalize("NFC")
    .replace(/ {2,}/g, " ");
}
