import { useState, useEffect } from "react";
import Modal from "../components/Modal";
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
  return res.status === 204 ? null : res.json();
}

export default function Users() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modal, setModal] = useState(null); // { type: "add" | "edit", username?: string }
  const [formData, setFormData] = useState({ username: "", password: "" });
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  async function load() {
    try {
      setLoading(true);
      const d = await fetchData("/api/v1/users");
      setUsers(d.users);
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function openAdd() {
    setFormData({ username: "", password: "" });
    setFormError("");
    setModal({ type: "add" });
  }
  function openEdit(username) {
    setFormData({ username, password: "" });
    setFormError("");
    setModal({ type: "edit", username });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setFormError("");
    try {
      if (modal.type === "add") {
        await apiRequest("POST", "/api/v1/users", { username: formData.username, password: formData.password });
      } else {
        await apiRequest("PUT", `/api/v1/users/${encodeURIComponent(modal.username)}`, { password: formData.password });
      }
      setModal(null);
      await load();
    } catch (e) {
      setFormError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(username) {
    try {
      await apiRequest("DELETE", `/api/v1/users/${encodeURIComponent(username)}`);
      setDeleteConfirm(null);
      await load();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-800">Users</h2>
        <button onClick={openAdd} className="inline-flex items-center gap-1 px-3 py-1.5 bg-c-orange text-white text-sm rounded hover:bg-orange-700 transition-colors">
          + Add User
        </button>
      </div>

      {error && <div className="bg-red-50 border border-red-200 rounded p-3 text-red-700 text-sm">{error}</div>}

      <div className="card overflow-hidden">
        {loading ? (
          <p className="p-6 text-sm text-gray-500">Loading…</p>
        ) : users.length === 0 ? (
          <p className="p-6 text-sm text-gray-500">No users found in passwd file.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 font-medium text-gray-600">Username</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-gray-800">{u}</td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <button onClick={() => openEdit(u)} className="text-blue-600 hover:underline text-xs">Change Password</button>
                    <button onClick={() => setDeleteConfirm(u)} className="text-red-600 hover:underline text-xs">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add/Edit modal */}
      <Modal
        open={!!modal}
        title={modal?.type === "add" ? "Add User" : `Change Password — ${modal?.username}`}
        onClose={() => setModal(null)}
      >
        <form onSubmit={handleSubmit} className="space-y-3">
          {modal?.type === "add" && (
            <div>
              <label className="block text-sm text-gray-700 mb-1">Username</label>
              <input
                required
                value={formData.username}
                onChange={e => setFormData(d => ({ ...d, username: e.target.value }))}
                className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                pattern="[a-zA-Z0-9_\-\.@]{1,64}"
                title="Letters, numbers, _ - . @ only, max 64 chars"
              />
            </div>
          )}
          <div>
            <label className="block text-sm text-gray-700 mb-1">Password</label>
            <input
              required
              type="password"
              value={formData.password}
              onChange={e => setFormData(d => ({ ...d, password: e.target.value }))}
              className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
            />
          </div>
          {formError && <p className="text-red-600 text-xs">{formError}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setModal(null)} className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={saving} className="px-3 py-1.5 text-sm bg-c-orange text-white rounded hover:bg-orange-700 disabled:opacity-50">
              {saving ? "Saving…" : modal?.type === "add" ? "Create" : "Update"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete confirmation */}
      <Modal open={!!deleteConfirm} title="Delete User" onClose={() => setDeleteConfirm(null)}>
        <p className="text-sm text-gray-700">Delete user <strong>{deleteConfirm}</strong>? This cannot be undone.</p>
        <div className="flex justify-end gap-2 pt-4">
          <button onClick={() => setDeleteConfirm(null)} className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50">Cancel</button>
          <button onClick={() => handleDelete(deleteConfirm)} className="px-3 py-1.5 text-sm bg-red-600 text-white rounded hover:bg-red-700">Delete</button>
        </div>
      </Modal>
    </div>
  );
}
