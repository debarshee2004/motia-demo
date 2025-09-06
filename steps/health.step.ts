import { z } from "zod";
import { config as envConfig } from "../lib/env";
import { getAllMetrics, getSnapshot, getSystemMetrics } from "../lib/stream";
import type { HealthResponse, Logger } from "../lib/types";

export const config = {
  type: "api",
  name: "HealthCheck",
  description: "Provides system health status endpoint",

  /**
   * HTTP method and path configuration
   */
  method: "GET",
  path: "/healthz",

  /**
   * This step doesn't emit any events
   */
  emits: [],

  /**
   * Response schema definition
   */
  responseSchema: {
    200: z.object({
      status: z.enum(["ok", "degraded", "down"]),
      sitesConfigured: z.number(),
      lastKnown: z.record(z.any()),
      now: z.string(),
      metrics: z
        .object({
          totalUptime: z.number(),
          averageResponseTime: z.number(),
          activeAlerts: z.number(),
        })
        .optional(),
      version: z.string().optional(),
      uptime: z.number().optional(),
    }),
  },

  /**
   * The flows this step belongs to
   */
  flows: ["uptime-monitoring"],
};

export const handler = async (_: any, { logger }: { logger: Logger }) => {
  logger.info("Health check endpoint accessed");

  try {
    // Get current timestamp in ISO8601 format
    const now = new Date().toISOString();

    // Get count of configured sites from environment
    const sitesConfigured = envConfig.sites.length;

    // Get last known status for all sites
    const lastKnown = getSnapshot();

    // Get system metrics
    const systemMetrics = getSystemMetrics();
    const allMetrics = getAllMetrics();

    // Calculate overall health status
    const downSites = Object.values(lastKnown).filter(
      (s) => s.status === "DOWN"
    ).length;
    const totalSites = Object.values(lastKnown).length;

    let healthStatus: "ok" | "degraded" | "down" = "ok";
    if (downSites > 0) {
      healthStatus = downSites >= totalSites * 0.5 ? "down" : "degraded";
    }

    // Calculate active alerts (sites with consecutive failures)
    const activeAlerts = Object.values(allMetrics).filter(
      (m) => m.consecutiveFailures > 0
    ).length;

    const response: HealthResponse = {
      status: healthStatus,
      sitesConfigured,
      lastKnown,
      now,
      metrics: {
        totalUptime: systemMetrics.overallUptimePercentage,
        averageResponseTime: systemMetrics.averageResponseTime,
        activeAlerts,
      },
      version: "1.0.0",
      uptime: process.uptime(),
    };

    logger.info("Health check completed successfully", {
      sitesConfigured,
      sitesWithStatus: Object.keys(lastKnown).length,
      healthStatus,
      activeAlerts,
    });

    return {
      status: 200,
      body: response,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    logger.error("Health check failed", {
      error: errorMessage,
      stack: errorStack,
    });

    // Even if there's an error, we should still return a 200 status
    // as the system is operational enough to respond
    return {
      status: 200,
      body: {
        status: "ok" as const,
        sitesConfigured: 0,
        lastKnown: {},
        now: new Date().toISOString(),
        error: errorMessage,
      },
    };
  }
};
