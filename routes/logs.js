const express = require("express");
const fs = require("fs");
const path = require("path");

const router = express.Router();

router.get("/resumen", (req, res) => {
  try {
    const logsDir = path.join(__dirname, "..", "logs");
    const files = fs.readdirSync(logsDir);

    const logFiles = files
      .filter((file) => file.endsWith(".log"))
      .map((file) => {
        const filePath = path.join(logsDir, file);
        const stats = fs.statSync(filePath);

        return {
          file,
          filePath,
          mtimeMs: stats.mtimeMs
        };
      })
      .sort((a, b) => b.mtimeMs - a.mtimeMs);

    if (logFiles.length === 0) {
      return res.json({});
    }

    const latestLogPath = logFiles[0].filePath;
    const content = fs.readFileSync(latestLogPath, "utf-8");
    const lines = content.split("\n").filter(Boolean);

    const resumen = {
      INFO: 0,
      ERROR: 0,
      WARN: 0,
      DEBUG: 0,
      TRACE: 0,
      FATAL: 0,
      HTTP: 0
    };

    lines.forEach((line) => {
      let parsedLine = null;

      try {
        parsedLine = JSON.parse(line);
      } catch (error) {
        parsedLine = null;
      }

      if (parsedLine && parsedLine.level) {
        const level = String(parsedLine.level).toUpperCase();
        if (Object.prototype.hasOwnProperty.call(resumen, level)) {
          resumen[level]++;
        }
        return;
      }

      const match = line.match(/\[(TRACE|DEBUG|INFO|WARN|ERROR|FATAL|HTTP)\]/i);
      if (match) {
        const level = match[1].toUpperCase();
        if (Object.prototype.hasOwnProperty.call(resumen, level)) {
          resumen[level]++;
        }
      }
    });

    res.json(resumen);
  } catch (error) {
    res.status(500).json({
      error: "No fue posible generar el resumen de logs."
    });
  }
});

module.exports = router;
