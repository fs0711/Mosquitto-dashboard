import { useEffect, useRef, useCallback } from "react";

/**
 * Auto-reconnecting WebSocket hook.
 * @param {string} url  WebSocket URL (e.g. "/ws/topics")
 * @param {(msg: MessageEvent) => void} onMessage  Called for each incoming message
 * @param {boolean} enabled  Set false to disable connection
 */
export function useWebSocket(url, onMessage, enabled = true) {
  const wsRef = useRef(null);
  const onMessageRef = useRef(onMessage);
  const reconnectTimer = useRef(null);
  const unmounted = useRef(false);

  // Keep callback ref current without re-triggering effect
  useEffect(() => { onMessageRef.current = onMessage; }, [onMessage]);

  const connect = useCallback(() => {
    if (unmounted.current || !enabled) return;
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}${url}`);
    wsRef.current = ws;

    ws.onmessage = (evt) => onMessageRef.current?.(evt);

    ws.onclose = () => {
      if (!unmounted.current && enabled) {
        reconnectTimer.current = setTimeout(connect, 3000);
      }
    };

    ws.onerror = () => ws.close();
  }, [url, enabled]);

  useEffect(() => {
    unmounted.current = false;
    if (enabled) connect();
    return () => {
      unmounted.current = true;
      clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect, enabled]);
}
