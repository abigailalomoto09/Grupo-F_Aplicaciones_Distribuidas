const mongoose = require("mongoose");

const LogEntrySchema = new mongoose.Schema(
  {
    level: {
      type: String,
      enum: ["TRACE", "DEBUG", "INFO", "WARN", "ERROR", "FATAL"],
      required: true,
      index: true
    },
    event: {
      type: String,
      required: true,
      index: true
    },
    message: {
      type: String,
      required: true
    },
    meta: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    source: {
      type: String,
      default: "server"
    }
  },
  { timestamps: true }
);

LogEntrySchema.index({ createdAt: -1 });
LogEntrySchema.index({ level: 1, event: 1, createdAt: -1 });

module.exports = mongoose.model("LogEntry", LogEntrySchema);
