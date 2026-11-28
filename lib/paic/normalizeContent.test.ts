// lib/paic/normalizeContent.test.ts
import { describe, it, expect } from "vitest";
import { normalizeContent } from "@/lib/paic/normalizeContent";

describe("normalizeContent (PAM §6.1)", () => {
  it("quita espacios en los extremos, pasa a minúsculas y junta espacios repetidos", () => {
    expect(normalizeContent("  I prefer   Short answers ")).toBe("i prefer short answers");
  });

  it("trata igual una letra acentuada escrita de dos formas Unicode", () => {
    const precomposed = "café"; // "é" como un solo carácter
    const decomposed = "café"; // "e" + acento combinado

    expect(precomposed).not.toBe(decomposed);
    expect(normalizeContent(precomposed)).toBe(normalizeContent(decomposed));
  });

  it("no cambia el significado del texto", () => {
    expect(normalizeContent("I am not a developer")).not.toBe(normalizeContent("I am a developer"));
  });
});
