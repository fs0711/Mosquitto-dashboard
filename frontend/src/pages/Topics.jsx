import { useState, useCallback, useRef, useEffect } from "react";
import { useWebSocket } from "../hooks/useWebSocket";
import { fetchData } from "../utils";

// ──────────────────────────────────────────────────────────────────────
// Topic tree builder
// ──────────────────────────────────────────────────────────────────────

function setNestedPath(tree, parts, message) {
  let node = tree;
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (!node[part]) node[part] = { _messages: [], _children: {} };
    if (i === parts.length - 1) {
      // Keep last 20 messages per leaf
      node[part]._messages = [message, ...node[part]._messages].slice(0, 20);
    }
    node = node[part]._children;
  }
}

// ──────────────────────────────────────────────────────────────────────
// Tree node renderer
// ──────────────────────────────────────────────────────────────────────

function TreeNode({ name, node, path, selectedTopic, onSelect }) {
  const [expanded, setExpanded] = useState(true);
  const childKeys = Object.keys(node._children ?? {});
  const hasChildren = childKeys.length > 0;

  return (
    <div className="pl-3 border-l border-gray-200">
      <div
        className={`flex items-center gap-1 py-0.5 px-1 rounded cursor-pointer hover:bg-gray-100 text-sm ${selectedTopic === path ? "bg-orange-50 text-c-orange font-medium" : "text-gray-700"}`}
        onClick={() => { onSelect(path); if (hasChildren) setExpanded(e => !e); }}
      >
        {hasChildren && (
          <svg className={`w-3 h-3 transition-transform ${expanded ? "rotate-90" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        )}
        {!hasChildren && <span className="w-3" />}
        <span className="truncate">{name}</span>
        {node._messages?.length > 0 && (
          <span className="ml-auto text-xs text-gray-400">{node._messages.length}</span>
        )}
      </div>
      {expanded && hasChildren && childKeys.map(key => (
        <TreeNode
          key={key}
          name={key}
          node={node._children[key]}
          path={`${path}/${key}`}
          selectedTopic={selectedTopic}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Message row with expand/collapse for long payloads
// ──────────────────────────────────────────────────────────────────────

const PAYLOAD_TRUNCATE_LENGTH = 120;

function MessageRow({ m }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = m.payload.length > PAYLOAD_TRUNCATE_LENGTH;
  const displayed = expanded || !isLong ? m.payload : m.payload.slice(0, PAYLOAD_TRUNCATE_LENGTH) + "…";

  return (
    <div className="border-b border-gray-50 pb-1">
      <div className="flex gap-2">
        <span className="text-orange-500 shrink-0">{m.topic}</span>
        <span className="text-gray-600 break-all">{displayed}</span>
        {m.retain && <span className="text-blue-400 shrink-0">R</span>}
        <span className="text-gray-300 shrink-0">QoS{m.qos}</span>
      </div>
      {isLong && (
        <button
          onClick={() => setExpanded(e => !e)}
          className="text-orange-400 hover:text-orange-600 text-xs mt-0.5"
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Main Topics page
// ──────────────────────────────────────────────────────────────────────

export default function Topics() {
  const [tree, setTree] = useState({});           // topic tree
  const [messages, setMessages] = useState([]);   // flat feed (capped)
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [search, setSearch] = useState("");
  const [loadingHistory, setLoadingHistory] = useState(false);
  const treeRef = useRef({});
  const messagesRef = useRef([]);
  const liveTopicsRef = useRef(new Set()); // topics seen in this session

  const onMessage = useCallback((evt) => {
    try {
      const { type, data } = JSON.parse(evt.data);
      if (type !== "message") return;
      const parts = data.topic.split("/").filter(Boolean);
      if (!parts.length) return;

      // Track topics seen live so history isn't re-fetched for already-loaded ones
      liveTopicsRef.current.add(data.topic);

      // Update flat feed
      messagesRef.current = [data, ...messagesRef.current].slice(0, 500);

      // Update tree (clone needed to trigger re-render)
      const newTree = { ...treeRef.current };
      setNestedPath(newTree, data.topic.split("/"), data);
      treeRef.current = newTree;

      setMessages([...messagesRef.current]);
      setTree({ ...treeRef.current });
    } catch { /* non-JSON or malformed */ }
  }, []);

  useWebSocket("/ws/topics", onMessage);

  // Fetch stored history from Redis when a topic is selected and hasn't been seen live yet
  useEffect(() => {
    if (!selectedTopic) return;
    // If we already have live messages for this topic, history is already flowing in
    if (liveTopicsRef.current.has(selectedTopic)) return;

    let cancelled = false;
    setLoadingHistory(true);
    fetchData(`/api/v1/topics/history?topic=${encodeURIComponent(selectedTopic)}`)
      .then((history) => {
        if (cancelled || !history.length) return;
        // Merge history into flat feed and tree without duplicating live messages
        const newTree = { ...treeRef.current };
        const existing = new Set(messagesRef.current.map(m => m.topic + m.payload));
        const toAdd = history.filter(m => !existing.has(m.topic + m.payload));
        if (!toAdd.length) return;
        messagesRef.current = [...messagesRef.current, ...toAdd].slice(0, 500);
        for (const m of toAdd) {
          setNestedPath(newTree, m.topic.split("/"), m);
        }
        treeRef.current = newTree;
        setMessages([...messagesRef.current]);
        setTree({ ...treeRef.current });
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoadingHistory(false); });

    return () => { cancelled = true; };
  }, [selectedTopic]);

  const filteredMessages = messages.filter(m =>
    !selectedTopic || m.topic === selectedTopic || m.topic.startsWith(selectedTopic + "/")
  ).filter(m =>
    !search || m.topic.toLowerCase().includes(search.toLowerCase()) || m.payload.toLowerCase().includes(search.toLowerCase())
  );

  const rootKeys = Object.keys(tree);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h2 className="text-lg font-semibold text-gray-800">Topics</h2>
        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">{messages.length} messages</span>
      </div>

      <div className="flex gap-4 h-[600px]">
        {/* Tree panel */}
        <div className="card w-72 flex-shrink-0 overflow-y-auto p-3">
          <div className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Topic Tree</div>
          {rootKeys.length === 0 && (
            <p className="text-xs text-gray-400">Waiting for messages…</p>
          )}
          {rootKeys.map(key => (
            <TreeNode
              key={key}
              name={key}
              node={tree[key]}
              path={key}
              selectedTopic={selectedTopic}
              onSelect={(path) => setSelectedTopic(prev => prev === path ? null : path)}
            />
          ))}
        </div>

        {/* Message feed */}
        <div className="card flex-1 flex flex-col overflow-hidden">
          <div className="card-header flex items-center gap-3 py-3">
            {loadingHistory && <span className="text-xs text-gray-400 animate-pulse">Loading history…</span>}
            <input
              type="text"
              placeholder="Filter by topic or payload…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="flex-1 text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-orange-300"
            />
            {selectedTopic && (
              <button onClick={() => setSelectedTopic(null)} className="text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded px-2 py-1">
                Clear filter
              </button>
            )}
          </div>
          <div className="flex-1 overflow-y-auto font-mono text-xs p-3 space-y-1">
            {filteredMessages.length === 0 && (
              <p className="text-gray-400">No messages{selectedTopic ? ` for ${selectedTopic}` : ""}.</p>
            )}
            {filteredMessages.map((m, i) => (
              <MessageRow key={i} m={m} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
