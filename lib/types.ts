/**
 * Shared type definitions for Motia Uptime Monitor
 */

// Core status interfaces
export interface StatusResult {
  url: string;
  status: "UP" | "DOWN";
  code: number | null;
  responseTime: number;
  checkedAt: string;
  error: string | null;
  // New fields for enhanced monitoring
  region?: string;
  retryCount?: number;
  certificateExpiry?: string;
  dnsResolutionTime?: number;
}

export interface StatusStore {
  [url: string]: StatusResult;
}

export interface SiteMetrics {
  url: string;
  averageResponseTime: number;
  uptimePercentage: number;
  totalChecks: number;
  successfulChecks: number;
  lastDownTime?: string;
  lastUpTime?: string;
  consecutiveFailures: number;
  maxResponseTime: number;
  minResponseTime: number;
}

// Rate limiter interfaces
export interface RateLimiterOptions {
  burst: number;
  windowSec: number;
}

export interface TokenBucket {
  tokens: number;
  lastRefill: number;
}

export interface RateLimiter {
  isAllowed: (siteUrl: string) => boolean;
  consume: (siteUrl: string) => boolean;
  getTokenCount: (siteUrl: string) => number;
  getTimeUntilNextToken: (siteUrl: string) => number;
  reset: () => void;
  config: {
    burst: number;
    windowSec: number;
    refillRate: number;
  };
}

// Logger interface
export interface Logger {
  info: (message: string, meta?: any) => void;
  error: (message: string, meta?: any) => void;
  warn: (message: string, meta?: any) => void;
  debug: (message: string, meta?: any) => void;
}

// Context interfaces for handlers
export interface MotiaContext {
  logger: Logger;
  emit?: (event: { topic: string; data: any }) => Promise<void>;
}

// Enhanced configuration
export interface MonitoringConfig {
  sites: string[];
  cron: string;
  alertBurst: number;
  alertWindowSec: number;
  retryAttempts?: number;
  timeout?: number;
  checkCertificates?: boolean;
  regions?: string[];
}

// Health check response
export interface HealthResponse {
  status: "ok" | "degraded" | "down";
  sitesConfigured: number;
  lastKnown: StatusStore;
  now: string;
  metrics?: {
    totalUptime: number;
    averageResponseTime: number;
    activeAlerts: number;
  };
  version?: string;
  uptime?: number;
}

// Alert severity levels
export type AlertSeverity = "low" | "medium" | "high" | "critical";

export interface Alert {
  id: string;
  url: string;
  severity: AlertSeverity;
  message: string;
  timestamp: string;
  resolved: boolean;
  resolvedAt?: string;
}

// Site configuration with advanced options
export interface SiteConfig {
  url: string;
  name?: string;
  expectedStatusCodes?: number[];
  timeout?: number;
  retryCount?: number;
  followRedirects?: boolean;
  checkSslCert?: boolean;
  customHeaders?: Record<string, string>;
  expectedContent?: string;
  region?: string;
  alertThreshold?: number;
}
