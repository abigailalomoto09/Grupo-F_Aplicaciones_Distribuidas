const { createLogger, format, transports } = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');

const logDir = path.join(__dirname, '..', 'logs');

/* Configurar el transporte con rotación diaria */
const dailyRotateTransport = new DailyRotateFile({
    filename: 'application-%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    dirname: logDir,
    zipArchive: true,
    maxSize: '20m',
    maxFiles: '14d'
});

/* Crear el logger con la configuración de Lab4_Logs */
const logger = createLogger({
    level: 'info',
    format: format.combine(
        format.timestamp(),
        format.printf(({ timestamp, level, message }) =>
            `${timestamp} [${level.toUpperCase()}]: ${message}`
        )
    ),
    transports: [
        new transports.Console(),
        dailyRotateTransport,
        new transports.File({
            filename: path.join(logDir, 'errors.log'),
            level: 'error'
        })
    ]
});

// Funciones de compatibilidad para el servidor del juego (server.js)
function trace(event, message, meta) {
    logger.silly(`[${event}] ${message} ${meta ? JSON.stringify(meta) : ''}`);
}
function debug(event, message, meta) {
    logger.debug(`[${event}] ${message} ${meta ? JSON.stringify(meta) : ''}`);
}
function info(event, message, meta) {
    logger.info(`[${event}] ${message} ${meta ? JSON.stringify(meta) : ''}`);
}
function warn(event, message, meta) {
    logger.warn(`[${event}] ${message} ${meta ? JSON.stringify(meta) : ''}`);
}
function error(event, message, meta) {
    logger.error(`[${event}] ${message} ${meta ? JSON.stringify(meta) : ''}`);
}
function fatal(event, message, meta) {
    logger.error(`[FATAL] [${event}] ${message} ${meta ? JSON.stringify(meta) : ''}`);
}

module.exports = {
    logger,
    trace,
    debug,
    info,
    warn,
    error,
    fatal
};
