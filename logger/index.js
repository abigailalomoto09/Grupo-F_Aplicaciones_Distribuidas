const fs = require("fs");
const path = require("path");
const morgan = require("morgan");
const mongoose = require("mongoose");
const winston = require("winston");
require("winston-daily-rotate-file");

const LogEntry = require("../models/LogEntry");

const customLevels = {
  levels: {
    fatal: 0,
    error: 1,
    warn: 2,
    info: 3,
    debug: 4,
    trace: 5
  },
  colors: {
    fatal: "red bold",
    error: "red",
    warn: "yellow",
    info: "green",
    debug: "blue",
    trace: "gray"
  }
};

const LEVELS = {
  TRACE: "trace",
  DEBUG: "debug",
  INFO: "info",
  WARN: "warn",
  ERROR: "error",
  FATAL: "fatal"
};

const logDir = path.join(__dirname, "..", "logs");
fs.mkdirSync(logDir, { recursive: true });

winston.addColors(customLevels.colors);

const fileFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

const consoleFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.colorize({ all: true }),
  winston.format.printf(({ timestamp, level, event, message, meta, stack, source }) => {
    const eventPart = event ? `[${event}] ` : "";
    const metaPart = meta && Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : "";
    const sourcePart = source ? ` (${source})` : "";
    const stackPart = stack ? `\n${stack}` : "";
    return `[${timestamp}] [${level}] ${eventPart}${message}${metaPart}${sourcePart}${stackPart}`;
  })
);

const baseLogger = winston.createLogger({
  levels: customLevels.levels,
  level: process.env.LOG_LEVEL || "trace",
  transports: [
    new winston.transports.DailyRotateFile({
      filename: path.join(logDir, "application-%DATE%.log"),
      datePattern: "YYYY-MM-DD",
      level: "trace",
      maxFiles: "14d",
      format: fileFormat
    }),
    new winston.transports.DailyRotateFile({
      filename: path.join(logDir, "error-%DATE%.log"),
      datePattern: "YYYY-MM-DD",
      level: "error",
      maxFiles: "30d",
      format: fileFormat
    }),
    new winston.transports.Console({
      level: process.env.LOG_LEVEL || "trace",
      format: consoleFormat
    })
  ],
  exitOnError: false
});

function normalizeLevel(level = "INFO") {
  const upper = String(level).toUpperCase();
  return Object.prototype.hasOwnProperty.call(LEVELS, upper) ? upper : "INFO";
}

function normalizeMeta(meta) {
  if (!meta || typeof meta !== "object") {
    return {};
  }

  return meta;
}

function writeToWinston(entry) {
  baseLogger.log({
    level: LEVELS[entry.level],
    message: entry.message,
    event: entry.event,
    meta: entry.meta,
    source: entry.source
  });
}

async function persistLog(entry) {
  if (mongoose.connection.readyState !== 1) {
    return;
  }

  try {
    await LogEntry.create(entry);
  } catch (error) {
    baseLogger.error("No se pudo guardar el log en MongoDB", {
      event: "LOGGER_PERSIST",
      meta: { message: error.message }
    });
  }
}

function logEvent(level, event, message, meta = {}) {
  const normalizedLevel = normalizeLevel(level);
  const entry = {
    level: normalizedLevel,
    event: String(event || "GENERAL"),
    message: String(message || ""),
    meta: normalizeMeta(meta),
    source: "server"
  };

  writeToWinston(entry);
  void persistLog(entry);
  return entry;
}

function trace(event, message, meta) {
  return logEvent("TRACE", event, message, meta);
}

function debug(event, message, meta) {
  return logEvent("DEBUG", event, message, meta);
}

function info(event, message, meta) {
  return logEvent("INFO", event, message, meta);
}

function warn(event, message, meta) {
  return logEvent("WARN", event, message, meta);
}

function error(event, message, meta) {
  return logEvent("ERROR", event, message, meta);
}

function fatal(event, message, meta) {
  return logEvent("FATAL", event, message, meta);
}

function classifyHttpLevel(status) {
  if (status >= 500) {
    return "error";
  }

  if (status >= 400) {
    return "warn";
  }

  return "info";
}

const httpLoggerMiddleware = morgan((tokens, req, res) => {
  const status = Number(tokens.status(req, res)) || 0;
  const payload = {
    method: tokens.method(req, res),
    url: tokens.url(req, res),
    status,
    responseTimeMs: Number(tokens["response-time"](req, res)) || 0,
    remoteAddr: tokens["remote-addr"](req, res),
    userAgent: tokens["user-agent"](req, res)
  };

  return JSON.stringify(payload);
}, {
  stream: {
    write: (line) => {
      try {
        const payload = JSON.parse(line);
        const level = classifyHttpLevel(payload.status);
        logEvent(level, "HTTP_REQUEST", `${payload.method} ${payload.url} ${payload.status}`, payload);
      } catch (error) {
        baseLogger.warn("No se pudo interpretar el log de Morgan", {
          event: "HTTP_REQUEST",
          meta: { message: error.message, raw: String(line).trim() }
        });
      }
    }
  }
});

async function getLogSummary({ limit = 25 } = {}) {
  const safeLimit = Math.max(1, Math.min(Number(limit) || 25, 100));
  const [total, byLevelRaw, byEventRaw, recent] = await Promise.all([
    LogEntry.countDocuments({}),
    LogEntry.aggregate([
      { $group: { _id: "$level", count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]),
    LogEntry.aggregate([
      { $group: { _id: "$event", count: { $sum: 1 } } },
      { $sort: { count: -1, _id: 1 } }
    ]),
    LogEntry.find({})
      .sort({ createdAt: -1 })
      .limit(safeLimit)
      .lean()
  ]);

  const byLevel = {
    TRACE: 0,
    DEBUG: 0,
    INFO: 0,
    WARN: 0,
    ERROR: 0,
    FATAL: 0
  };

  for (const item of byLevelRaw) {
    if (Object.prototype.hasOwnProperty.call(byLevel, item._id)) {
      byLevel[item._id] = item.count;
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    total,
    byLevel,
    byEvent: byEventRaw.map((item) => ({
      event: item._id,
      count: item.count
    })),
    recent
  };
}

async function getRecentLogs({ limit = 100, level } = {}) {
  const safeLimit = Math.max(1, Math.min(Number(limit) || 100, 500));
  const query = {};

  if (level) {
    query.level = normalizeLevel(level);
  }

  return LogEntry.find(query).sort({ createdAt: -1 }).limit(safeLimit).lean();
}

module.exports = {
  httpLoggerMiddleware,
  logEvent,
  trace,
  debug,
  info,
  warn,
  error,
  fatal,
  getLogSummary,
  getRecentLogs
};
