// lib/paic/extractMemories.ts

import type { PAICMemory } from "@/types/paic";
import type { MemoryCandidate } from "@/lib/paic/memoryCandidate";

export interface ExtractedMemoryInput {
  text: string;
}

export interface ExtractedMemoryResult {
  candidates: MemoryCandidate[];
}

export function extractMemories(
  input: ExtractedMemoryInput
): ExtractedMemoryResult {
  const text = input.text.trim();

  const candidates: MemoryCandidate[] = [];

  if (!text) {
    return { candidates };
  }

  const sentences = text
    .split(/[.!?]\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  sentences.forEach((sentence, index) => {
    const category = detectCategory(sentence);
    const confidence = detectConfidence(sentence);
    const shouldPersist = confidence >= 0.70;

    candidates.push({
      id: `candidate-${index + 1}`,
      sourceMessageId: `unknown-message-${index + 1}`,
      content: sentence,
      category,
      confidence,
      reason: generateReason(sentence, category),
      shouldPersist,
    });
  });

  return { candidates };
}

function detectCategory(
  sentence: string
): PAICMemory["category"] {
  const lower = sentence.toLowerCase();

  if (
    lower.includes("building") ||
    lower.includes("project") ||
    lower.includes("startup") ||
    lower.includes("mvp")
  ) {
    return "project";
  }

  if (
    lower.includes("my name is") ||
    lower.includes("i am") ||
    lower.includes("i'm") ||
    lower.includes("study") ||
    lower.includes("work")
  ) {
    return "identity";
  }

  if (
    lower.includes("prefer") ||
    lower.includes("like responses") ||
    lower.includes("explain")
  ) {
    return "preference";
  }

  if (
    lower.includes("typescript") ||
    lower.includes("react") ||
    lower.includes("next.js") ||
    lower.includes("programming")
  ) {
    return "skill";
  }

  if (
    lower.includes("goal") ||
    lower.includes("want to") ||
    lower.includes("plan to")
  ) {
    return "goal";
  }

  return "other";
}

function detectConfidence(sentence: string): number {
  const lower = sentence.toLowerCase();

  if (
    lower.includes("my name is") ||
    lower.includes("i am") ||
    lower.includes("i'm")
  ) {
    return 0.95;
  }

  if (
    lower.includes("building") ||
    lower.includes("project") ||
    lower.includes("startup")
  ) {
    return 0.90;
  }

  if (
    lower.includes("prefer") ||
    lower.includes("want to") ||
    lower.includes("plan to")
  ) {
    return 0.85;
  }

  return 0.60;
}

function generateReason(
  sentence: string,
  category: PAICMemory["category"]
): string {
  const lower = sentence.toLowerCase();

  if (
    lower.includes("my name is") ||
    lower.includes("i am") ||
    lower.includes("i'm")
  ) {
    return "Explicit statement made by the user.";
  }

  if (
    lower.includes("building") ||
    lower.includes("project") ||
    lower.includes("startup")
  ) {
    return "User explicitly describes an ongoing project.";
  }

  if (
    lower.includes("prefer")
  ) {
    return "User explicitly describes a preference.";
  }

  if (
    lower.includes("want to") ||
    lower.includes("plan to")
  ) {
    return "User explicitly describes a goal or intention.";
  }

  return `Potential ${category} memory detected from the text.`;
}