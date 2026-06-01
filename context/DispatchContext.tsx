import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import { AppState, AppStateStatus } from 'react-native';

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
  reconnect: () => void;
  sendMessage: (command: string, payload?: any) => void;
  subscribe: (msgType: string, callback: (payload: any) => void) => () => void;
  error: string | null;
}

const DispatchContext = createContext<DispatchContextProps | undefined>(undefined);

// ─── Constants ────────────────────────────────────────────────────────────────
const PING_INTERVAL_MS    = 30_000; // send keepalive ping every 30s
const PONG_TIMEOUT_MS     = 10_000; // close if no pong within 10s
const RECONNECT_BASE_MS   = 2_000;  // first retry after 2s
const RECONNECT_MAX_MS    = 60_000; // cap at 60s
const RECONNECT_MAX_TRIES = 10;     // give up after 10 attempts

export const DispatchProvider = ({ children }: { children: ReactNode }) => {
  const [status, setStatus]       = useState<ConnectionStatus>('disconnected');
  const [pairingData, setPairingData] = useState<PairingData | null>(null);
  const [error, setError]         = useState<string | null>(null);

  const wsRef             = useRef<WebSocket | null>(null);
  const pairingRef        = useRef<PairingData | null>(null);
  const intentionalClose  = useRef(false);   // true when user explicitly disconnects
  const reconnectAttempt  = useRef(0);
  const reconnectTimer    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pingTimer         = useRef<ReturnType<typeof setInterval> | null>(null);
  const pongTimer         = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listeners         = useRef<{ [key: string]: ((payload: any) => void)[] }>({});

  const subscribe = useCallback((msgType: string, callback: (payload: any) => void) => {
    if (!listeners.current[msgType]) listeners.current[msgType] = [];
    listeners.current[msgType].push(callback);
    return () => {
      listeners.current[msgType] = listeners.current[msgType].filter(cb => cb !== callback);
    };
  }, []);

  // ── Cleanup helpers ───────────────────────────────────────────────────────

  const clearPing = () => {
    if (pingTimer.current)  { clearInterval(pingTimer.current);  pingTimer.current  = null; }
    if (pongTimer.current)  { clearTimeout(pongTimer.current);   pongTimer.current  = null; }
  };

  const clearReconnect = () => {
    if (reconnectTimer.current) { clearTimeout(reconnectTimer.current); reconnectTimer.current = null; }
  };

  // ── Keepalive ping ────────────────────────────────────────────────────────

  const startPing = useCallback((socket: WebSocket) => {
    clearPing();
    pingTimer.current = setInterval(() => {
      if (socket.readyState !== WebSocket.OPEN) return;
      socket.send(JSON.stringify({ command: 'ping' }));
      pongTimer.current = setTimeout(() => {
        console.warn('[Dispatch] Pong timeout — closing stale connection');
        socket.close();
      }, PONG_TIMEOUT_MS);
    }, PING_INTERVAL_MS);
  }, []);

  // ── Core connection ───────────────────────────────────────────────────────

  const establishConnection = useCallback((data: PairingData) => {
    if (wsRef.current) {
      wsRef.current.onclose = null; // prevent re-triggering onclose reconnect logic
      wsRef.current.close();
      wsRef.current = null;
    }
    clearPing();
    setStatus('connecting');
    setError(null);

    const socket = new WebSocket(`ws://${data.ip}:${data.port}`);
    wsRef.current = socket;

    socket.onopen = () => {
      socket.send(JSON.stringify({ auth: data.token }));
    };

    socket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);

        if (msg.status === 'authenticated') {
          setStatus('connected');
          reconnectAttempt.current = 0;
          startPing(socket);
          return;
        }

        if (msg.error === 'unauthorized') {
          setStatus('error');
          setError('Authentication failed. Scan the QR code again to re-pair.');
          intentionalClose.current = true; // don't retry with bad credentials
          socket.close();
          return;
        }

        // Pong from server
        if (msg.type === 'pong' || msg.command === 'pong') {
          if (pongTimer.current) { clearTimeout(pongTimer.current); pongTimer.current = null; }
          return;
        }

        // Fan out to subscribers
        if (msg.type) {
          (listeners.current[msg.type] ?? []).forEach(cb => cb(msg.payload));
        }
      } catch (e) {
        console.error('[Dispatch] Message parse error', e);
      }
    };

    socket.onerror = () => {
      setError("Can't reach the Mac. Check you're on the same Wi-Fi.");
      setStatus('error');
    };

    socket.onclose = () => {
      clearPing();
      wsRef.current = null;
      setStatus(prev => prev !== 'error' ? 'disconnected' : prev);

      if (intentionalClose.current) return;

      const savedData = pairingRef.current;
      if (!savedData) return;

      const attempt = reconnectAttempt.current;
      if (attempt >= RECONNECT_MAX_TRIES) {
        setError(`Lost connection after ${RECONNECT_MAX_TRIES} retries. Tap Reconnect to try again.`);
        setStatus('error');
        return;
      }

      const delay = Math.min(RECONNECT_BASE_MS * Math.pow(1.8, attempt), RECONNECT_MAX_MS);
      reconnectAttempt.current = attempt + 1;
      console.log(`[Dispatch] Reconnect in ${Math.round(delay / 1000)}s (attempt ${attempt + 1})`);
      reconnectTimer.current = setTimeout(() => {
        if (!intentionalClose.current && pairingRef.current) {
          establishConnection(pairingRef.current);
        }
      }, delay);
    };
  }, [startPing]);

  // ── Load saved pairing on boot ────────────────────────────────────────────

  useEffect(() => {
    SecureStore.getItemAsync('canopy_pairing_data').then(saved => {
      if (!saved) return;
      try {
        const parsed: PairingData = JSON.parse(saved);
        pairingRef.current = parsed;
        setPairingData(parsed);
        intentionalClose.current = false;
        reconnectAttempt.current = 0;
        establishConnection(parsed);
      } catch {
        SecureStore.deleteItemAsync('canopy_pairing_data');
      }
    });

    return () => {
      clearPing();
      clearReconnect();
      intentionalClose.current = true;
      wsRef.current?.close();
    };
  }, [establishConnection]);

  // ── Reconnect on foreground ───────────────────────────────────────────────
  // iOS suspends network when app goes to background, killing WebSocket.
  // When the app comes back to the foreground, re-establish the connection.

  useEffect(() => {
    const handleAppState = (nextState: AppStateStatus) => {
      if (nextState === 'active' && pairingRef.current && !intentionalClose.current) {
        const ws = wsRef.current;
        if (ws?.readyState === WebSocket.OPEN || ws?.readyState === WebSocket.CONNECTING) return;
        console.log('[Dispatch] Foregrounded — reconnecting');
        clearReconnect();
        reconnectAttempt.current = 0;
        establishConnection(pairingRef.current);
      }
    };
    const sub = AppState.addEventListener('change', handleAppState);
    return () => sub.remove();
  }, [establishConnection]);

  // ── Public API ────────────────────────────────────────────────────────────

  const connect = async (data: PairingData) => {
    await SecureStore.setItemAsync('canopy_pairing_data', JSON.stringify(data));
    pairingRef.current = data;
    setPairingData(data);
    intentionalClose.current = false;
    reconnectAttempt.current = 0;
    clearReconnect();
    establishConnection(data);
  };

  const disconnect = async () => {
    intentionalClose.current = true;
    clearPing();
    clearReconnect();
    await SecureStore.deleteItemAsync('canopy_pairing_data');
    pairingRef.current = null;
    setPairingData(null);
    wsRef.current?.close();
    wsRef.current = null;
    setStatus('disconnected');
    setError(null);
    reconnectAttempt.current = 0;
  };

  const reconnect = useCallback(() => {
    if (!pairingRef.current) return;
    clearReconnect();
    setError(null);
    reconnectAttempt.current = 0;
    intentionalClose.current = false;
    establishConnection(pairingRef.current);
  }, [establishConnection]);

  const sendMessage = useCallback((command: string, payload: any = {}) => {
    if (wsRef.current?.readyState === WebSocket.OPEN && status === 'connected') {
      wsRef.current.send(JSON.stringify({ command, payload }));
    } else {
      console.warn('[Dispatch] Cannot send — not connected');
    }
  }, [status]);

  return (
    <DispatchContext.Provider value={{
      status, pairingData,
      connect, disconnect, reconnect,
      sendMessage, subscribe,
      error,
    }}>
      {children}
    </DispatchContext.Provider>
  );
};

export const useDispatch = () => {
  const ctx = useContext(DispatchContext);
  if (!ctx) throw new Error('useDispatch must be used within a DispatchProvider');
  return ctx;
};
