// lib/paic/conversation.ts

export type ConversationRole = "user" | "assistant" | "system";

export interface ConversationMessage {
    id: string;
    role: ConversationRole;
    content: string;
    timestamp: string;
}

export interface Conversation {
    id: string;
    title? : string;
    provider?: string;
    model?: string;
    createdAt: string;
    updatedAt: string;
    messages: ConversationMessage[];
}
