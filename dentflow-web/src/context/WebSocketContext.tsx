'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getWebSocketService } from '@/lib/websocket';
import { useAuth } from './AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { AuthService } from '@/services/authService';

interface WebSocketContextType {
  isConnected: boolean;
  connect: () => void;
  disconnect: () => void;
  on: (event: string, callback: (data: any) => void) => () => void;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

export const WebSocketProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const [isConnected, setIsConnected] = useState(false);
  const wsService = getWebSocketService(queryClient);

  useEffect(() => {
    const unsubscribe = wsService.on('connect', () => {
      setIsConnected(true);
    });
    const unsubscribeDisconnect = wsService.on('disconnect', () => {
      setIsConnected(false);
    });

    return () => {
      unsubscribe();
      unsubscribeDisconnect();
    };
  }, [wsService]);

  const connect = () => {
    if (isAuthenticated) {
      const token = AuthService.getToken();
      if (token) {
        wsService.connect(token);
      }
    }
  };

  const disconnect = () => {
    wsService.disconnect();
    setIsConnected(false);
  };

  useEffect(() => {
    if (isAuthenticated) {
      connect();
    } else {
      disconnect();
    }
  }, [isAuthenticated]);

  const on = (event: string, callback: (data: any) => void) => {
    return wsService.on(event as any, callback);
  };

  return (
    <WebSocketContext.Provider value={{ isConnected, connect, disconnect, on }}>
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocketContext = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocketContext must be used within WebSocketProvider');
  }
  return context;
};
