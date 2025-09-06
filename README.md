# Motia Uptime Monitor

A comprehensive uptime monitoring system built with **Motia** - demonstrating the power of unified backend development through the innovative **stepped approach**.

## 🚀 What is Motia?

Motia is a revolutionary framework that unifies what traditionally required 5+ different tools: APIs, background jobs, workflows, real-time streams, AI agents, and state management - all with built-in observability and multi-language support.

## 🔧 How Motia's Stepped Approach Works

Similar to how React simplified frontend development where "everything is a component," Motia simplifies backend development where **"everything is a Step."**

### Core Concept: Steps as Universal Backend Primitives

Steps are composable units that handle any backend pattern with unified state, events, and observability. Think of them as backend building blocks that can be chained together to create complex workflows.

```
🌐 API Step → ⚡ Event Step → ⏰ Cron Step → ⚡ Event Step
    ↓              ↓              ↓              ↓
 HTTP Request → Process Data → Schedule Task → Send Alert
```

### The Three Step Types

#### 🌐 **API Steps** - HTTP Endpoints & REST APIs

Transform any function into a production-ready API endpoint with automatic validation, error handling, and observability.

```typescript
export const config = {
  type: "api",
  method: "GET",
  path: "/health",
  emits: ["health.checked"],
};

export const handler = async (req, { logger, emit }) => {
  logger.info("Health check requested");

  await emit({
    topic: "health.checked",
    data: { status: "ok", timestamp: new Date() },
  });

  return { status: 200, body: { message: "System healthy" } };
};
```

#### ⚡ **Event Steps** - Background Processing & Workflows

React to events from other steps. Handle business logic, data processing, AI workflows, and complex orchestration.

```typescript
export const config = {
  type: "event",
  subscribes: ["check.result"],
  emits: ["alert.sent"],
};

export const handler = async (input, { logger, emit }) => {
  // Process website check results
  if (input.status === "DOWN") {
    console.log(`🔴 ALERT: ${input.url} is DOWN!`);

    await emit({
      topic: "alert.sent",
      data: { url: input.url, type: "downtime" },
    });
  }
};
```

#### ⏰ **Cron Steps** - Scheduled Jobs & Automation

Run tasks on schedules - from simple cleanups to complex data pipelines.

```typescript
export const config = {
  type: "cron",
  schedule: "*/1 * * * *", // Every minute
  emits: ["check.requested"],
};

export const handler = async (input, { logger, emit }) => {
  const sites = ["https://example.com", "https://google.com"];

  for (const url of sites) {
    await emit({
      topic: "check.requested",
      data: { url },
    });
  }
};
```

## 🔄 How Steps Connect: Event-Driven Architecture

Steps communicate through **topics** - when one step emits an event, other steps can subscribe and react. This creates powerful data pipelines:

```
Cron Step          Event Step           Event Step
    ↓                  ↓                    ↓
schedule     →   check.requested   →   check.result   →   Terminal Alert
  timer           (HTTP Check)         (Status Change)      (Notification)
```

### Real Example from Our Uptime Monitor:

1. **Cron Step** (`cron.step.ts`) - Triggers every minute

   ```typescript
   emits: ["check.requested"];
   ```

2. **Checker Step** (`checker.step.ts`) - Performs HTTP checks

   ```typescript
   subscribes: ["check.requested"];
   emits: ["check.result", "status.stream"];
   ```

3. **Alerter Step** (`alerter.step.ts`) - Shows terminal notifications

   ```typescript
   subscribes: ["check.result"];
   ```

4. **API Steps** - Provide REST endpoints for metrics and history

## 🏗️ Project Structure

```
motia-demo/
├── steps/                    # All business logic as Steps
│   ├── cron.step.ts         # ⏰ Scheduled website checks
│   ├── checker.step.ts      # ⚡ HTTP health checks
│   ├── alerter.step.ts      # ⚡ Terminal notifications
│   ├── health.step.ts       # 🌐 API: System health
│   ├── metrics.step.ts      # 🌐 API: Monitoring metrics
│   └── history.step.ts      # 🌐 API: Historical data
├── lib/                     # Shared utilities
│   ├── types.ts            # TypeScript definitions
│   ├── env.ts              # Environment configuration
│   ├── stream.ts           # Data persistence & metrics
│   └── rate-limiter.ts     # Rate limiting logic
├── motia-workbench.json    # Motia configuration
└── .env                    # Environment variables
```

