import type { PAICMemory, MemoryImportance } from "@/types/paic";

export interface ExtractedMemoryInput {
  text: string;
}

export interface ExtractedMemoryResult {
  memories: PAICMemory[];
}

export function extractMemories(input: ExtractedMemoryInput): ExtractedMemoryResult {
  const now = new Date().toISOString();
  const text = input.text.trim();

  const memories: PAICMemory[] = [];

  if (!text) {
    return { memories };
  }

  const sentences = text.split(/[.!?]\s+/).map((sentence) => sentence.trim()).filter(Boolean);

  sentences.forEach((sentence, index) => {
    const category = detectCategory(sentence);
    const importance = detectImportance(sentence);

    memories.push({
      id: `extracted-memory-${index + 1}`,
      content: sentence,
      category,
      importance,
      tags: generateTags(sentence),
      createdAt: now,
      updatedAt: now
    });
  });
  return { memories };
}

function detectCategory(sentence: string): PAICMemory["category"] {
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

function detectImportance(sentence: string): MemoryImportance {
  const lower = sentence.toLowerCase();

  if (
    lower.includes("important") ||
    lower.includes("critical") ||
    lower.includes("main goal") ||
    lower.includes("startup")
  ) {
    return "critical";
  }

  if (
    lower.includes("project") ||
    lower.includes("building") ||
    lower.includes("goal")
  ) {
    return "high";
  }
  return "medium";
}

function generateTags(sentence: string): string[] {
  const lower = sentence.toLocaleLowerCase();
  const tags: string[] = [];

   if (/\bai\b/.test(lower)) tags.push("AI");
  if (/\bpaic\b/.test(lower)) tags.push("PAIC");
  if (/\bstartup\b/.test(lower)) tags.push("startup");
  if (/\btypescript\b/.test(lower)) tags.push("TypeScript");
  if (/\breact\b/.test(lower)) tags.push("React");
  if (/\bnext\.js\b/.test(lower)) tags.push("Next.js");
  if (/\bdrones\b/.test(lower)) tags.push("drones");

  return tags;
}