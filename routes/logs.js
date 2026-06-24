const express = require('express');
const fs = require('fs');
const path = require('path');
const { logger } = require('../logger');

// Se crea el router para agrupar las rutas relacionadas con logs.
const router = express.Router();
// Se define la carpeta donde se almacenan los archivos de log.
const logsDir = path.join(__dirname, '..', 'logs');

// Ruta GET /logs/resumen para devolver un resumen del archivo de log más reciente.
router.get('/resumen', (req, res) => {
    try {
        // Se listan los archivos dentro de /logs y se filtran solo los .log.
        const files = fs.readdirSync(logsDir)
            .filter(file => file.endsWith('.log'))
            // Se obtiene la ruta y la fecha de modificación de cada archivo.
            .map(file => {
                const filePath = path.join(logsDir, file);
                const stats = fs.statSync(filePath);

                return {
                    name: file,
                    path: filePath,
                    lastModified: stats.mtime
                };
            })
            // Se ordenan del más reciente al más antiguo.
            .sort((a, b) => b.lastModified - a.lastModified);

        // Si no hay archivos de log, se responde con un error controlado.
        if (files.length === 0) {
            logger.warn('No existen archivos de log para resumir');
            return res.status(404).json({ mensaje: 'No existen archivos de log' });
        }

        // Se toma el archivo más reciente para analizar su contenido.
        const latestLog = files[0];
        // Se lee el archivo completo como texto.
        const content = fs.readFileSync(latestLog.path, 'utf8');
        // Se inicializa el objeto que almacenará el conteo por nivel de log.
        const resumen = {};

        // Se recorre cada línea del archivo para identificar el tipo de log.
        content.split('\n').forEach(line => {
            const match = line.match(/\[(\w+)\]:/);

            // Si la línea contiene un nivel válido, se incrementa su contador.
            if (match) {
                const level = match[1];
                resumen[level] = (resumen[level] || 0) + 1;
            }
        });

        // Se registra en el logger qué archivo se usó para construir el resumen.
        logger.info(`Resumen generado desde el archivo: ${latestLog.name}`);
        // Se devuelve el resumen final en formato JSON.
        res.json(resumen);
    } catch (error) {
        logger.error(`Error al generar el resumen de logs: ${error.message}`);
        res.status(500).json({ mensaje: 'Error al generar el resumen de logs' });
    }
});

module.exports = router;
