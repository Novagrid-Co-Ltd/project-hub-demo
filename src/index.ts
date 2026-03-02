import express from "express";
import path from "path";
import { getConfig } from "./config.js";
import { logger } from "./utils/logger.js";
import healthRouter from "./routes/health.js";
import projectsRouter from "./routes/projects.js";
import membersRouter from "./routes/members.js";
import phasesRouter from "./routes/phases.js";
import milestonesRouter from "./routes/milestones.js";
import extractedItemsRouter from "./routes/extracted-items.js";
import projectMeetingsRouter from "./routes/project-meetings.js";
import extractRouter from "./routes/extract.js";

const app = express();
app.use(express.json());

// CORS
app.use((_req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Content-Type, X-API-Key, Authorization");
  res.header("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
  if (_req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }
  next();
});

// API Routes
app.use(healthRouter);
app.use(projectsRouter);
app.use(membersRouter);
app.use(phasesRouter);
app.use(milestonesRouter);
app.use(extractedItemsRouter);
app.use(projectMeetingsRouter);
app.use(extractRouter);

// Serve frontend static files
const frontendDist = path.resolve(__dirname, "..", "frontend", "dist");
app.use(express.static(frontendDist));

// SPA fallback: non-API routes serve index.html
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api")) {
    next();
    return;
  }
  res.sendFile(path.join(frontendDist, "index.html"), (err) => {
    if (err) next();
  });
});

// Global error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error("Unhandled error", { error: err.message, stack: err.stack });
  res.status(500).json({ ok: false, error: { code: "INTERNAL_ERROR", message: "Internal server error", step: "unknown" } });
});

const config = getConfig();
const server = app.listen(config.port, () => {
  logger.info(`Server started on port ${config.port}`);
});

// Graceful shutdown
function shutdown(signal: string) {
  logger.info(`Received ${signal}, shutting down gracefully`);
  server.close(() => {
    logger.info("Server closed");
    process.exit(0);
  });
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
