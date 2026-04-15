export default function StatCard({ label, value, sub }) {
  return (
    <div className="card p-4">
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value ?? "—"}</div>
      {sub && <div className="text-xs text-gray-400 mt-1">{sub}</div>}
    </div>
  );
}
