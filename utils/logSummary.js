const fs = require("fs");
const path = require("path");

const logsDir = path.join(__dirname, "..", "logs");

function readApplicationLogLines() {
  if (!fs.existsSync(logsDir)) {
    return [];
  }

  const files = fs
    .readdirSync(logsDir)
    .filter((file) => /^application-.*\.log$/i.test(file))
    .sort();

  return files.flatMap((file) => {
    const filePath = path.join(logsDir, file);
    const content = fs.readFileSync(filePath, "utf8");
    return content.split(/\r?\n/).filter(Boolean);
  });
}

function parseLine(line) {
  try {
    return JSON.parse(line);
  } catch {
    return null;
  }
}

function getRouteFromHttpLog(entry) {
  const meta = entry && typeof entry.meta === "object" && entry.meta !== null ? entry.meta : {};
  const url = String(meta.url || "");
  return url.split("?")[0];
}

function main() {
  const lines = readApplicationLogLines();

  let lobbyAccesses = 0;
  let gameAccesses = 0;
  let infoCount = 0;
  let errorCount = 0;

  for (const line of lines) {
    const entry = parseLine(line);
    if (!entry) {
      continue;
    }

    const level = String(entry.level || "").toLowerCase();
    if (level === "info") {
      infoCount++;
    } else if (level === "error") {
      errorCount++;
    }

    if (String(entry.event || "").toUpperCase() !== "HTTP_REQUEST") {
      continue;
    }

    const route = getRouteFromHttpLog(entry);
    if (route === "/lobby") {
      lobbyAccesses++;
    } else if (route === "/game") {
      gameAccesses++;
    }
  }

  console.log(`Accesos a lobby: ${lobbyAccesses}`);
  console.log(`Accesos a game: ${gameAccesses}`);
  console.log(`INFO: ${infoCount}`);
  console.log(`ERROR: ${errorCount}`);
}

main();
