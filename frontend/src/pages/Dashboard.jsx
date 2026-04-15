import { useRef, useEffect, useState, useCallback } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import zoomPlugin from "chartjs-plugin-zoom";
import { Line } from "react-chartjs-2";
import { useSysTree } from "../hooks/useSysTree";
import StatCard from "../components/StatCard";
import {
  prettifyNumber,
  secondsToIntervalString,
  toTimeString,
  timeStringToTimestamp,
} from "../utils";
import {
  MAIN_CHART_COLOR,
  SUPPLEMENTARY_CHART_COLOR,
  MAX_POINTS_IN_CHART,
  KEEP_DATAPOINTS_FOR_INTERVAL,
  CHART_UPDATE_INTERVAL_IN_MILLISECONDS,
  CHART_DISPLAY_WINDOW,
} from "../consts";

ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement,
  Title, Tooltip, Legend, Filler, zoomPlugin
);

// ──────────────────────────────────────────────────────────────────────
// Helpers ported from legacy/app/dashboard.js
// ──────────────────────────────────────────────────────────────────────

function createChartState() {
  return { rawData: [], rawLabels: [], smoothedData: [], smoothedLabels: [] };
}

function trimWindow(labels, data, now) {
  while (
    labels.length &&
    now - timeStringToTimestamp(labels[0]) >= KEEP_DATAPOINTS_FOR_INTERVAL
  ) {
    labels.shift();
    data.shift();
  }
}

function pushDatapoint(state, value, timeStr, now) {
  // raw
  if (state.rawData.length >= MAX_POINTS_IN_CHART) { state.rawData.shift(); state.rawLabels.shift(); }
  trimWindow(state.rawLabels, state.rawData, now);
  state.rawData.push(value);
  state.rawLabels.push(timeStr);
  // smoothed — simple "keep point only if sufficiently different or time far apart"
  const sd = state.smoothedData; const sl = state.smoothedLabels;
  const last = sd[sd.length - 1];
  const lastLabel = sl[sl.length - 1];
  const farApart = lastLabel
    ? now - timeStringToTimestamp(lastLabel) > CHART_UPDATE_INTERVAL_IN_MILLISECONDS
    : true;
  const suffDiff = last !== undefined
    ? Math.abs(value - last) / (last || 1) > 0.2
    : true;
  if (!sl.length || suffDiff || farApart) {
    sd.push(value);
    sl.push(timeStr);
  } else {
    sd[sd.length - 1] = value;
    sl[sl.length - 1] = timeStr;
  }
}

