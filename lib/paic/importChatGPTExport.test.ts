// lib/paic/importChatGPTExport.test.ts
//
// Todos los datos de este archivo son INVENTADOS: imitan la estructura del
// conversations.json de ChatGPT, nunca el historial de una persona real.
import { describe, it, expect } from "vitest";
import { importChatGPTExport } from "@/lib/paic/importChatGPTExport";
import { extractMemoriesFromConversation } from "@/lib/paic/extractMemories";

// 2026-11-27T10:00:00.000Z en segundos Unix (ChatGPT usa segundos con decimales).
const T0 = 1795773600;

function message(id: string, role: string, parts: unknown[], extra: Record<string, unknown> = {}) {
  return {
    id,
    author: { role, name: null, metadata: {} },
    create_time: T0 + 60,
    content: { content_type: "text", parts },
    status: "finished_successfully",
    metadata: {},
    ...extra,
  };
}

function node(id: string, parent: string | null, children: string[], msg: unknown = null) {
  return { id, parent, children, message: msg };
}

// Conversación con una rama abandonada: la persona editó su segundo mensaje.
//
//   root ─ sys (oculto) ─ u1 ─ a1 ─┬─ u2-old ─ a2-old      (rama abandonada)
//                                   └─ u2 ─ a2 ─ tool       (rama visible, current_node = tool)
function sampleConversation() {
  return {
    title: "Planning my startup",
    create_time: T0,
    update_time: T0 + 600,
    default_model_slug: "gpt-4o",
    conversation_id: "conv-abc",
    id: "conv-abc",
    current_node: "tool",
    mapping: {
      root: node("root", null, ["sys"]),
      sys: node("sys", "root", ["u1"], message("msg-sys", "system", ["You are ChatGPT."], {
        metadata: { is_visually_hidden_from_conversation: true },
      })),
      u1: node("u1", "sys", ["a1"], message("msg-u1", "user", ["My name is Atom. I am building a startup project."])),
      a1: node("a1", "u1", ["u2-old", "u2"], message("msg-a1", "assistant", ["Nice to meet you, Atom!"])),
      "u2-old": node("u2-old", "a1", ["a2-old"], message("msg-u2-old", "user", ["I prefer short answers."])),
      "a2-old": node("a2-old", "u2-old", [], message("msg-a2-old", "assistant", ["Okay."])),
      u2: node("u2", "a1", ["a2"], {
        ...message("msg-u2", "user", ["I prefer detailed answers.", { content_type: "image_asset_pointer", asset_pointer: "file-service://x" }]),
        content: {
          content_type: "multimodal_text",
          parts: ["I prefer detailed answers.", { content_type: "image_asset_pointer", asset_pointer: "file-service://x" }],
        },
      }),
      a2: node("a2", "u2", ["tool"], message("msg-a2", "assistant", ["Sure, I will be detailed."])),
      tool: node("tool", "a2", [], message("msg-tool", "tool", ["search results"])),
    },
  };
}

describe("importChatGPTExport", () => {
  it("convierte una conversación con su título, modelo, fechas y mensajes", () => {
    const { conversations } = importChatGPTExport([sampleConversation()]);

    expect(conversations).toHaveLength(1);
    expect(conversations[0]).toMatchObject({
      id: "conv-abc",
      title: "Planning my startup",
      provider: "chatgpt",
      model: "gpt-4o",
      createdAt: "2026-11-27T10:00:00.000Z",
      updatedAt: "2026-11-27T10:10:00.000Z",
    });
  });

  it("solo importa la rama visible (current_node), no las versiones editadas", () => {
    const { conversations } = importChatGPTExport([sampleConversation()]);

    expect(conversations[0].messages.map((m) => [m.id, m.role, m.content])).toEqual([
      ["msg-u1", "user", "My name is Atom. I am building a startup project."],
      ["msg-a1", "assistant", "Nice to meet you, Atom!"],
      ["msg-u2", "user", "I prefer detailed answers."],
      ["msg-a2", "assistant", "Sure, I will be detailed."],
    ]);
  });

  it("salta mensajes ocultos, de herramientas y las partes que no son texto", () => {
    const { stats, conversations } = importChatGPTExport([sampleConversation()]);

    expect(stats).toEqual({
      conversations: 1,
      userMessages: 2,
      assistantMessages: 2,
      skippedMessages: 2, // el mensaje de sistema oculto y el de la herramienta
    });
    expect(conversations[0].messages[0].timestamp).toBe("2026-11-27T10:01:00.000Z");
  });

  it("acepta el contenido del archivo como texto JSON", () => {
    const { conversations } = importChatGPTExport(JSON.stringify([sampleConversation()]));

    expect(conversations[0].id).toBe("conv-abc");
  });

  it("si falta current_node, sigue la primera rama del árbol y avisa", () => {
    const conversation = { ...sampleConversation(), current_node: "does-not-exist" };

    const { conversations, warnings } = importChatGPTExport([conversation]);

    expect(conversations[0].messages.map((m) => m.id)).toEqual([
      "msg-u1",
      "msg-a1",
      "msg-u2-old",
      "msg-a2-old",
    ]);
    expect(warnings).toEqual([
      "Conversation conv-abc: current_node not found, used the first branch instead.",
    ]);
  });

  it("salta conversaciones mal formadas sin detener la importación", () => {
    const broken = [
      sampleConversation(),
      { title: "sin mapping", create_time: T0, id: "x" },
      { ...sampleConversation(), id: undefined, conversation_id: undefined },
      { ...sampleConversation(), conversation_id: "conv-no-date", id: "conv-no-date", create_time: "ayer" },
      "no soy una conversación",
    ];

    const { conversations, warnings } = importChatGPTExport(broken);

    expect(conversations.map((c) => c.id)).toEqual(["conv-abc"]);
    expect(warnings).toEqual([
      'Conversation #2: skipped, it has no message tree ("mapping").',
      "Conversation #3: skipped, it has no id.",
      "Conversation conv-no-date: skipped, it has no valid create_time.",
      'Conversation #5: skipped, it has no message tree ("mapping").',
    ]);
  });

  it("no se queda en un bucle si el árbol tiene un ciclo", () => {
    const conversation = sampleConversation();
    conversation.mapping.u1.parent = "a2"; // ciclo: u1 → a2 → u2 → a1 → u1

    const { conversations, warnings } = importChatGPTExport([conversation]);

    expect(conversations[0].messages.length).toBeGreaterThan(0);
    expect(warnings).toEqual([
      "Conversation conv-abc: the message tree has a cycle; stopped reading at it.",
    ]);
  });

  it("rechaza archivos que no son JSON o que no contienen una lista", () => {
    expect(() => importChatGPTExport("not json")).toThrow("Invalid JSON format");
    expect(() => importChatGPTExport({ conversations: [] })).toThrow("must contain an array");
  });
});

describe("del export de ChatGPT a candidatos de memoria", () => {
  it("los candidatos enlazan con la conversación y el mensaje reales de ChatGPT", () => {
    const [conversation] = importChatGPTExport([sampleConversation()]).conversations;

    const { candidates } = extractMemoriesFromConversation(conversation);

    expect(candidates.map((c) => [c.content, c.sourceConversationId, c.sourceMessageId])).toEqual([
      ["My name is Atom", "conv-abc", "msg-u1"],
      ["I am building a startup project.", "conv-abc", "msg-u1"],
      ["I prefer detailed answers.", "conv-abc", "msg-u2"],
    ]);
  });
});
