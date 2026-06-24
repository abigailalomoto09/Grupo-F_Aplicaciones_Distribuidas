const morgan = require('morgan');
const { logger } = require('./index');

// Configurar un stream para que morgan escriba con Winston de acuerdo al código de estado HTTP
const stream = {
    write: (message) => {
        const msg = message.trim();
        // Separamos el mensaje por espacios para extraer el código de estado (tercer elemento)
        const parts = msg.split(/\s+/);
        const status = parseInt(parts[2], 10);

        if (status >= 500) {
            logger.error(msg);
        } else if (status >= 400) {
            logger.warn(msg);
        } else {
            logger.info(msg);
        }
    }
};

// Creamos el middleware de morgan con el formato personalizado de Lab4_Logs
const morganMiddleware = morgan(
    ':method :url :status :res[content-length] - :response-time ms',
    { stream }
);

module.exports = morganMiddleware;
