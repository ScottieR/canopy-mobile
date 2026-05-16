import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface PairingData {
  token: string;
  ip: string;
  port: number;
}

interface DispatchContextProps {
  status: ConnectionStatus;
  pairingData: PairingData | null;
  connect: (data: PairingData) => Promise<void>;
  disconnect: () => Promise<void>;
  sendMessage: (command: string, payload?: any) => void;
  subscribe: (msgType: string, callback: (payload: any) => void) => () => void;
  error: string | null;
}

const DispatchContext = createContext<DispatchContextProps | undefined>(undefined);

export const DispatchProvider = ({ children }: { children: ReactNode }) => {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [pairingData, setPairingData] = useState<PairingData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ws, setWs] = useState<WebSocket | null>(null);

  // Simple event bus
  const listeners = React.useRef<{ [key: string]: ((payload: any) => void)[] }>({});

  const subscribe = useCallback((msgType: string, callback: (payload: any) => void) => {
    if (!listeners.current[msgType]) listeners.current[msgType] = [];
    listeners.current[msgType].push(callback);
    return () => {
      listeners.current[msgType] = listeners.current[msgType].filter(cb => cb !== callback);
    };
  }, []);

  useEffect(() => {
    // Check for saved pairing data on boot
    const loadSavedData = async () => {
      try {
        const saved = await SecureStore.getItemAsync('canopy_pairing_data');
        if (saved) {
          const parsed = JSON.parse(saved);
          setPairingData(parsed);
          establishConnection(parsed);
        }
      } catch (e) {
        console.error("Failed to load saved pairing data", e);
      }
    };
    loadSavedData();
  }, []);

  const establishConnection = useCallback((data: PairingData) => {
    setStatus('connecting');
    setError(null);
    
    // Connect over local network
    const socket = new WebSocket(`ws://${data.ip}:${data.port}`);

    socket.onopen = () => {
      // First message MUST be authentication
      socket.send(JSON.stringify({ auth: data.token }));
    };

    socket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.status === 'authenticated') {
          setStatus('connected');
        } else if (msg.error === 'unauthorized') {
          setStatus('error');
          setError('Authentication failed. Invalid token.');
          socket.close();
          disconnect(); // Clear invalid data
        } else {
          // Handle incoming RPC messages (e.g., chat updates)
          if (msg.type) {
            const callbacks = listeners.current[msg.type];
            if (callbacks) {
              callbacks.forEach(cb => cb(msg.payload));
            }
          }
        }
      } catch (e) {
        console.error("Failed to parse message", e);
      }
    };

    socket.onerror = (e) => {
      setStatus('error');
      setError('Connection error. Is the Mac on the same Wi-Fi network?');
    };

    socket.onclose = () => {
      // Ensure we don't overwrite explicit error state
      setStatus((prev) => prev !== 'error' ? 'disconnected' : prev);
      setWs(null);
    };

    setWs(socket);
  }, []);

  const connect = async (data: PairingData) => {
    await SecureStore.setItemAsync('canopy_pairing_data', JSON.stringify(data));
    setPairingData(data);
    establishConnection(data);
  };

  const disconnect = async () => {
    await SecureStore.deleteItemAsync('canopy_pairing_data');
    setPairingData(null);
    if (ws) {
      ws.close();
    }
    setStatus('disconnected');
  };

  const sendMessage = (command: string, payload: any = {}) => {
    if (ws && ws.readyState === WebSocket.OPEN && status === 'connected') {
      ws.send(JSON.stringify({ command, payload }));
    } else {
      console.warn("Cannot send message: WebSocket is not connected");
    }
  };

  return (
    <DispatchContext.Provider value={{ status, pairingData, connect, disconnect, sendMessage, subscribe, error }}>
      {children}
    </DispatchContext.Provider>
  );
};

export const useDispatch = () => {
  const context = useContext(DispatchContext);
  if (context === undefined) {
    throw new Error('useDispatch must be used within a DispatchProvider');
  }
  return context;
};
