import { z } from "zod";
import { config as envConfig } from "../lib/env";
import { createRateLimiter } from "../lib/rate-limiter";
import { getPreviousStatus } from "../lib/stream";
import type { Logger, StatusResult } from "../lib/types.js";

// Create a rate limiter instance for terminal alerts
const rateLimiter = createRateLimiter({
  burst: envConfig.alertBurst,
  windowSec: envConfig.alertWindowSec,
});

export const config = {
  type: "event",
  name: "TerminalAlerter",
  description: "Shows terminal notifications when website status changes",

  /**
   * This step subscribes to 'check.result' events from the checker
   */
  subscribes: ["check.result"],

  /**
   * This step doesn't emit any events
   */
  emits: [],

  /**
   * Expected input schema matching check result structure
   */
  input: z.object({
    url: z.string().url(),
    status: z.enum(["UP", "DOWN"]),
    code: z.number().nullable(),
    responseTime: z.number(),
    checkedAt: z.string(),
    error: z.string().nullable(),
  }),

  /**
   * The flows this step belongs to
   */
  flows: ["uptime-monitoring"],
};

/**
 * Creates a formatted terminal message for status changes
 */
function createTerminalMessage(
  result: StatusResult,
  previousStatus: string
): string {
  const { url, status, code, responseTime, checkedAt, error } = result;

  // Determine emoji and color codes for terminal
  const isUp = status === "UP";
  const emoji = isUp ? "🟢" : "🔴";
  const colorCode = isUp ? "\x1b[32m" : "\x1b[31m"; // Green or Red
  const resetColor = "\x1b[0m";
  const boldStart = "\x1b[1m";
  const boldEnd = "\x1b[22m";

  let message = `
${colorCode}${boldStart}═══════════════════════════════════════════════════════════════${boldEnd}${resetColor}
`;
  message += `${colorCode}${boldStart}🚨 WEBSITE STATUS CHANGE DETECTED${boldEnd}${resetColor}
`;
  message += `${colorCode}${boldStart}═══════════════════════════════════════════════════════════════${boldEnd}${resetColor}

`;

  message += `${emoji} ${boldStart}Website:${boldEnd} ${url}
`;
  message += `📊 ${boldStart}Status:${boldEnd} ${previousStatus} → ${colorCode}${boldStart}${status}${boldEnd}${resetColor}
`;
  message += `⏱️  ${boldStart}Response Time:${boldEnd} ${responseTime}ms
`;

  if (code !== null) {
    message += `🌐 ${boldStart}HTTP Status Code:${boldEnd} ${code}
`;
  }

  message += `📅 ${boldStart}Check Time:${boldEnd} ${new Date(
    checkedAt
  ).toLocaleString()}
`;

  if (error) {
    message += `❌ ${boldStart}Error:${boldEnd} ${error}
`;
  }

  message += `
${colorCode}${boldStart}═══════════════════════════════════════════════════════════════${boldEnd}${resetColor}
`;

  return message;
}

/**
 * Creates a simple status update message for unchanged status
 */
function createStatusUpdateMessage(result: StatusResult): string {
  const { url, status, responseTime, checkedAt } = result;
  const emoji = status === "UP" ? "✅" : "❌";
  const timestamp = new Date(checkedAt).toLocaleTimeString();

  return `${emoji} [${timestamp}] ${url} - ${status} (${responseTime}ms)`;
}

/**
 * Displays terminal notification for status changes
 */
function showTerminalNotification(
  message: string,
  logger: Logger,
  isStatusChange: boolean = true
): void {
  if (isStatusChange) {
    // For status changes, use console.log for immediate visibility
    console.log(message);
    logger.info("🚨 WEBSITE STATUS CHANGE", {
      type: "status_change",
      displayed: true,
    });
  } else {
    // For regular updates, use logger
    logger.info(message);
  }
}

