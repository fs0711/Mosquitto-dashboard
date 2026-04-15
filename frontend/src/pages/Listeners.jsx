import { useState, useEffect } from "react";
import { fetchData } from "../utils";
import { LISTENERS_ENDPOINT } from "../consts";
import { copyToClipboard } from "../utils";

// ──────────────────────────────────────────────────────────────────────
// CLI command generator — ported from legacy/app/listeners.js
// ──────────────────────────────────────────────────────────────────────

function generateCommand(listener, type) {
  const binary = type === "pub" ? "mosquitto_pub" : "mosquitto_sub";
  const isWs = listener.protocol?.startsWith("ws");
  let cmd = binary;
  if (isWs) cmd += " --ws";
  cmd += ` -h localhost -p ${listener.port ?? "<port>"}`;
  if (listener.tls) {
    cmd += " --cafile <ca-crt.pem>";
    if (listener.mtls) cmd += " --cert <client-crt.pem> --key <client-key.pem>";
  }
  if (!listener.allow_anonymous) cmd += " -u <username> -P <password>";
  if (type === "pub") cmd += " -t <topic> -m <message>";
  if (type === "sub") cmd += " -t <topic>#";
  return cmd;
}

// ──────────────────────────────────────────────────────────────────────
// CopyButton sub-component — ported styling from legacy/app/listeners.js
// ──────────────────────────────────────────────────────────────────────

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const handle = async () => {
    await copyToClipboard(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handle}
      title={copied ? "Copied!" : "Copy"}
      className="p-2 hover:bg-c-orange transition-colors border border-gray-300 text-gray-500 hover:text-white"
    >
      {copied ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 4H6a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V6a2 2 0 00-2-2h-2m-4-1v1m0 0V2a1 1 0 011-1h2a1 1 0 011 1v1m-4 0h4" />
        </svg>
      )}
    </button>
  );
}

function CommandRow({ label, command }) {
  return (
    <div className="mt-4">
      <div className="text-xs font-medium text-gray-500 mb-1">{label}</div>
      <div className="flex">
        <pre className="bg-gray-100 p-2 text-sm font-mono flex-1 overflow-x-auto whitespace-pre-wrap break-all">
          {command}
        </pre>
        <CopyButton text={command} />
      </div>
    </div>
  );
}

function Badge({ label, color }) {
  const styles = {
    red: "bg-red-100 text-red-600",
    green: "bg-green-100 text-green-700",
    blue: "bg-blue-100 text-blue-700",
    gray: "bg-gray-100 text-gray-600",
  };
  return (
    <span className={`ml-2 px-2 py-0.5 text-xs font-medium rounded-full ${styles[color] ?? styles.gray}`}>
      {label}
    </span>
  );
}

function ListenerCard({ listener, index }) {
  const rows = [
    ["Port",     listener.port ?? "unix socket"],
    ["Protocol", listener.protocol ?? "mqtt"],
    ["TLS",      listener.tls ? "Yes" : "No"],
    ["mTLS",     listener.mtls ? "Yes" : "No"],
  ];
  return (
    <div className="card p-4 border border-gray-200">
      <h3 className="font-semibold mb-4">
        Listener {index + 1}
        {listener.allow_anonymous && <Badge label="UNSAFE" color="red" />}
        {listener.tls && <Badge label="TLS" color="green" />}
      </h3>
      <dl className="grid grid-cols-2 gap-2 text-sm mb-2">
        {rows.map(([k, v]) => (
          <div key={k}>
            <dt className="text-gray-500">{k}</dt>
            <dd className="font-medium text-gray-800">{String(v)}</dd>
          </div>
        ))}
        <div>
          <dt className="text-gray-500">Anonymous</dt>
          <dd className={`font-medium ${listener.allow_anonymous ? "text-red-600" : "text-green-700"}`}>
            {listener.allow_anonymous ? "Allowed" : "Denied"}
          </dd>
        </div>
      </dl>
      <CommandRow label="mosquitto_pub" command={generateCommand(listener, "pub")} />
      <CommandRow label="mosquitto_sub" command={generateCommand(listener, "sub")} />
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Main Listeners page
// ──────────────────────────────────────────────────────────────────────

export default function Listeners() {
  const [listeners, setListeners] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetchData(LISTENERS_ENDPOINT, { cache: "no-store" })
      .then((d) => { if (!cancelled) setListeners(d.listeners ?? []); })
      .catch((e) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, []);

  const anonymousCount = listeners?.filter((l) => l.allow_anonymous).length ?? 0;

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="card p-6 flex gap-8">
        <div>
          <div className="metric-label">Total Listeners</div>
          <div className="metric-value">{listeners?.length ?? "—"}</div>
        </div>
        <div>
          <div className="metric-label">Anonymous Listeners</div>
          <div className="metric-value flex items-center">
            {listeners === null ? "—" : (
              <>
                {anonymousCount}
                {anonymousCount > 0 && <Badge label="UNSAFE" color="red" />}
              </>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">{error}</div>
      )}

      {/* Listener cards */}
      <div id="listeners-container" className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {listeners === null && !error && (
          <p className="text-gray-500 text-sm">Loading…</p>
        )}
        {listeners?.length === 0 && (
          <p className="text-gray-500 text-sm">No listeners found in config.</p>
        )}
        {listeners?.map((l, i) => <ListenerCard key={i} listener={l} index={i} />)}
      </div>
    </div>
  );
}