## ✨ Key Features of This Implementation

### 🎯 **Unified Backend Patterns**

- **API Endpoints**: `/health`, `/metrics`, `/history/:url`
- **Background Jobs**: Automated website checking
- **Scheduled Tasks**: Cron-based monitoring
- **Real-time Alerts**: Terminal notifications with colors
- **State Management**: Persistent status tracking

### 🌍 **Multi-Language Ready**

While this demo uses TypeScript, Motia supports:

- **TypeScript** for APIs and business logic
- **Python** for AI/ML processing
- **JavaScript** for frontend integration
- All languages share the same state and events seamlessly

### 📊 **Built-in Observability**

- **Real-time Flow Visualization** via Motia Workbench
- **Request Tracing** across all steps
- **Structured Logging** with context
- **Performance Metrics** automatically tracked
- **Error Handling** with detailed stack traces

### 🔄 **Event-Driven Architecture**

```
check.requested → HTTP Check → check.result → Terminal Alert
                              ↓
                          status.stream → Real-time Updates
```

## 🚦 How It Works: Step by Step

### 1. **Initialization**

```bash
motia dev  # Starts the Motia runtime + Workbench
```

### 2. **Cron Triggers** (Every minute)

```typescript
// cron.step.ts emits events for each site
emit({ topic: "check.requested", data: { url: "https://example.com" } });
```

### 3. **HTTP Checks** (Event-driven)

```typescript
// checker.step.ts receives events and performs HTTP requests
const response = await fetch(url);
emit({ topic: "check.result", data: { url, status: "UP", responseTime: 150 } });
```

### 4. **Status Processing** (Event-driven)

```typescript
// alerter.step.ts receives results and shows terminal notifications
if (currentStatus !== previousStatus) {
  console.log(`🟢 ${url} is back UP! (Response: ${responseTime}ms)`);
}
```

### 5. **API Access** (HTTP endpoints)

```bash
curl http://localhost:8080/health
curl http://localhost:8080/metrics
curl http://localhost:8080/history/https%3A%2F%2Fexample.com
```

## 🎮 Getting Started

### Prerequisites

- Node.js 18+
- npm or pnpm

### Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/debarshee2004/motia-demo.git
   cd motia-demo
   ```

2. **Install dependencies**

   ```bash
   pnpm install
   ```

3. **Configure environment**

   ```bash
   cp .env.example .env
   # Edit .env with your websites to monitor
   ```

4. **Start the monitoring system**

   ```bash
   motia dev
   ```

5. **View the Workbench** (Optional)
   Open `http://localhost:3000` to see real-time flow visualization

## ⚙️ Configuration

### Environment Variables

```bash
# Required: Websites to monitor (JSON array)
SITES=["https://example.com", "https://google.com", "https://github.com"]

# Optional: Check frequency (cron expression)
CHECK_INTERVAL_CRON=*/1 * * * *  # Every minute

# Optional: Rate limiting
ALERT_BURST=3                    # Max 3 alerts per window
ALERT_WINDOW_SEC=300            # 5-minute window

# Optional: Request configuration
TIMEOUT_MS=10000                # 10-second timeout
RETRY_ATTEMPTS=1                # Retry once on failure
CHECK_CERTIFICATES=false        # Skip SSL validation
```

### Cron Schedule Examples

```bash
*/30 * * * * *    # Every 30 seconds
*/5 * * * *       # Every 5 minutes
0 */2 * * *       # Every 2 hours
0 9 * * MON-FRI   # Weekdays at 9 AM
```

## 📈 Monitoring Output

### Terminal Notifications

#### Status Change Alerts

```bash
🔴═══════════════════════════════════════════════════════════════
🚨 WEBSITE STATUS CHANGE DETECTED
🔴═══════════════════════════════════════════════════════════════

🔴 Website: https://example.com
📊 Status: UP → DOWN
⏱️  Response Time: 5000ms
🌐 HTTP Status Code: 500
📅 Check Time: 9/6/2025, 2:30:15 PM
❌ Error: Internal Server Error

🔴═══════════════════════════════════════════════════════════════
```

