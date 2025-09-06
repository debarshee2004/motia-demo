/**
 * Persistent status store for Motia Uptime Monitor
 * Manages site status data and provides snapshot functionality
 * Uses file-based storage to persist between step executions
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import type { SiteMetrics, StatusResult, StatusStore } from "./types";

// File-based storage paths
const STORE_FILE = join(process.cwd(), ".motia", "status-store.json");
const METRICS_FILE = join(process.cwd(), ".motia", "metrics-store.json");
const HISTORY_FILE = join(process.cwd(), ".motia", "history-store.json");

// Helper function to ensure directory exists
function ensureDirectoryExists(): void {
  const dir = join(process.cwd(), ".motia");
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

// Helper function to load status store from file
function loadStatusStore(): StatusStore {
  try {
    if (existsSync(STORE_FILE)) {
      const data = readFileSync(STORE_FILE, "utf8");
      return JSON.parse(data) as StatusStore;
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.warn("Failed to load status store:", errorMessage);
  }
  return {};
}

// Helper function to save status store to file
function saveStatusStore(store: StatusStore): void {
  try {
    ensureDirectoryExists();
    writeFileSync(STORE_FILE, JSON.stringify(store, null, 2));
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Failed to save status store:", errorMessage);
  }
}

// Helper function to load metrics store
function loadMetricsStore(): Record<string, SiteMetrics> {
  try {
    if (existsSync(METRICS_FILE)) {
      const data = readFileSync(METRICS_FILE, "utf8");
      return JSON.parse(data);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.warn("Failed to load metrics store:", errorMessage);
  }
  return {};
}

// Helper function to save metrics store
function saveMetricsStore(metrics: Record<string, SiteMetrics>): void {
  try {
    ensureDirectoryExists();
    writeFileSync(METRICS_FILE, JSON.stringify(metrics, null, 2));
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Failed to save metrics store:", errorMessage);
  }
}

// Helper function to add to history
function addToHistory(result: StatusResult): void {
  try {
    let history: StatusResult[] = [];
    if (existsSync(HISTORY_FILE)) {
      const data = readFileSync(HISTORY_FILE, "utf8");
      history = JSON.parse(data);
    }

    // Keep only last 1000 entries to prevent file from growing too large
    history.push(result);
    if (history.length > 1000) {
      history = history.slice(-1000);
    }

    ensureDirectoryExists();
    writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.warn("Failed to save to history:", errorMessage);
  }
}

/**
 * Updates the last known status for a site and calculates metrics
 */
export function updateLastStatus(result: StatusResult): void {
  if (!result || typeof result !== "object" || Array.isArray(result)) {
    throw new Error("Result must be a valid object");
  }

  if (!result.url || typeof result.url !== "string") {
    throw new Error("Result must have a valid URL string");
  }

  if (!result.status || !["UP", "DOWN"].includes(result.status)) {
    throw new Error("Result must have a valid status (UP or DOWN)");
  }

  if (typeof result.responseTime !== "number" || result.responseTime < 0) {
    throw new Error(
      "Result must have a valid responseTime (non-negative number)"
    );
  }

  if (!result.checkedAt || typeof result.checkedAt !== "string") {
    throw new Error("Result must have a valid checkedAt timestamp");
  }

  // Store the complete result object in persistent storage
  const store = loadStatusStore();
  const previousResult = store[result.url];
  store[result.url] = { ...result };
  saveStatusStore(store);

  // Update metrics
  updateSiteMetrics(result, previousResult);

  // Add to history
  addToHistory(result);
}

/**
 * Updates site metrics based on the latest result
 */
