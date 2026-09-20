import type { Conversation } from './conversation';

export const examppleConversation: Conversation = {
    id: 'conversation-1',
    title: 'Example Conversation',
    provider: 'Example Provider',
    model: 'Example Model',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    messages: [
        {
            id: 'message-1',
            role: 'user',
            content: 'Hello, how are you?',
            timestamp: new Date().toISOString()
        },
        {
            id: 'message-2',
            role: 'assistant',
            content: 'I am fine, thank you! How can I assist you today?',
            timestamp: new Date().toISOString()
        }
    ]
};