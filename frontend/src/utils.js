// ──────────────────────────────────────────────────────────────────────
// Ported from legacy/utils/utils.js
// ──────────────────────────────────────────────────────────────────────

export function toTimeString(date = new Date()) {
  const d = new Date(date);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

export function timeStringToTimestamp(timeString) {
  const match = timeString.match(/^(\d{2}):(\d{2}):(\d{2})$/);
  if (!match) throw new Error(`Invalid format. Expected HH:mm:ss, got: ${timeString}`);
  const [, h, m, s] = match;
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), +h, +m, +s).getTime();
}

export function prettifyNumber(number) {
  if (number > Number.MAX_SAFE_INTEGER) return ">" + String(Number.MAX_SAFE_INTEGER);
  const str = String(number);
  if (str.length <= 3) return str;
  let result = "";
  for (let i = str.length - 1, count = 0; i >= 0; i--, count++) {
    if (count > 0 && count % 3 === 0) result = "," + result;
    result = str[i] + result;
  }
  return result;
}

export function secondsToIntervalString(number) {
  if (typeof number !== "number" || number < 0) return "—";
  const parts = [
    [365 * 24 * 3600, "year"],
    [24 * 3600, "day"],
    [3600, "hour"],
    [60, "minute"],
    [1, "second"],
  ];
  let remaining = Math.floor(number);
  let result = "";
  for (const [secs, label] of parts) {
    const count = Math.floor(remaining / secs);
    remaining %= secs;
    if (count) result += `${count} ${label}${count !== 1 ? "s" : ""} `;
  }
  return result.trim() || "0 seconds";
}

export async function copyToClipboard(text) {
  if (navigator.clipboard) {
    return navigator.clipboard.writeText(text);
  }
  const ta = document.createElement("textarea");
  ta.value = text;
  document.body.appendChild(ta);
  ta.focus({ preventScroll: true });
  ta.select();
  try {
    document.execCommand("copy");
  } finally {
    ta.remove();
  }
}

export function isMobile() {
  return window.innerWidth < 1024;
}

export async function fetchData(endpoint, opts = {}) {
  const token = localStorage.getItem("auth_token");
  const headers = { Accept: "application/json", ...opts.headers };
  
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  
  const res = await fetch(endpoint, { ...opts, headers });
  
  // Handle 401 errors by redirecting to login
  if (res.status === 401) {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("auth_user");
    window.location.href = "/login";
    throw new Error("Unauthorized");
  }
  
  if (!res.ok) throw new Error(`Failed to fetch: ${res.status} ${res.statusText}`);
  return res.json();
}
