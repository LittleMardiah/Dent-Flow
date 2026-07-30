'use client';

import { useState, useCallback, useRef } from 'react';
import { aiChatApi, ChatMessage } from '@/lib/api/aiChat';

export function useAIChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim()) return;

    // Add user message
    const userMessage: ChatMessage = {
      id: aiChatApi.generateId(),
      role: 'user',
      content: content.trim(),
      timestamp: aiChatApi.getTimestamp(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);
    setError(null);

    try {
      // Get last 10 messages for context
      const history = messages.slice(-10);
      
      const response = await aiChatApi.sendMessage(content, history);
      
      const assistantMessage: ChatMessage = {
        id: aiChatApi.generateId(),
        role: 'assistant',
        content: response.message,
        timestamp: aiChatApi.getTimestamp(),
      };
      
      setMessages((prev) => [...prev, assistantMessage]);
      
      // Handle suggested actions if any
      if (response.suggestedActions && response.suggestedActions.length > 0) {
        // Add a special message with actions
        const actionMessage: ChatMessage = {
          id: aiChatApi.generateId(),
          role: 'assistant',
          content: '💡 ' + response.suggestedActions.map(a => `[${a.label}]`).join(' '),
          timestamp: aiChatApi.getTimestamp(),
        };
        setMessages((prev) => [...prev, actionMessage]);
      }
    } catch (err: any) {
      setError(err.message || 'Gagal mendapatkan respons dari AI');
      
      // Add fallback message
      const fallbackMessage: ChatMessage = {
        id: aiChatApi.generateId(),
        role: 'assistant',
        content: 'Maaf, saya sedang mengalami gangguan. Silakan hubungi admin klinik untuk bantuan lebih lanjut.',
        timestamp: aiChatApi.getTimestamp(),
      };
      setMessages((prev) => [...prev, fallbackMessage]);
    } finally {
      setIsLoading(false);
    }
  }, [messages]);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  const toggleOpen = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  const open = useCallback(() => {
    setIsOpen(true);
  }, []);

  return {
    messages,
    isLoading,
    error,
    isOpen,
    sendMessage,
    clearMessages,
    toggleOpen,
    close,
    open,
    messagesEndRef,
  };
}
