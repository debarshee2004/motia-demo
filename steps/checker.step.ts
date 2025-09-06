import { z } from "zod";
import type { Logger, StatusResult } from "../lib/types";

export const config = {
  type: "event",
  name: "WebsiteChecker",
  description: "Performs HTTP checks on websites and emits results",

  /**
   * This step subscribes to 'check.requested' events
   */
  subscribes: ["check.requested"],

  /**
   * This step emits to both 'check.result' and 'status.stream' topics
   */
  emits: ["check.result", "status.stream"],

  /**
   * Expected input schema with URL validation
   */
  input: z.object({
    url: z.string().url("Must be a valid URL"),
  }),

  /**
   * The flows this step belongs to
   */
  flows: ["uptime-monitoring"],
};

export const handler = async (
  input: { url: string },
  {
    logger,
    emit,
  }: {
    logger: Logger;
    emit: (event: { topic: string; data: any }) => Promise<void>;
  }
) => {
  logger.info("🔍 CHECKER: Handler called!", {
    input: input,
    inputType: typeof input,
    inputKeys: Object.keys(input || {}),
    hasUrl: !!input?.url,
    inputStringified: JSON.stringify(input, null, 2),
  });

  const { url } = input;

  logger.info("🔍 CHECKER: Extracted URL:", {
    url: url,
    urlType: typeof url,
    urlLength: url?.length,
    hasUrl: !!url,
  });

  logger.info("🔍 CHECKER: Starting website check", {
    url,
    inputReceived: !!input,
  });

  const startTime = performance.now();
  let result: StatusResult | null = null;

  try {
    // Validate URL format before making request
    const urlObj = new URL(url);
    if (!["http:", "https:"].includes(urlObj.protocol)) {
      throw new Error("Only HTTP and HTTPS protocols are supported");
    }

    // Perform HTTP request with timeout handling
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    const response = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      headers: {
        "User-Agent": "Motia-Uptime-Monitor/1.0",
        Accept: "*/*",
        "Cache-Control": "no-cache",
      },
      // Don't follow redirects automatically to get accurate response codes
      redirect: "manual",
    });

    clearTimeout(timeoutId);
    const endTime = performance.now();
    const responseTime = Math.round(endTime - startTime);

    // Consider 2xx and 3xx as UP, everything else as DOWN
    const status: "UP" | "DOWN" =
      response.status >= 200 && response.status < 400 ? "UP" : "DOWN";

    result = {
      url,
      status,
      code: response.status,
      responseTime,
      checkedAt: new Date().toISOString(),
      error: null,
    };

    logger.info("Website check completed", {
      url,
      status,
      code: response.status,
      responseTime,
    });
  } catch (error) {
    const endTime = performance.now();
    const responseTime = Math.round(endTime - startTime);

    let errorMessage = error instanceof Error ? error.message : String(error);

    // Handle specific error types with more detailed messages
    if (error instanceof Error) {
      if (error.name === "AbortError") {
        errorMessage = "Request timeout (10s)";
      } else if (
        error.name === "TypeError" &&
        error.message.includes("fetch")
      ) {
        errorMessage = "Network error - unable to connect";
      } else if ("code" in error) {
        const nodeError = error as NodeJS.ErrnoException;
        switch (nodeError.code) {
          case "ENOTFOUND":
            errorMessage = "DNS resolution failed";
            break;
          case "ECONNREFUSED":
            errorMessage = "Connection refused";
            break;
          case "ECONNRESET":
            errorMessage = "Connection reset by peer";
            break;
          case "ETIMEDOUT":
            errorMessage = "Connection timeout";
            break;
          case "CERT_HAS_EXPIRED":
            errorMessage = "SSL certificate expired";
            break;
          case "UNABLE_TO_VERIFY_LEAF_SIGNATURE":
            errorMessage = "SSL certificate verification failed";
            break;
        }
      }
    }

    result = {
      url,
      status: "DOWN",
      code: null,
      responseTime,
      checkedAt: new Date().toISOString(),
      error: errorMessage,
    };

    logger.error("Website check failed", {
      url,
      error: errorMessage,
      responseTime,
      originalError:
        error instanceof Error ? (error as any).code || error.name : "Unknown",
    });
  }

  // Ensure result is defined before proceeding
  if (!result) {
    logger.error("🔍 CHECKER: Result is undefined, creating fallback result");
    result = {
      url,
      status: "DOWN",
      code: null,
      responseTime: 0,
      checkedAt: new Date().toISOString(),
      error: "Unknown error occurred during check",
    };
  }

  // At this point, result is guaranteed to be assigned
  logger.info("🔍 CHECKER: About to update status store and emit results", {
    url,
    status: result.status,
  });

  try {
    // Update the in-memory status store
    logger.info("🔍 CHECKER: Updating status store");
    logger.info("🔍 CHECKER: Result object:", { result });

    // Status store will be updated by the alerter step after comparison
    logger.info(
      "🔍 CHECKER: Skipping status store update - will be handled by alerter"
    );

    // Emit to check.result topic for alerter
    try {
      logger.info("🔍 CHECKER: Emitting check.result for alerter", {
        url,
        status: result.status,
      });
      logger.info("🔍 CHECKER: About to call emit with:", {
        topic: "check.result",
        result,
      });
      await emit({ topic: "check.result", data: result });
      logger.info("🔍 CHECKER: Successfully emitted check.result");
    } catch (checkResultError) {
      const errorMsg =
        checkResultError instanceof Error
          ? checkResultError.message
          : String(checkResultError);
      const errorStack =
        checkResultError instanceof Error ? checkResultError.stack : undefined;
      logger.error("🔍 CHECKER: Failed to emit check.result", {
        error: errorMsg,
        stack: errorStack,
      });
    }

    // Emit to status.stream topic for terminal alerts and monitoring
    try {
      logger.info("🔍 CHECKER: Emitting status.stream for monitoring", {
        url,
        status: result.status,
      });

      await emit({ topic: "status.stream", data: result });
      logger.info("🔍 CHECKER: Successfully emitted status.stream");
    } catch (statusStreamError) {
      const errorMsg =
        statusStreamError instanceof Error
          ? statusStreamError.message
          : String(statusStreamError);
      const errorStack =
        statusStreamError instanceof Error
          ? statusStreamError.stack
          : undefined;
      logger.error("🔍 CHECKER: Failed to emit status.stream", {
        error: errorMsg,
        stack: errorStack,
      });
    }

    logger.info("🔍 CHECKER: All operations completed successfully", {
      url,
      status: result.status,
    });
  } catch (emitError) {
    const errorMsg =
      emitError instanceof Error ? emitError.message : String(emitError);
    const errorStack = emitError instanceof Error ? emitError.stack : undefined;
    logger.error("🔍 CHECKER: Error in post-check operations", {
      url,
      error: errorMsg,
      stack: errorStack,
    });
    // Don't throw - we want to continue even if emit fails
  }
};
