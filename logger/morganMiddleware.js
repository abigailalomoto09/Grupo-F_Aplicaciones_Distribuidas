const morgan = require('morgan');
const { logger } = require('./index');

// Configurar un stream para que morgan escriba con Winston
const stream = {
    write: (message) => logger.info(message.trim())
};

// Creamos el middleware de morgan con el formato personalizado de Lab4_Logs
const morganMiddleware = morgan(
    ':method :url :status :res[content-length] - :response-time ms',
    { stream }
);

module.exports = morganMiddleware;