export const handler = async (
  input: StatusResult,
  { logger }: { logger: Logger }
) => {
  logger.debug("🚨 ALERTER: Handler called!", {
    input: input,
    inputType: typeof input,
    inputKeys: Object.keys(input || {}),
    hasUrl: !!input?.url,
  });

  const { url, status, code, responseTime, checkedAt, error } = input;

  // Get the previous status for this site
  logger.debug("🚨 ALERTER: About to call getPreviousStatus", {
    url: url,
    urlType: typeof url,
  });

  let previousResult;
  try {
    previousResult = getPreviousStatus(url);
    logger.debug("🚨 ALERTER: getPreviousStatus result", {
      url: url,
      hasPreviousResult: !!previousResult,
      previousResult: previousResult,
    });

    // Let's also check what's in the status store
    const { getSnapshot } = await import("../lib/stream");
    const allStatuses = getSnapshot();
    logger.debug("🚨 ALERTER: Current status store contents", {
      storeKeys: Object.keys(allStatuses),
      storeSize: Object.keys(allStatuses).length,
      queryingUrl: url,
    });
  } catch (getPrevError) {
    const errorMessage =
      getPrevError instanceof Error
        ? getPrevError.message
        : String(getPrevError);
    const errorStack =
      getPrevError instanceof Error ? getPrevError.stack : undefined;
    logger.error("🚨 ALERTER: Error calling getPreviousStatus", {
      url: url,
      error: errorMessage,
      stack: errorStack,
    });
    return;
  }

  // Handle first-time checks (no previous status)
  if (!previousResult) {
    logger.info(
      "🚨 ALERTER: First-time check for site, storing initial status",
      {
        url,
        status,
      }
    );

    // Store the current status for next time (first-time check)
    const { updateLastStatus } = await import("../lib/stream");
    updateLastStatus(input);

    // Show initial status message
    const initialMessage = `🎯 [INITIAL CHECK] ${url} - ${status} (${responseTime}ms)`;
    console.log(`
📝 ${initialMessage}
`);
    logger.info("🚨 ALERTER: Stored first-time status for future comparisons");
    return;
  }

  const previousStatus = previousResult.status;

  logger.debug("🚨 ALERTER: Comparing statuses", {
    url,
    currentStatus: status,
    previousStatus: previousStatus,
    hasChanged: status !== previousStatus,
  });

  // Only trigger alerts when status actually changes
  if (status === previousStatus) {
    logger.debug("🚨 ALERTER: Status unchanged, showing regular update", {
      url,
      status,
      previousStatus,
    });

    // Update the status store with current check (same status, but newer timestamp)
    const { updateLastStatus } = await import("../lib/stream");
    updateLastStatus(input);

    // Show simple status update
    const updateMessage = createStatusUpdateMessage(input);
    showTerminalNotification(updateMessage, logger, false);
    return;
  }

  // Status has changed - log the transition
  logger.info("🚨 ALERTER: Status change detected", {
    url,
    previousStatus,
    newStatus: status,
    transition: `${previousStatus} → ${status}`,
  });

  // Check rate limiting before showing alert
  logger.debug("🚨 ALERTER: About to check rate limiting", { url, status });

  if (!rateLimiter.consume(url)) {
    const timeUntilNext = rateLimiter.getTimeUntilNextToken(url);
    logger.warn("🚨 ALERTER: Alert rate limited", {
      url,
      status,
      previousStatus,
      timeUntilNextMs: timeUntilNext,
      tokensRemaining: rateLimiter.getTokenCount(url),
    });

    // Show rate limited message
    console.log(`
⏳ [RATE LIMITED] Status change for ${url} (${previousStatus} → ${status}) - Next alert available in ${Math.ceil(
      timeUntilNext / 1000
    )}s
`);
    return;
  }

  logger.info(
    "🚨 ALERTER: Rate limiting passed, proceeding with terminal alert",
    { url, status }
  );

  logger.info("🚨 ALERTER: Showing terminal alert", {
    url,
    status,
    previousStatus,
    tokensRemaining: rateLimiter.getTokenCount(url),
  });

  // Create and show terminal message
  const message = createTerminalMessage(input, previousStatus);
  showTerminalNotification(message, logger, true);

  logger.info("Terminal alert displayed successfully", {
    url,
    status,
    previousStatus,
  });

  // CRITICAL: Update the status store AFTER showing the alert
  // This ensures the next check will have the correct previous status
  const { updateLastStatus } = await import("../lib/stream");
  updateLastStatus(input);
  logger.info("🚨 ALERTER: Updated status store after showing alert", {
    url,
    newStatus: status,
    previousStatus,
  });
};
