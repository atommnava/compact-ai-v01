// lib/paic/importChatGPTExport.ts

import type { Conversation, ConversationMessage } from "@/lib/paic/conversation";

// Lee el archivo conversations.json de la exportación de datos de ChatGPT
// (Settings → Data controls → Export data) y lo convierte en Conversation[].
//
// ⚠️ Formato POR VERIFICAR con un export real. OpenAI no publica una
// especificación de este archivo; esta versión sigue el formato conocido:
//
//   [
//     {
//       "id" / "conversation_id": "…",
//       "title": "…",
//       "create_time": 1732700000.123,        ← segundos Unix (con decimales)
//       "update_time": 1732700300.456,
//       "default_model_slug": "gpt-4o",
//       "current_node": "<id del último nodo visible>",
//       "mapping": {
//         "<nodo>": {
//           "id": "<nodo>",
//           "parent": "<nodo padre>" | null,
//           "children": ["<nodo>", …],
//           "message": {
//             "id": "…",
//             "author": { "role": "user" | "assistant" | "system" | "tool" },
//             "create_time": 1732700001.5 | null,
//             "content": { "content_type": "text", "parts": ["…"] },
//             "metadata": { "is_visually_hidden_from_conversation": true? }
//           } | null
//         }
//       }
//     }
//   ]
//
// Cada conversación es un ÁRBOL: si editas un mensaje o regeneras una respuesta,
// la versión anterior queda como otra rama. La conversación que ves en ChatGPT es
// el camino desde `current_node` hasta la raíz. Solo se importa ese camino.
//
// El archivo es entrada no confiable: nada se da por supuesto. Lo que no se
// entiende se salta y se informa en `warnings`.

export const CHATGPT_PROVIDER = "chatgpt";

export interface ChatGPTImportStats {
  conversations: number;
  userMessages: number;
  assistantMessages: number;
  // Mensajes del camino visible que no se importaron (ocultos, de herramientas,
  // sin texto, como imágenes o archivos).
  skippedMessages: number;
}

export interface ChatGPTImportResult {
  conversations: Conversation[];
  stats: ChatGPTImportStats;
  warnings: string[];
}

export function importChatGPTExport(input: string | unknown): ChatGPTImportResult {
  let parsed: unknown = input;
  if (typeof input === "string") {
    try {
      parsed = JSON.parse(input);
    } catch {
      throw new Error("Invalid JSON format...");
    }
  }

  if (!Array.isArray(parsed)) {
    throw new Error("Invalid ChatGPT export: conversations.json must contain an array of conversations.");
  }

  const conversations: Conversation[] = [];
  const warnings: string[] = [];
  const stats: ChatGPTImportStats = {
    conversations: 0,
    userMessages: 0,
    assistantMessages: 0,
    skippedMessages: 0,
  };

  parsed.forEach((raw, index) => {
    const conversation = readConversation(raw, index, stats, warnings);
    if (conversation) {
      conversations.push(conversation);
      stats.conversations++;
    }
  });

  return { conversations, stats, warnings };
}

function readConversation(
  raw: unknown,
  index: number,
  stats: ChatGPTImportStats,
  warnings: string[]
): Conversation | undefined {
  if (!isRecord(raw) || !isRecord(raw.mapping)) {
    warnings.push(`Conversation #${index + 1}: skipped, it has no message tree ("mapping").`);
    return undefined;
  }

  const id = stringOr(raw.conversation_id) ?? stringOr(raw.id);
  if (!id) {
    warnings.push(`Conversation #${index + 1}: skipped, it has no id.`);
    return undefined;
  }

  const createdAt = toISO(raw.create_time);
  if (!createdAt) {
    warnings.push(`Conversation ${id}: skipped, it has no valid create_time.`);
    return undefined;
  }
  const updatedAt = toISO(raw.update_time) ?? createdAt;

  const path = visiblePath(raw.mapping, stringOr(raw.current_node), id, warnings);
  const messages: ConversationMessage[] = [];

  for (const node of path) {
    const message = readMessage(node, createdAt);
    if (!message) {
      // Nodos sin mensaje (p. ej. la raíz del árbol) no cuentan como saltados.
      if (isRecord(node.message)) {
        stats.skippedMessages++;
      }
      continue;
    }
    messages.push(message);
    if (message.role === "user") stats.userMessages++;
    if (message.role === "assistant") stats.assistantMessages++;
  }

  const title = stringOr(raw.title);
  const model = stringOr(raw.default_model_slug);

  return {
    id,
    ...(title && { title }),
    provider: CHATGPT_PROVIDER,
    ...(model && { model }),
    createdAt,
    updatedAt,
    messages,
  };
}

