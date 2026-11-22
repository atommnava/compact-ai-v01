// lib/paic/extractMemories.ts

import type { PAICMemory } from "@/types/paic";
import type { MemoryCandidate } from "@/lib/paic/memoryCandidate";
import type { Conversation } from "@/lib/paic/conversation";

export interface ExtractedMemoryInput {
  text: string;
}

export interface ExtractedMemoryResult {
  candidates: MemoryCandidate[];
}

// Valor provisional cuando el texto no viene de una conversación real.
export const UNKNOWN_CONVERSATION_ID = "unknown-conversation";

interface CandidateSource {
  conversationId: string;
  messageId: string;
}

// Extrae candidatos de texto plano. No conoce roles ni mensajes reales,
// por eso la procedencia es provisional.
export function extractMemories(
  input: ExtractedMemoryInput
): ExtractedMemoryResult {
  const candidates = splitSentences(input.text).map((sentence, index) =>
    buildCandidate(sentence, `candidate-${index + 1}`, {
      conversationId: UNKNOWN_CONVERSATION_ID,
      messageId: `unknown-message-${index + 1}`,
    })
  );

  return { candidates };
}

// Extrae candidatos de una conversación con roles.
// Solo los mensajes del usuario generan memoria personal (documento maestro §12.4):
// el texto del asistente o del sistema no es un hecho sobre el usuario.
export function extractMemoriesFromConversation(
  conversation: Conversation
): ExtractedMemoryResult {
  const candidates: MemoryCandidate[] = [];

  for (const message of conversation.messages) {
    if (message.role !== "user") {
      continue;
    }

    for (const sentence of splitSentences(message.content)) {
      candidates.push(
        buildCandidate(sentence, `candidate-${candidates.length + 1}`, {
          conversationId: conversation.id,
          messageId: message.id,
        })
      );
    }
  }

  return { candidates };
}

function splitSentences(text: string): string[] {
  return text
    .trim()
    .split(/[.!?]\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function buildCandidate(
  sentence: string,
  id: string,
  source: CandidateSource
): MemoryCandidate {
  const category = detectCategory(sentence);
  const confidence = detectConfidence(sentence);

  return {
    id,
    sourceConversationId: source.conversationId,
    sourceMessageId: source.messageId,
    content: sentence,
    category,
    confidence,
    reason: generateReason(sentence, category),
    shouldPersist: confidence >= 0.70,
    status: "pending",
  };
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