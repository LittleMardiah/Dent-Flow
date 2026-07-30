import apiClient from '../axios';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface ChatRequest {
  message: string;
  history?: ChatMessage[];
}

export interface ChatResponse {
  message: string;
  suggestedActions?: Array<{
    label: string;
    action: string;
  }>;
}

export const aiChatApi = {
  // Send message to AI backend
  sendMessage: async (message: string, history?: ChatMessage[]): Promise<ChatResponse> => {
    const response = await apiClient.post('/ai/chat', { message, history });
    return response.data.data;
  },

  // Generate a random ID for messages
  generateId: (): string => {
    return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  },

  // Get current timestamp
  getTimestamp: (): string => {
    return new Date().toISOString();
  },
};
