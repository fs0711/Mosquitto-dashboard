import { useState, useCallback, useRef, useEffect } from "react";
import { useWebSocket } from "../hooks/useWebSocket";

const LEVEL_COLORS = {
  error:   "text-red-600",
  warning: "text-yellow-600",
  notice:  "text-blue-600",
  info:    "text-gray-700",
  debug:   "text-gray-400",
};

const LEVELS = ["all", "error", "warning", "notice", "info", "debug"];

function classifyLine(line) {
  const lower = line.toLowerCase();
  if (lower.includes("error"))   return "error";
  if (lower.includes("warning")) return "warning";
  if (lower.includes("notice"))  return "notice";
  if (lower.includes("debug"))   return "debug";
  return "info";
}

export default function Logs() {
  const [lines, setLines] = useState([]);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [autoScroll, setAutoScroll] = useState(true);
  const bottomRef = useRef(null);
  const linesRef = useRef([]);

  const onMessage = useCallback((evt) => {
    try {
      const { type, data, source } = JSON.parse(evt.data);
      if (type !== "log") return;
      const entry = { text: data, level: classifyLine(data), source, id: Date.now() + Math.random() };
      linesRef.current = [...linesRef.current, entry].slice(-2000);
      setLines([...linesRef.current]);
    } catch { /* ignore */ }
  }, []);

  useWebSocket("/ws/logs", onMessage);

  useEffect(() => {
    if (autoScroll) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines, autoScroll]);

  const filtered = lines.filter(l => {
    if (filter !== "all" && l.level !== filter) return false;
    if (search && !l.text.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <h2 className="text-lg font-semibold text-gray-800">Broker Logs</h2>
        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">{lines.length} lines</span>
      </div>

      {/* Controls */}
      <div className="card p-3 flex flex-wrap gap-3 items-center">
        {/* Level filter */}
        <div className="flex gap-1">
          {LEVELS.map(level => (
            <button
              key={level}
              onClick={() => setFilter(level)}
              className={`px-2 py-0.5 text-xs rounded border transition-colors ${filter === level ? "bg-c-orange text-white border-c-orange" : "border-gray-200 text-gray-600 hover:border-gray-400"}`}
            >
              {level}
            </button>
          ))}
        </div>

        {/* Search */}
        <input
          type="text"
          placeholder="Search logs…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 min-w-40 text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-orange-300"
        />

        {/* Auto-scroll toggle */}
        <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer select-none">
          <input type="checkbox" checked={autoScroll} onChange={e => setAutoScroll(e.target.checked)} />
          Auto-scroll
        </label>

        {/* Clear */}
        <button
          onClick={() => { linesRef.current = []; setLines([]); }}
          className="text-xs border border-gray-200 rounded px-2 py-1 hover:bg-gray-50 text-gray-500"
        >
          Clear
        </button>
      </div>

      {/* Log output */}
      <div className="card overflow-hidden">
        <div className="h-[600px] overflow-y-auto font-mono text-xs p-4 bg-gray-950 space-y-0.5">
          {filtered.length === 0 && (
            <p className="text-gray-500">No log entries yet…</p>
          )}
          {filtered.map((l) => (
            <div key={l.id} className="flex gap-2">
              <span className={`shrink-0 ${LEVEL_COLORS[l.level] ?? LEVEL_COLORS.info}`}>
                {l.source === "mqtt" ? "[mqtt]" : "[file]"}
              </span>
              <span className={`${LEVEL_COLORS[l.level] ?? LEVEL_COLORS.info} break-all`}>{l.text}</span>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      </div>
    </div>
  );
}
