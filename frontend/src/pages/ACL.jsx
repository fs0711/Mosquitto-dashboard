import { useState, useEffect } from "react";
import { fetchData } from "../utils";

async function apiRequest(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(typeof err.detail === "string" ? err.detail : JSON.stringify(err.detail));
  }
  return res.json();
}

const ACL_HELP = `# Mosquitto ACL file format
#
# user <username>
# topic [read|write|readwrite] <topicpattern>
#
# pattern [read|write|readwrite] <topicpattern>
#   Patterns may contain %u (username) and %c (client id)
#
# Examples:
# user alice
# topic readwrite sensors/#
#
# pattern readwrite clients/%c/telemetry`;

export default function ACL() {
  const [content, setContent] = useState("");
  const [original, setOriginal] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function load() {
    try {
      setLoading(true);
      const d = await fetchData("/api/v1/acl");
      setContent(d.content);
      setOriginal(d.content);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await apiRequest("PUT", "/api/v1/acl", { content });
      setOriginal(content);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  const dirty = content !== original;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-800">ACL File</h2>
        <div className="flex gap-2 items-center">
          {dirty && <span className="text-xs text-yellow-600">Unsaved changes</span>}
          {saved && <span className="text-xs text-green-600">Saved!</span>}
          <button onClick={() => { setContent(original); }} disabled={!dirty} className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-40">
            Revert
          </button>
          <button onClick={handleSave} disabled={saving || !dirty} className="px-3 py-1.5 text-sm bg-c-orange text-white rounded hover:bg-orange-700 disabled:opacity-50">
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-200 rounded p-3 text-red-700 text-sm">{error}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Editor */}
        <div className="lg:col-span-2 card overflow-hidden">
          {loading ? (
            <p className="p-6 text-sm text-gray-500">Loading…</p>
          ) : (
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              spellCheck={false}
              className="w-full h-[500px] font-mono text-xs p-4 resize-none focus:outline-none bg-gray-950 text-green-400"
              placeholder={ACL_HELP}
            />
          )}
        </div>

        {/* Reference */}
        <div className="card p-4 text-xs text-gray-600 space-y-3">
          <h3 className="font-semibold text-gray-800 text-sm">ACL Format Reference</h3>
          <div>
            <p className="font-medium text-gray-700 mb-1">User block</p>
            <pre className="bg-gray-50 rounded p-2 text-xs">{"user <username>\ntopic [read|write|readwrite] <pattern>"}</pre>
          </div>
          <div>
            <p className="font-medium text-gray-700 mb-1">Pattern substitutions</p>
            <p><code>%u</code> — username</p>
            <p><code>%c</code> — client ID</p>
          </div>
          <div>
            <p className="font-medium text-gray-700 mb-1">Topic wildcards</p>
            <p><code>#</code> — all sub-levels</p>
            <p><code>+</code> — single level</p>
          </div>
          <div>
            <p className="font-medium text-gray-700 mb-1">Access types</p>
            <p><code>read</code> — subscribe only</p>
            <p><code>write</code> — publish only</p>
            <p><code>readwrite</code> — both</p>
          </div>
        </div>
      </div>
    </div>
  );
}