#### Regular Status Updates

```bash
✅ [2:30:45 PM] https://google.com - UP (120ms)
✅ [2:30:46 PM] https://github.com - UP (89ms)
❌ [2:30:47 PM] https://example.com - DOWN (5000ms)
```

#### Rate Limiting

```bash
⏳ [RATE LIMITED] Status change for https://example.com (UP → DOWN) - Next alert available in 45s
```

### API Endpoints

#### System Health

```bash
GET /health
{
  "status": "ok",
  "sitesConfigured": 3,
  "lastKnown": { ... },
  "metrics": {
    "totalUptime": 95.5,
    "averageResponseTime": 156,
    "activeAlerts": 1
  }
}
```

#### Monitoring Metrics

```bash
GET /metrics
{
  "system": {
    "totalSites": 3,
    "upSites": 2,
    "downSites": 1,
    "overallUptimePercentage": 95.5
  },
  "sites": {
    "https://google.com": {
      "uptimePercentage": 99.8,
      "averageResponseTime": 120,
      "totalChecks": 1440
    }
  }
}
```

#### Historical Data

```bash
GET /history/https%3A%2F%2Fexample.com?limit=10
{
  "url": "https://example.com",
  "history": [
    {
      "status": "DOWN",
      "code": 500,
      "responseTime": 5000,
      "checkedAt": "2025-09-06T21:30:15.000Z",
      "error": "Internal Server Error"
    }
  ],
  "total": 10
}
```

## 🔧 Advanced Features

### Rate Limiting

Prevents notification spam during extended outages:

- **Configurable burst limit** (default: 3 alerts per 5 minutes)
- **Token bucket algorithm** for smooth rate limiting
- **Per-site tracking** to avoid cross-site interference

### Error Handling

Comprehensive error categorization:

- **DNS resolution failures** → "DNS resolution failed"
- **Connection timeouts** → "Connection timeout"
- **SSL certificate issues** → "SSL certificate expired"
- **Network errors** → "Network error - unable to connect"

### Data Persistence

File-based storage with metrics calculation:

- **Status history** for each monitored site
- **Performance metrics** (uptime %, avg response time)
- **System-wide statistics** across all sites
- **Automatic cleanup** of old records

## 🎯 Why Choose Motia?

### Traditional Approach

```
✗ Express.js for API endpoints
✗ node-cron for scheduling
✗ Redis for queues
✗ Winston for logging
✗ Socket.io for real-time updates
✗ Separate deployment for each service
✗ Complex observability setup
```

### Motia Approach

```
✅ One framework handles everything
✅ One config file per step
✅ One deployment command
✅ Built-in observability
✅ Multi-language support
✅ Real-time visualization
✅ Event-driven architecture
```

## 🚀 Deployment

### Local Development

```bash
motia dev
# → Workbench available at http://localhost:3000
# → API endpoints at http://localhost:8080
```

### Production (Motia Cloud)

```bash
motia cloud deploy --api-key <key> --version-name v1.0.0
# → Atomic deployments with one-click rollbacks
# → Multi-language builds handled automatically
# → Infrastructure abstraction - no cloud provider lock-in
```

### Self-Hosted

```bash
motia build
# → Generates deployable artifacts
# → Deploy to AWS, Kubernetes, or any cloud provider
```

## 🤝 Contributing

1. **Fork the repository**
2. **Create your feature branch** (`git checkout -b feature/amazing-feature`)
3. **Commit your changes** (`git commit -m 'Add amazing feature'`)
4. **Push to the branch** (`git push origin feature/amazing-feature`)
5. **Open a Pull Request**

## 📚 Learn More

- **[Motia Documentation](https://www.motia.dev/docs)** - Complete framework guide
- **[Core Concepts](https://www.motia.dev/docs/concepts)** - Deep dive into Steps, Flows, and State
- **[Examples](https://www.motia.dev/docs/examples)** - Real-world use cases
- **[Community](https://www.motia.dev/docs/community-resources)** - Get help and discuss

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