function makeLineConfig(labels, data, label, color, fill = true) {
  const len = data.length;
  const startIdx = Math.max(0, len - CHART_DISPLAY_WINDOW);
  return {
    data: {
      labels,
      datasets: [{
        label,
        data,
        borderColor: color,
        backgroundColor: color + "20",
        borderWidth: 2,
        fill,
        tension: 0.4,
        pointRadius: 3,
        pointHoverRadius: 5,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      plugins: {
        legend: { display: false },
        zoom: {
          zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: "xy" },
          pan: { enabled: true, mode: "xy" },
        },
      },
      scales: {
        x: { display: true, grid: { color: "#f3f4f6" }, ticks: { font: { size: 10 }, maxRotation: 45 }, min: startIdx, max: len - 1 },
        y: { display: true, beginAtZero: true, grid: { color: "#f3f4f6" }, ticks: { font: { size: 10 } } },
      },
      interaction: { intersect: false, mode: "index" },
    },
  };
}

// ──────────────────────────────────────────────────────────────────────
// ChartCard sub-component
// ──────────────────────────────────────────────────────────────────────

function ChartCard({ title, chartConfig }) {
  return (
    <div className="card">
      <div className="card-header">
        <h3 className="text-sm font-medium text-gray-700">{title}</h3>
      </div>
      <div className="card-content">
        <div className="chart-container">
          {chartConfig && <Line data={chartConfig.data} options={chartConfig.options} />}
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Main Dashboard page
// ──────────────────────────────────────────────────────────────────────

const CHART_IDS = [
  "messages-dropped",
  "messages-sent",
  "messages-received",
  "messages-sent-rate",
  "messages-received-rate",
  "clients-connected",
  "clients-disconnected",
];

const SYS_CHART_MAP = {
  "messages-dropped":       "$SYS/broker/publish/messages/dropped",
  "messages-sent":          "$SYS/broker/messages/sent",
  "messages-received":      "$SYS/broker/messages/received",
  "messages-sent-rate":     "$SYS/broker/load/messages/sent/1min",
  "messages-received-rate": "$SYS/broker/load/messages/received/1min",
  "clients-connected":      "$SYS/broker/clients/connected",
  "clients-disconnected":   "$SYS/broker/clients/disconnected",
};

export default function Dashboard() {
  const { data: sys, online } = useSysTree();

  // Chart history stored in a ref so it doesn't trigger re-renders on every datapoint
  const history = useRef(Object.fromEntries(CHART_IDS.map(id => [id, createChartState()])));
  const [chartTick, setChartTick] = useState(0);

  useEffect(() => {
    if (!Object.keys(sys).length) return;
    const now = Date.now();
    const timeStr = toTimeString(new Date(now));
    for (const id of CHART_IDS) {
      const topic = SYS_CHART_MAP[id];
      const val = parseFloat(sys[topic]);
      if (!isNaN(val)) {
        pushDatapoint(history.current[id], val, timeStr, now);
      }
    }
    setChartTick(t => t + 1);
  }, [sys]);

  const h = history.current;

  const get = (topic) => sys[topic];
  const num = (topic) => prettifyNumber(parseInt(get(topic) ?? "0", 10) || 0);

  const overviewConfig = (() => {
    const sent = h["messages-sent"];
    const recv = h["messages-received"];
    const len = sent.rawLabels.length;
    const startIdx = Math.max(0, len - CHART_DISPLAY_WINDOW);
    return {
      data: {
        labels: sent.rawLabels,
        datasets: [
          { label: "Sent", data: sent.rawData, borderColor: SUPPLEMENTARY_CHART_COLOR, backgroundColor: SUPPLEMENTARY_CHART_COLOR + "20", borderWidth: 2, fill: false, tension: 0.4 },
          { label: "Received", data: recv.rawData, borderColor: MAIN_CHART_COLOR, backgroundColor: MAIN_CHART_COLOR + "20", borderWidth: 2, fill: false, tension: 0.4 },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false, animation: false,
        plugins: { legend: { display: true, position: "top" }, zoom: { zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: "xy" }, pan: { enabled: true, mode: "xy" } } },
        scales: { x: { display: true, grid: { color: "#f3f4f6" }, min: startIdx, max: len - 1 }, y: { display: true, beginAtZero: true, grid: { color: "#f3f4f6" } } },
        interaction: { intersect: false, mode: "index" },
      },
    };
  })();

  return (
    <div className="space-y-6">
      {/* Broker info */}
      <div className="card flex items-center gap-4 p-6">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className={`status-dot ${online === false ? "broker-inactive" : "broker-active"}`} />
            <span className="text-sm font-medium text-gray-700">{online === false ? "Offline" : "Online"}</span>
          </div>
          <div className="text-xs text-gray-500">{get("$SYS/broker/version") ?? "—"}</div>
          <div className="text-xs text-gray-500">
            Uptime: {sys["$SYS/broker/uptime"] ? secondsToIntervalString(Number(sys["$SYS/broker/uptime"])) : "—"}
          </div>
        </div>
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
        <StatCard label="Clients Online"      value={num("$SYS/broker/clients/connected")} />
        <StatCard label="Clients Total"       value={num("$SYS/broker/clients/total")} />
        <StatCard label="Clients Expired"     value={num("$SYS/broker/clients/expired")} />
        <StatCard label="Clients Offline"     value={num("$SYS/broker/clients/disconnected")} />
        <StatCard label="Max Simultaneous"    value={get("$SYS/broker/clients/maximum") ?? "—"} />
        <StatCard label="Socket Connections"  value={get("$SYS/broker/connections/socket/count") ?? "—"} />
        <StatCard label="Subscriptions"       value={num("$SYS/broker/subscriptions/count")} />
        <StatCard label="Messages Stored"     value={get("$SYS/broker/messages/stored") ?? "—"} />
        <StatCard label="Retained Messages"   value={get("$SYS/broker/retained messages/count") ?? "—"} />
        <StatCard label="Msgs Dropped"        value={get("$SYS/broker/publish/messages/dropped") ?? "—"} />
        <StatCard label="Msgs to Broker"      value={get("$SYS/broker/publish/messages/received") ?? "—"} />
        <StatCard label="Msgs by Broker"      value={get("$SYS/broker/publish/messages/sent") ?? "—"} />
        <StatCard label="Bytes Received"      value={get("$SYS/broker/bytes/received") ?? "—"} />
        <StatCard label="Bytes Sent"          value={get("$SYS/broker/bytes/sent") ?? "—"} />
        <StatCard label="Heap Current"        value={get("$SYS/broker/heap/current") ?? "—"} />
        <StatCard label="Heap Max"            value={get("$SYS/broker/heap/maximum") ?? "—"} />
        <StatCard label="Msg Rate 1m (recv)"  value={get("$SYS/broker/load/messages/received/1min") ?? "—"} />
        <StatCard label="Msg Rate 1m (sent)"  value={get("$SYS/broker/load/messages/sent/1min") ?? "—"} />
        <StatCard label="Msg Rate 10m (recv)" value={get("$SYS/broker/load/messages/received/10min") ?? "—"} />
        <StatCard label="Msg Rate 10m (sent)" value={get("$SYS/broker/load/messages/sent/10min") ?? "—"} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Messages Sent vs Received (overview)" chartConfig={overviewConfig} />
        <ChartCard title="Dropped Messages"        chartConfig={makeLineConfig(h["messages-dropped"].rawLabels,        h["messages-dropped"].rawData,        "Dropped",          MAIN_CHART_COLOR)} />
        <ChartCard title="Messages Sent"            chartConfig={makeLineConfig(h["messages-sent"].rawLabels,            h["messages-sent"].rawData,            "Sent",             MAIN_CHART_COLOR)} />
        <ChartCard title="Messages Received"        chartConfig={makeLineConfig(h["messages-received"].rawLabels,        h["messages-received"].rawData,        "Received",         MAIN_CHART_COLOR)} />
        <ChartCard title="Sent Rate (1 min)"        chartConfig={makeLineConfig(h["messages-sent-rate"].rawLabels,       h["messages-sent-rate"].rawData,       "Sent/min",         MAIN_CHART_COLOR)} />
        <ChartCard title="Received Rate (1 min)"    chartConfig={makeLineConfig(h["messages-received-rate"].rawLabels,   h["messages-received-rate"].rawData,   "Received/min",     MAIN_CHART_COLOR)} />
        <ChartCard title="Connected Clients"        chartConfig={makeLineConfig(h["clients-connected"].rawLabels,        h["clients-connected"].rawData,        "Connected",        MAIN_CHART_COLOR)} />
        <ChartCard title="Disconnected Persistent"  chartConfig={makeLineConfig(h["clients-disconnected"].rawLabels,     h["clients-disconnected"].rawData,     "Disconnected",     SUPPLEMENTARY_CHART_COLOR)} />
      </div>
    </div>
  );
}
