'use client';

import React, { useState, useEffect } from 'react';
import { useWebSocketContext } from '@/context/WebSocketContext';
import { Wifi, WifiOff, Loader2 } from 'lucide-react';

interface ConnectionStatusProps {
  showLabel?: boolean;
  className?: string;
}

export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({
  showLabel = true,
  className = '',
}) => {
  const { isConnected } = useWebSocketContext();
  const [isConnecting, setIsConnecting] = useState(true);

  useEffect(() => {
    // After 2 seconds, assume connection is established or failed
    const timer = setTimeout(() => {
      setIsConnecting(false);
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  if (isConnecting) {
    return (
      <div className={`flex items-center gap-2 text-gray-400 ${className}`}>
        <Loader2 size={16} className="animate-spin" />
        {showLabel && <span className="text-xs">Menghubungkan...</span>}
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {isConnected ? (
        <>
          <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
          {showLabel && (
            <span className="text-xs text-green-600 font-medium">Live</span>
          )}
        </>
      ) : (
        <>
          <div className="w-2.5 h-2.5 rounded-full bg-gray-400" />
          {showLabel && (
            <span className="text-xs text-gray-500">Offline</span>
          )}
        </>
      )}
    </div>
  );
};