// Camino visible: de current_node hacia la raíz siguiendo `parent`, y luego al revés.
// Si no hay current_node válido, se usa la última hoja de la primera rama.
function visiblePath(
  mapping: Record<string, unknown>,
  currentNode: string | undefined,
  conversationId: string,
  warnings: string[]
): Record<string, unknown>[] {
  let nodeId = currentNode && isRecord(mapping[currentNode]) ? currentNode : findLastLeaf(mapping);
  if (currentNode && nodeId !== currentNode) {
    warnings.push(`Conversation ${conversationId}: current_node not found, used the first branch instead.`);
  }

  const path: Record<string, unknown>[] = [];
  const visited = new Set<string>();

  while (nodeId && !visited.has(nodeId)) {
    visited.add(nodeId);
    const node = mapping[nodeId];
    if (!isRecord(node)) {
      break;
    }
    path.push(node);
    nodeId = stringOr(node.parent);
  }

  if (nodeId && visited.has(nodeId)) {
    warnings.push(`Conversation ${conversationId}: the message tree has a cycle; stopped reading at it.`);
  }

  return path.reverse();
}

// Desde la raíz, baja siempre por el primer hijo hasta una hoja.
function findLastLeaf(mapping: Record<string, unknown>): string | undefined {
  const root = Object.entries(mapping).find(([, node]) => isRecord(node) && !node.parent)?.[0];
  let nodeId = root;
  const visited = new Set<string>();

  while (nodeId && !visited.has(nodeId)) {
    visited.add(nodeId);
    const node = mapping[nodeId];
    const children = isRecord(node) && Array.isArray(node.children) ? node.children : [];
    const next = children.find((child): child is string => typeof child === "string" && isRecord(mapping[child]));
    if (!next) {
      return nodeId;
    }
    nodeId = next;
  }
  return nodeId;
}

// Convierte un nodo en mensaje. Devuelve undefined si no es un mensaje de texto
// visible de user, assistant o system.
function readMessage(node: Record<string, unknown>, fallbackTime: string): ConversationMessage | undefined {
  const message = node.message;
  if (!isRecord(message)) {
    return undefined;
  }

  const role = isRecord(message.author) ? message.author.role : undefined;
  if (role !== "user" && role !== "assistant" && role !== "system") {
    // "tool" y otros roles internos no son parte de la conversación con la persona.
    return undefined;
  }

  if (isRecord(message.metadata) && message.metadata.is_visually_hidden_from_conversation === true) {
    return undefined;
  }

  const content = readText(message.content);
  if (!content) {
    return undefined;
  }

  const id = stringOr(message.id) ?? stringOr(node.id);
  if (!id) {
    return undefined;
  }

  return {
    id,
    role,
    content,
    timestamp: toISO(message.create_time) ?? fallbackTime,
  };
}

// Solo el texto: en "text" y "multimodal_text" las partes de texto son strings;
// las imágenes y archivos llegan como objetos y se ignoran.
function readText(content: unknown): string | undefined {
  if (!isRecord(content)) {
    return undefined;
  }
  if (content.content_type !== "text" && content.content_type !== "multimodal_text") {
    return undefined;
  }
  const parts = Array.isArray(content.parts) ? content.parts : [];
  const text = parts
    .filter((part): part is string => typeof part === "string")
    .join("\n")
    .trim();
  return text || undefined;
}

// --- utilidades ---

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringOr(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

// Segundos Unix (con decimales) → ISO 8601.
function toISO(seconds: unknown): string | undefined {
  if (typeof seconds !== "number" || !Number.isFinite(seconds) || seconds <= 0) {
    return undefined;
  }
  return new Date(Math.round(seconds * 1000)).toISOString();
}
