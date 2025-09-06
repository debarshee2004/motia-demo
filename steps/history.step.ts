import { z } from "zod";
import { getSiteHistory } from "../lib/stream";
import type { Logger } from "../lib/types";

export const config = {
  type: "api",
  name: "SiteHistory",
  description: "Provides historical check data for a specific site",

  /**
   * HTTP method and path configuration
   */
  method: "GET",
  path: "/history/:url",

  /**
   * This step doesn't emit any events
   */
  emits: [],

  /**
   * Response schema definition
   */
  responseSchema: {
    200: z.object({
      url: z.string(),
      history: z.array(
        z.object({
          url: z.string(),
          status: z.enum(["UP", "DOWN"]),
          code: z.number().nullable(),
          responseTime: z.number(),
          checkedAt: z.string(),
          error: z.string().nullable(),
        })
      ),
      total: z.number(),
      timestamp: z.string(),
    }),
    404: z.object({
      error: z.string(),
      message: z.string(),
    }),
  },

  /**
   * The flows this step belongs to
   */
  flows: ["uptime-monitoring"],
};

export const handler = async (
  input: { url: string; limit?: string },
  { logger }: { logger: Logger }
) => {
  // Validate and parse input parameters
  const urlParam = input.url;
  const limitParam = input.limit;

  logger.info("Site history endpoint accessed", {
    urlParam,
    limitParam,
    inputType: typeof input,
    inputKeys: Object.keys(input),
  });

  // Parse limit parameter
  let limit = 100;
  if (limitParam) {
    const parsedLimit = parseInt(limitParam, 10);
    if (!isNaN(parsedLimit) && parsedLimit > 0) {
      limit = Math.min(parsedLimit, 1000); // Cap at 1000 records
    }
  }

  try {
    // Decode URL parameter
    const decodedUrl = decodeURIComponent(urlParam);

    // Basic URL validation
    try {
      new URL(decodedUrl);
    } catch (urlError) {
      logger.warn("Invalid URL parameter", { url: decodedUrl });
      return {
        status: 400,
        body: {
          error: "Invalid URL",
          message: "The provided URL parameter is not a valid URL",
        },
      };
    }

    // Get site history
    const history = getSiteHistory(decodedUrl, limit);

    if (history.length === 0) {
      logger.warn("No history found for site", { url: decodedUrl });
      return {
        status: 404,
        body: {
          error: "Site not found",
          message: `No history available for ${decodedUrl}`,
        },
      };
    }

    const response = {
      url: decodedUrl,
      history,
      total: history.length,
      timestamp: new Date().toISOString(),
    };

    logger.info("Site history retrieved successfully", {
      url: decodedUrl,
      recordsReturned: history.length,
      limit: limit,
    });

    return {
      status: 200,
      body: response,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error("Failed to retrieve site history", {
      url: urlParam,
      error: errorMessage,
    });

    return {
      status: 500,
      body: {
        error: "Failed to retrieve site history",
        message: errorMessage,
      },
    };
  }
};
