// ──────────────────────────────────────────────────────────────────────
// Ported from legacy/app/consts.js — values kept identical
// ──────────────────────────────────────────────────────────────────────
export const MAX_POINTS_IN_CHART = 5_000;

export const KEEP_DATAPOINTS_FOR_INTERVAL =
  1000 * // ms
  60 *   // sec → min
  60 *   // min → hr
  2;     // 2 hours

export const CHART_UPDATE_INTERVAL_IN_MILLISECONDS = 1000 * 60 * 1;   // 1 min
export const SMOOTHED_CHART_UPDATE_INTERVAL_IN_MILLISECONDS = 1000 * 60 * 5; // 5 min
export const INTERVAL_5SECS_IN_MILLISECONDS = 1000 * 5;
export const CHARTJS_ANIMATION_DURATION_MS = 400;

export const SYSTOPIC_ENDPOINT  = "/api/v1/systree";
export const LISTENERS_ENDPOINT = "/api/v1/listeners";
export const CHART_DISPLAY_WINDOW = 16;

// ──────────────────────────────────────────────────────────────────────
// Chart colour palette — ported from legacy/app/dashboard.js
// ──────────────────────────────────────────────────────────────────────
export const MAIN_CHART_COLOR          = "#fd602e"; // brand orange
export const SUPPLEMENTARY_CHART_COLOR = "#6366f1"; // indigo-500
