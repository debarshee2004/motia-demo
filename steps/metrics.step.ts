import { z } from "zod";
import { getAllMetrics, getSystemMetrics } from "../lib/stream";
import type { Logger } from "../lib/types";

export const config = {
  type: "api",
  name: "MetricsEndpoint",
  description: "Provides detailed metrics and analytics for monitored sites",

  /**
   * HTTP method and path configuration
   */
  method: "GET",
  path: "/metrics",

  /**
   * This step doesn't emit any events
   */
  emits: [],

  /**
   * Response schema definition
   */
  responseSchema: {
    200: z.object({
      system: z.object({
        totalSites: z.number(),
        upSites: z.number(),
        downSites: z.number(),
        overallUptimePercentage: z.number(),
        averageResponseTime: z.number(),
        lastUpdate: z.number(),
      }),
      sites: z.record(
        z.object({
          url: z.string(),
          averageResponseTime: z.number(),
          uptimePercentage: z.number(),
          totalChecks: z.number(),
          successfulChecks: z.number(),
          lastDownTime: z.string().optional(),
          lastUpTime: z.string().optional(),
          consecutiveFailures: z.number(),
          maxResponseTime: z.number(),
          minResponseTime: z.number(),
        })
      ),
      timestamp: z.string(),
    }),
  },

  /**
   * The flows this step belongs to
   */
  flows: ["uptime-monitoring"],
};

export const handler = async (_: any, { logger }: { logger: Logger }) => {
  logger.info("Metrics endpoint accessed");

  try {
    // Get system-wide metrics
    const systemMetrics = getSystemMetrics();

    // Get individual site metrics
    const siteMetrics = getAllMetrics();

    const response = {
      system: systemMetrics,
      sites: siteMetrics,
      timestamp: new Date().toISOString(),
    };

    logger.info("Metrics retrieved successfully", {
      totalSites: Object.keys(siteMetrics).length,
      systemUptime: systemMetrics.overallUptimePercentage,
    });

    return {
      status: 200,
      body: response,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error("Failed to retrieve metrics", {
      error: errorMessage,
    });

    return {
      status: 500,
      body: {
        error: "Failed to retrieve metrics",
        message: errorMessage,
        timestamp: new Date().toISOString(),
      },
    };
  }
};