function updateSiteMetrics(
  result: StatusResult,
  previousResult?: StatusResult
): void {
  const metrics = loadMetricsStore();
  const existing = metrics[result.url] || {
    url: result.url,
    averageResponseTime: 0,
    uptimePercentage: 100,
    totalChecks: 0,
    successfulChecks: 0,
    consecutiveFailures: 0,
    maxResponseTime: 0,
    minResponseTime: Infinity,
  };

  // Update counters
  existing.totalChecks++;
  if (result.status === "UP") {
    existing.successfulChecks++;
    existing.consecutiveFailures = 0;
    existing.lastUpTime = result.checkedAt;
  } else {
    existing.consecutiveFailures++;
    existing.lastDownTime = result.checkedAt;
  }

  // Update response time metrics
  const responseTime = result.responseTime;
  existing.averageResponseTime =
    (existing.averageResponseTime * (existing.totalChecks - 1) + responseTime) /
    existing.totalChecks;
  existing.maxResponseTime = Math.max(existing.maxResponseTime, responseTime);
  existing.minResponseTime = Math.min(existing.minResponseTime, responseTime);

  // Update uptime percentage
  existing.uptimePercentage =
    (existing.successfulChecks / existing.totalChecks) * 100;

  metrics[result.url] = existing;
  saveMetricsStore(metrics);
}

/**
 * Returns a snapshot of all current site statuses
 */
export function getSnapshot(): StatusStore {
  const store = loadStatusStore();
  const snapshot: StatusStore = {};

  for (const [url, result] of Object.entries(store)) {
    snapshot[url] = { ...result };
  }

  return snapshot;
}

/**
 * Gets the previous status for a specific site
 */
export function getPreviousStatus(url: string): StatusResult | null {
  if (!url || typeof url !== "string") {
    throw new Error("URL must be a valid string");
  }

  const store = loadStatusStore();
  const result = store[url];
  return result ? { ...result } : null;
}

/**
 * Gets metrics for a specific site
 */
export function getSiteMetrics(url: string): SiteMetrics | null {
  if (!url || typeof url !== "string") {
    throw new Error("URL must be a valid string");
  }

  const metrics = loadMetricsStore();
  return metrics[url] || null;
}

/**
 * Gets metrics for all sites
 */
export function getAllMetrics(): Record<string, SiteMetrics> {
  return loadMetricsStore();
}

/**
 * Gets the history of checks for a specific site
 */
export function getSiteHistory(
  url: string,
  limit: number = 100
): StatusResult[] {
  try {
    if (!existsSync(HISTORY_FILE)) {
      return [];
    }

    const data = readFileSync(HISTORY_FILE, "utf8");
    const history: StatusResult[] = JSON.parse(data);

    return history
      .filter((result) => result.url === url)
      .slice(-limit)
      .reverse(); // Most recent first
  } catch (error) {
    console.warn("Failed to load site history:", error);
    return [];
  }
}

/**
 * Clears all stored statuses (useful for testing)
 */
export function clearAllStatuses(): void {
  saveStatusStore({});
  saveMetricsStore({});
  try {
    if (existsSync(HISTORY_FILE)) {
      writeFileSync(HISTORY_FILE, JSON.stringify([]));
    }
  } catch (error) {
    console.warn("Failed to clear history:", error);
  }
}

/**
 * Gets the count of sites being tracked
 */
export function getSiteCount(): number {
  const store = loadStatusStore();
  return Object.keys(store).length;
}

/**
 * Gets overall system health metrics
 */
export function getSystemMetrics() {
  const store = loadStatusStore();
  const metrics = loadMetricsStore();

  const sites = Object.values(store);
  const upSites = sites.filter((s) => s.status === "UP").length;
  const downSites = sites.filter((s) => s.status === "DOWN").length;

  const allMetrics = Object.values(metrics);
  const avgUptime =
    allMetrics.length > 0
      ? allMetrics.reduce((sum, m) => sum + m.uptimePercentage, 0) /
        allMetrics.length
      : 100;

  const avgResponseTime =
    allMetrics.length > 0
      ? allMetrics.reduce((sum, m) => sum + m.averageResponseTime, 0) /
        allMetrics.length
      : 0;

  return {
    totalSites: sites.length,
    upSites,
    downSites,
    overallUptimePercentage: avgUptime,
    averageResponseTime: avgResponseTime,
    lastUpdate:
      sites.length > 0
        ? Math.max(...sites.map((s) => new Date(s.checkedAt).getTime()))
        : Date.now(),
  };
}
