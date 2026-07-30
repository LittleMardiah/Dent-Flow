'use client';

import React, { useEffect, useRef } from 'react';
import { useAIChat } from '@/hooks/useAIChat';
import { useAuth } from '@/context/AuthContext';
import { Send, X, Minimize2, Maximize2, MessageCircle, Loader2, Bot } from 'lucide-react';

interface AIChatWidgetProps {
  className?: string;
}

export const AIChatWidget: React.FC<AIChatWidgetProps> = ({ className = '' }) => {
  const { isAuthenticated } = useAuth();
  const {
    messages,
    isLoading,
    error,
    isOpen,
    sendMessage,
    toggleOpen,
    close,
    messagesEndRef,
  } = useAIChat();

  const [input, setInput] = React.useState('');
  const [isMinimized, setIsMinimized] = React.useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus input when chat opens
  useEffect(() => {
    if (isOpen && !isMinimized) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, isMinimized]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Only show for authenticated users
  if (!isAuthenticated) return null;

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    const message = input.trim();
    setInput('');
    await sendMessage(message);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(e);
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={toggleOpen}
        className={`fixed bottom-6 right-6 z-50 p-4 bg-primary text-white rounded-full shadow-lg hover:bg-primary-dark transition-all hover:scale-105 ${className}`}
        aria-label="Buka Chat AI"
      >
        <MessageCircle size={24} />
      </button>
    );
  }

  return (
    <div className={`fixed bottom-6 right-6 z-50 w-96 max-w-[calc(100vw-2rem)] bg-white rounded-xl shadow-2xl border border-neutral overflow-hidden transition-all ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-primary text-white">
        <div className="flex items-center gap-2">
          <Bot size={18} />
          <span className="font-medium">AI Assistant</span>
          <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">Beta</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1 hover:bg-white/20 rounded-lg transition-colors"
            aria-label={isMinimized ? 'Expand' : 'Minimize'}
          >
            {isMinimized ? <Maximize2 size={16} /> : <Minimize2 size={16} />}
          </button>
          <button
            onClick={close}
            className="p-1 hover:bg-white/20 rounded-lg transition-colors"
            aria-label="Tutup Chat"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {!isMinimized && (
        <>
          {/* Messages */}
          <div className="h-80 overflow-y-auto p-4 space-y-3 bg-neutral/30">
            {messages.length === 0 ? (
              <div className="text-center text-gray-400 text-sm mt-8">
                <Bot size={32} className="mx-auto text-primary/50 mb-2" />
                <p>Halo! Saya asisten AI DentFlow.</p>
                <p className="text-xs mt-1">Tanyakan tentang jadwal, invoice, atau kesehatan gigi Anda.</p>
                <div className="flex flex-wrap justify-center gap-2 mt-4">
                  <button
                    onClick={() => sendMessage("Kapan janji temu saya berikutnya?")}
                    className="text-xs bg-primary/10 text-primary px-3 py-1.5 rounded-full hover:bg-primary/20 transition-colors"
                  >
                    📅 Janji temu berikutnya
                  </button>
                  <button
                    onClick={() => sendMessage("Berapa total tagihan saya?")}
                    className="text-xs bg-primary/10 text-primary px-3 py-1.5 rounded-full hover:bg-primary/20 transition-colors"
                  >
                    💰 Tagihan saya
                  </button>
                  <button
                    onClick={() => sendMessage("Bagaimana cara scaling gigi?")}
                    className="text-xs bg-primary/10 text-primary px-3 py-1.5 rounded-full hover:bg-primary/20 transition-colors"
                  >
                    🦷 Info scaling
                  </button>
                </div>
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm ${
                      msg.role === 'user'
                        ? 'bg-primary text-white rounded-tr-none'
                        : 'bg-white text-gray-800 rounded-tl-none shadow-sm border border-neutral'
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              ))
            )}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white text-gray-800 px-4 py-2.5 rounded-2xl rounded-tl-none shadow-sm border border-neutral">
                  <div className="flex items-center gap-1">
                    <Loader2 size={14} className="animate-spin text-primary" />
                    <span className="text-xs text-gray-400">Mengetik...</span>
                  </div>
                </div>
              </div>
            )}
            {error && (
              <div className="flex justify-center">
                <div className="bg-red-50 text-red-600 text-xs px-3 py-2 rounded-lg">
                  ⚠️ {error}
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <form onSubmit={handleSend} className="flex items-center gap-2 p-3 border-t border-neutral">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Tanyakan sesuatu..."
              className="flex-1 px-4 py-2 border border-neutral rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none text-sm"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="p-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Kirim pesan"
            >
              <Send size={16} />
            </button>
          </form>
        </>
      )}
    </div>
  );
};
