import { useState, useEffect, useRef } from "react";
import { fetchData } from "../utils";

const ALLOWED_EXTS = [".pem", ".crt", ".cer", ".key"];
const MAX_SIZE_KB = 512;

function expiryBadge(expiryStr) {
  if (!expiryStr) return null;
  const expiry = new Date(expiryStr);
  const now = new Date();
  const daysLeft = Math.floor((expiry - now) / 86400000);
  if (daysLeft < 0)
    return <span className="ml-2 px-1.5 py-0.5 text-xs bg-red-100 text-red-700 rounded-full font-medium">Expired</span>;
  if (daysLeft <= 30)
    return <span className="ml-2 px-1.5 py-0.5 text-xs bg-yellow-100 text-yellow-700 rounded-full font-medium">Expires in {daysLeft}d</span>;
  return <span className="ml-2 px-1.5 py-0.5 text-xs bg-green-100 text-green-700 rounded-full font-medium">{daysLeft}d left</span>;
}

export default function TLS() {
  const [certs, setCerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  async function load() {
    try {
      setLoading(true);
      setError(null);
      const d = await fetchData("/api/v1/tls");
      setCerts(d.certs || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function uploadFile(file) {
    const ext = "." + file.name.split(".").pop().toLowerCase();
    if (!ALLOWED_EXTS.includes(ext)) {
      setUploadError(`File type not allowed. Allowed: ${ALLOWED_EXTS.join(", ")}`);
      return;
    }
    if (file.size > MAX_SIZE_KB * 1024) {
      setUploadError(`File too large. Maximum ${MAX_SIZE_KB} KB.`);
      return;
    }
    setUploadError(null);
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/v1/tls/upload", { method: "POST", body: form });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(typeof err.detail === "string" ? err.detail : JSON.stringify(err.detail));
      }
      await load();
    } catch (e) {
      setUploadError(e.message);
    } finally {
      setUploading(false);
    }
  }

  function handleFileChange(e) {
    const file = e.target.files[0];
    if (file) uploadFile(file);
    e.target.value = "";
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) uploadFile(file);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/v1/tls/${encodeURIComponent(deleteTarget)}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(typeof err.detail === "string" ? err.detail : JSON.stringify(err.detail));
      }
      setDeleteTarget(null);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-gray-800">TLS Certificates</h2>

      {error && <div className="bg-red-50 border border-red-200 rounded p-3 text-red-700 text-sm">{error}</div>}

      {/* Upload zone */}
      <div
        className={`card p-6 border-2 border-dashed text-center transition-colors cursor-pointer ${dragOver ? "border-c-orange bg-orange-50" : "border-gray-300 hover:border-c-orange"}`}
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input ref={fileInputRef} type="file" accept={ALLOWED_EXTS.join(",")} className="hidden" onChange={handleFileChange} />
        <p className="text-sm text-gray-600">
          {uploading ? "Uploading…" : <><span className="font-medium text-c-orange">Click to upload</span> or drag & drop</>}
        </p>
        <p className="text-xs text-gray-400 mt-1">{ALLOWED_EXTS.join(", ")} · max {MAX_SIZE_KB} KB</p>
        {uploadError && <p className="mt-2 text-xs text-red-600">{uploadError}</p>}
      </div>

      {/* Cert table */}
      <div className="card overflow-hidden">
        {loading ? (
          <p className="p-6 text-sm text-gray-500">Loading…</p>
        ) : certs.length === 0 ? (
          <p className="p-6 text-sm text-gray-400 text-center">No certificates found in certs directory.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Filename</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Subject</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Issuer</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Expiry</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {certs.map(cert => (
                <tr key={cert.filename} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs text-gray-800">{cert.filename}</td>
                  <td className="px-4 py-3 text-xs text-gray-600">{cert.subject || <span className="text-gray-400">—</span>}</td>
                  <td className="px-4 py-3 text-xs text-gray-600">{cert.issuer || <span className="text-gray-400">—</span>}</td>
                  <td className="px-4 py-3 text-xs">
                    {cert.not_after ? (
                      <span>{new Date(cert.not_after).toLocaleDateString()}{expiryBadge(cert.not_after)}</span>
                    ) : <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => setDeleteTarget(cert.filename)} className="text-xs text-red-600 hover:text-red-800">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Delete confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setDeleteTarget(null)}>
          <div className="bg-white rounded-lg shadow-xl p-6 w-96 max-w-full mx-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-gray-900 mb-2">Delete Certificate</h3>
            <p className="text-sm text-gray-600 mb-4">
              Are you sure you want to delete <span className="font-mono font-medium">{deleteTarget}</span>? This cannot be undone.
            </p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setDeleteTarget(null)} className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50">Cancel</button>
              <button onClick={handleDelete} disabled={deleting} className="px-3 py-1.5 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50">
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
