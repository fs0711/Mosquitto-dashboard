import { useState, useEffect, useCallback } from "react";
import { fetchData } from "../utils";

async function apiRequest(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw err;
  }
  return res.json();
}

export default function Config() {
  const [content, setContent] = useState("");
  const [original, setOriginal] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState(null); // { ok, message }

  const [validating, setValidating] = useState(false);
  const [validateResult, setValidateResult] = useState(null); // { valid, output }

  const [backups, setBackups] = useState([]);
  const [backupsLoading, setBackupsLoading] = useState(false);
  const [restoring, setRestoring] = useState(null);

  const [reloading, setReloading] = useState(false);
  const [reloadResult, setReloadResult] = useState(null);

  async function loadConfig() {
    try {
      setLoading(true);
      setError(null);
      const d = await fetchData("/api/v1/config");
      setContent(d.content);
      setOriginal(d.content);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadBackups() {
    setBackupsLoading(true);
    try {
      const d = await fetchData("/api/v1/config/backups");
      setBackups(d.backups || []);
    } catch {
      setBackups([]);
    } finally {
      setBackupsLoading(false);
    }
  }

  useEffect(() => {
    loadConfig();
    loadBackups();
  }, []);

  async function handleValidate() {
    setValidating(true);
    setValidateResult(null);
    try {
      const d = await apiRequest("POST", "/api/v1/config/validate", { content });
      setValidateResult({ valid: d.valid, output: d.output || "" });
    } catch (e) {
      setValidateResult({ valid: false, output: JSON.stringify(e) });
    } finally {
      setValidating(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setSaveResult(null);
    setValidateResult(null);
    try {
      const d = await apiRequest("PUT", "/api/v1/config", { content });
      setOriginal(content);
      setSaveResult({ ok: true, message: `Saved. Backup: ${d.backup || "none"}` });
      await loadBackups();
    } catch (e) {
      // 422 shape: { detail: { message, output } }
      const detail = e?.detail;
      if (detail && typeof detail === "object") {
        setValidateResult({ valid: false, output: detail.output || detail.message || JSON.stringify(detail) });
        setSaveResult({ ok: false, message: detail.message || "Validation failed — config was NOT saved." });
      } else {
        setSaveResult({ ok: false, message: typeof e === "string" ? e : JSON.stringify(e) });
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleRestore(filename) {
    if (!window.confirm(`Restore backup ${filename}? This will overwrite the current config.`)) return;
    setRestoring(filename);
    try {
      await apiRequest("POST", `/api/v1/config/restore/${encodeURIComponent(filename)}`);
      await loadConfig();
      await loadBackups();
    } catch (e) {
      setError(typeof e?.detail === "string" ? e.detail : JSON.stringify(e));
    } finally {
      setRestoring(null);
    }
  }

  async function handleReload() {
    setReloading(true);
    setReloadResult(null);
    try {
      await apiRequest("POST", "/api/v1/broker/reload");
      setReloadResult({ ok: true, message: "Broker reloaded successfully." });
    } catch (e) {
      const msg = typeof e?.detail === "string" ? e.detail : JSON.stringify(e);
      setReloadResult({ ok: false, message: msg });
    } finally {
      setReloading(false);
    }
  }

  const dirty = content !== original;

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-gray-800">Mosquitto Configuration</h2>
        <div className="flex flex-wrap gap-2 items-center">
          {dirty && <span className="text-xs text-yellow-600">Unsaved changes</span>}
          <button onClick={() => { setContent(original); setSaveResult(null); setValidateResult(null); }} disabled={!dirty} className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-40">
            Revert
          </button>
          <button onClick={handleValidate} disabled={validating} className="px-3 py-1.5 text-sm border border-blue-300 text-blue-700 rounded hover:bg-blue-50 disabled:opacity-50">
            {validating ? "Validating…" : "Validate"}
          </button>
          <button onClick={handleSave} disabled={saving || !dirty} className="px-3 py-1.5 text-sm bg-c-orange text-white rounded hover:bg-orange-700 disabled:opacity-50">
            {saving ? "Saving…" : "Save"}
          </button>
          <button onClick={handleReload} disabled={reloading} className="px-3 py-1.5 text-sm bg-gray-800 text-white rounded hover:bg-gray-700 disabled:opacity-50">
            {reloading ? "Reloading…" : "Reload Broker"}
          </button>
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-200 rounded p-3 text-red-700 text-sm">{error}</div>}

      {saveResult && (
        <div className={`rounded p-3 text-sm ${saveResult.ok ? "bg-green-50 border border-green-200 text-green-700" : "bg-red-50 border border-red-200 text-red-700"}`}>
          {saveResult.message}
        </div>
      )}

      {reloadResult && (
        <div className={`rounded p-3 text-sm ${reloadResult.ok ? "bg-green-50 border border-green-200 text-green-700" : "bg-red-50 border border-red-200 text-red-700"}`}>
          {reloadResult.message}
        </div>
      )}

      {/* Validation output */}
      {validateResult && (
        <div className={`rounded p-3 text-xs font-mono whitespace-pre-wrap ${validateResult.valid ? "bg-green-950 text-green-400" : "bg-red-950 text-red-400"}`}>
          <span className="font-bold">{validateResult.valid ? "✓ Valid" : "✗ Invalid"}:</span>{"\n"}{validateResult.output || (validateResult.valid ? "Configuration is valid." : "Validation failed.")}
        </div>
      )}

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
              className="w-full h-[540px] font-mono text-xs p-4 resize-none focus:outline-none bg-gray-950 text-green-400"
            />
          )}
        </div>

        {/* Backups */}
        <div className="card p-4 space-y-3">
          <h3 className="font-semibold text-gray-800 text-sm">Config Backups</h3>
          {backupsLoading ? (
            <p className="text-xs text-gray-400">Loading…</p>
          ) : backups.length === 0 ? (
            <p className="text-xs text-gray-400">No backups yet.</p>
          ) : (
            <ul className="space-y-2">
              {backups.map(b => (
                <li key={b.filename} className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-mono text-gray-700 truncate max-w-[140px]" title={b.filename}>{b.filename}</p>
                    {b.created_at && <p className="text-xs text-gray-400">{new Date(b.created_at).toLocaleString()}</p>}
                  </div>
                  <button onClick={() => handleRestore(b.filename)} disabled={restoring === b.filename} className="text-xs text-c-orange hover:text-orange-700 disabled:opacity-50 ml-2">
                    {restoring === b.filename ? "…" : "Restore"}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
