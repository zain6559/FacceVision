/**
 * FaceVision — Real-Time Updates Manager
 * 
 * Provides real-time updates via WebSocket or Server-Sent Events:
 * - Recognition progress updates
 * - New identities added
 * - System health alerts
 * - Queue status updates
 * - Live statistics
 */

import { useCallback, useEffect, useRef, useState } from 'react';

// ─── Event Types ────────────────────────────────────────────────────────────────

export type RealtimeEventType =
  | 'RECOGNITION_PROGRESS'
  | 'RECOGNITION_COMPLETE'
  | 'IDENTITY_ADDED'
  | 'IDENTITY_UPDATED'
  | 'COLLECTION_UPDATED'
  | 'SYSTEM_ALERT'
  | 'QUEUE_STATUS'
  | 'STATS_UPDATE'
  | 'MODEL_STATUS';

export interface RealtimeEvent<T = unknown> {
  type: RealtimeEventType;
  payload: T;
  timestamp: Date;
  source?: string;
}

// ─── Event Payloads ─────────────────────────────────────────────────────────────

export interface RecognitionProgressPayload {
  sessionId: string;
  progress: number;
  status: 'uploading' | 'detecting' | 'extracting' | 'searching' | 'completed';
  message?: string;
}

export interface RecognitionResultPayload {
  sessionId: string;
  results: Array<{
    identityId: number;
    name: string;
    confidence: number;
    decision: string;
    thumbnail?: string;
  }>;
}

export interface SystemAlertPayload {
  severity: 'info' | 'warning' | 'error' | 'critical';
  title: string;
  message: string;
  source: string;
  actionRequired?: boolean;
}

export interface QueueStatusPayload {
  pendingJobs: number;
  processingJobs: number;
  completedJobs: number;
  failedJobs: number;
  avgWaitTime: number;
}

export interface StatsUpdatePayload {
  totalRecognitions: number;
  avgConfidence: number;
  avgLatencyMs: number;
  recognitionRate: number;
}

// ─── WebSocket Manager ─────────────────────────────────────────────────────────

class RealtimeWebSocket {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private listeners: Map<RealtimeEventType, Set<(event: RealtimeEvent) => void>> = new Map();
  private connectionListeners: Set<(connected: boolean) => void> = new Set();
  private isConnecting = false;

  constructor(private url: string) {}

  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN || this.isConnecting) {
      return;
    }

    this.isConnecting = true;

    try {
      this.ws = new WebSocket(this.url);
      
      this.ws.onopen = () => {
        console.log('[WebSocket] Connected');
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.notifyConnectionListeners(true);
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as RealtimeEvent;
          data.timestamp = new Date(data.timestamp);
          this.notifyListeners(data);
        } catch (error) {
          console.error('[WebSocket] Failed to parse message:', error);
        }
      };

      this.ws.onclose = () => {
        console.log('[WebSocket] Disconnected');
        this.isConnecting = false;
        this.notifyConnectionListeners(false);
        this.attemptReconnect();
      };

      this.ws.onerror = (error) => {
        console.error('[WebSocket] Error:', error);
        this.isConnecting = false;
      };
    } catch (error) {
      console.error('[WebSocket] Connection failed:', error);
      this.isConnecting = false;
      this.attemptReconnect();
    }
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('[WebSocket] Max reconnect attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    
    console.log(`[WebSocket] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
    
    setTimeout(() => this.connect(), delay);
  }

  subscribe(eventType: RealtimeEventType, callback: (event: RealtimeEvent) => void): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType)!.add(callback);

    return () => {
      this.listeners.get(eventType)?.delete(callback);
    };
  }

  subscribeAll(callback: (event: RealtimeEvent) => void): () => void {
    const wrapper = (event: RealtimeEvent) => callback(event);
    
    for (const eventType of this.listeners.keys()) {
      if (!this.listeners.has(eventType)) {
        this.listeners.set(eventType, new Set());
      }
      this.listeners.get(eventType)!.add(wrapper);
    }

    return () => {
      for (const listeners of this.listeners.values()) {
        listeners.delete(wrapper);
      }
    };
  }

  onConnectionChange(callback: (connected: boolean) => void): () => void {
    this.connectionListeners.add(callback);
    return () => {
      this.connectionListeners.delete(callback);
    };
  }

  send(event: { type: string; payload?: unknown }): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(event));
    }
  }

  private notifyListeners(event: RealtimeEvent): void {
    const listeners = this.listeners.get(event.type);
    if (listeners) {
      listeners.forEach((callback) => callback(event));
    }
  }

  private notifyConnectionListeners(connected: boolean): void {
    this.connectionListeners.forEach((callback) => callback(connected));
  }

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

// ─── Singleton Instance ─────────────────────────────────────────────────────────

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3001/ws';

export const realtimeManager = new RealtimeWebSocket(WS_URL);

// ─── React Hooks ───────────────────────────────────────────────────────────────

/**
 * Hook to connect to realtime updates.
 */
export function useRealtime() {
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    realtimeManager.connect();

    const unsubscribe = realtimeManager.onConnectionChange(setIsConnected);

    return () => {
      unsubscribe();
    };
  }, []);

  return { isConnected, manager: realtimeManager };
}

/**
 * Hook to subscribe to specific event types.
 */
export function useRealtimeEvent<T>(
  eventType: RealtimeEventType,
  callback: (payload: T) => void
) {
  useEffect(() => {
    const unsubscribe = realtimeManager.subscribe(eventType, (event) => {
      callback(event.payload as T);
    });

    return unsubscribe;
  }, [eventType, callback]);
}

/**
 * Hook for recognition progress updates.
 */
export function useRecognitionProgress(sessionId: string, onProgress: (progress: RecognitionProgressPayload) => void) {
  useRealtimeEvent<RecognitionProgressPayload>('RECOGNITION_PROGRESS', (payload) => {
    if (payload.sessionId === sessionId) {
      onProgress(payload);
    }
  });
}

/**
 * Hook for system alerts.
 */
export function useSystemAlerts(onAlert: (alert: SystemAlertPayload) => void) {
  useRealtimeEvent<SystemAlertPayload>('SYSTEM_ALERT', onAlert);
}

/**
 * Hook for queue status updates.
 */
export function useQueueStatus(onUpdate: (status: QueueStatusPayload) => void) {
  useRealtimeEvent<QueueStatusPayload>('QUEUE_STATUS', onUpdate);
}

/**
 * Hook for live statistics.
 */
export function useLiveStats(onUpdate: (stats: StatsUpdatePayload) => void) {
  useRealtimeEvent<StatsUpdatePayload>('STATS_UPDATE', onUpdate);
}

/**
 * Hook for connection status.
 */
export function useConnectionStatus() {
  const [isConnected, setIsConnected] = useState(false);
  const [lastConnected, setLastConnected] = useState<Date | null>(null);

  useEffect(() => {
    const unsubscribe = realtimeManager.onConnectionChange((connected) => {
      setIsConnected(connected);
      if (connected) {
        setLastConnected(new Date());
      }
    });

    return unsubscribe;
  }, []);

  return { isConnected, lastConnected };
}
