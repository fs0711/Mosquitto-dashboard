import { useState, useEffect, useRef } from "react";
import { fetchData } from "../utils";
import { SYSTOPIC_ENDPOINT, INTERVAL_5SECS_IN_MILLISECONDS } from "../consts";

export function useSysTree() {
  const [data, setData] = useState({});
  const [online, setOnline] = useState(null);
  const timerRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const result = await fetchData(SYSTOPIC_ENDPOINT, { cache: "no-store" });
        if (!cancelled) {
          setData(result);
          setOnline(true);
        }
      } catch {
        if (!cancelled) setOnline(false);
      }
      if (!cancelled) {
        timerRef.current = setTimeout(poll, INTERVAL_5SECS_IN_MILLISECONDS);
      }
    }

    poll();
    return () => {
      cancelled = true;
      clearTimeout(timerRef.current);
    };
  }, []);

  return { data, online };
}
