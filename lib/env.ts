/**
 * Environment configuration module for Motia Uptime Monitor
 * Handles parsing and validation of all environment variables
 */

import type { MonitoringConfig } from "./types";

/**
 * Parses and validates the SITES environment variable
 */
function parseSites(sitesJson: string): string[] {
  if (!sitesJson) {
    throw new Error("SITES environment variable is required");
  }

  let sites;
  try {
    sites = JSON.parse(sitesJson);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid SITES JSON format: ${errorMessage}`);
  }

  if (!Array.isArray(sites)) {
    throw new Error("SITES must be a JSON array of URLs");
  }

  if (sites.length === 0) {
    throw new Error("SITES array cannot be empty");
  }

  // Validate each URL
  for (const site of sites) {
    if (typeof site !== "string") {
      throw new Error(`Invalid site URL: ${site} (must be string)`);
    }

    try {
      new URL(site);
    } catch {
      throw new Error(`Invalid site URL format: ${site}`);
    }
  }

  return sites;
}

/**
 * Validates cron expression format (basic validation)
 */
function isValidCron(cron: string): boolean {
  if (!cron || typeof cron !== "string") return false;

  // Basic validation: should have 5 parts separated by spaces
  const parts = cron.trim().split(/\s+/);
  return parts.length === 5;
}

// Parse and validate environment variables
const sitesEnv = process.env.SITES;
if (!sitesEnv) {
  throw new Error("SITES environment variable is required");
}

const sites = parseSites(sitesEnv);

const cron = process.env.CHECK_INTERVAL_CRON || "*/1 * * * *";
if (!isValidCron(cron)) {
  throw new Error(`Invalid CHECK_INTERVAL_CRON format: ${cron}`);
}

const alertBurst = process.env.ALERT_BURST
  ? parseInt(process.env.ALERT_BURST)
  : 3;
if (alertBurst <= 0) {
  throw new Error("ALERT_BURST must be a positive integer");
}

const alertWindowSec = process.env.ALERT_WINDOW_SEC
  ? parseInt(process.env.ALERT_WINDOW_SEC)
  : 300;
if (alertWindowSec <= 0) {
  throw new Error("ALERT_WINDOW_SEC must be a positive integer");
}

// Enhanced configuration with additional options
const retryAttempts = process.env.RETRY_ATTEMPTS
  ? parseInt(process.env.RETRY_ATTEMPTS)
  : 1;
if (retryAttempts < 0) {
  throw new Error("RETRY_ATTEMPTS must be a non-negative integer");
}

const timeout = process.env.TIMEOUT_MS
  ? parseInt(process.env.TIMEOUT_MS)
  : 10000;
if (timeout <= 0) {
  throw new Error("TIMEOUT_MS must be a positive integer");
}

const checkCertificates = process.env.CHECK_CERTIFICATES === "true";

export const config: MonitoringConfig = {
  sites,
  cron,
  alertBurst,
  alertWindowSec,
  retryAttempts,
  timeout,
  checkCertificates,
};
