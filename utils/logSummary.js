const fs = require('fs');
const path = require('path');

// Carpeta de logs relativa a la ubicación de este script
const logsDir = path.join(__dirname, '..', 'logs');

function analyzeLogs() {
    let accessesLobby = 0;
    let accessesGame = 0;
    let infoCount = 0;
    let errorCount = 0;

    try {
        if (!fs.existsSync(logsDir)) {
            console.log("No existe la carpeta de logs.");
            return;
        }

        // Listar todos los archivos .log
        const files = fs.readdirSync(logsDir).filter(file => file.endsWith('.log'));
        
        for (const file of files) {
            const filePath = path.join(logsDir, file);
            const content = fs.readFileSync(filePath, 'utf8');
            const lines = content.split('\n');

            for (const line of lines) {
                if (!line.trim()) continue;
                
                try {
                    // Intentar parsear como JSON estructurado (formato actual)
                    const log = JSON.parse(line);
                    
                    // Contar niveles de logs
                    if (log.level) {
                        const level = log.level.toLowerCase();
                        if (level === 'info') infoCount++;
                        if (level === 'error') errorCount++;
                    }

                    // Contar accesos de peticiones HTTP
                    if (log.event === 'HTTP_REQUEST' && log.meta && log.meta.url) {
                        const url = log.meta.url;
                        if (url === '/lobby') {
                            accessesLobby++;
                        } else if (url === '/game') {
                            accessesGame++;
                        }
                    }
                } catch (e) {
                    // Fallback para logs antiguos en texto plano
                    const levelMatch = line.match(/\[(INFO|ERROR)\]/i);
                    if (levelMatch) {
                        const lvl = levelMatch[1].toLowerCase();
                        if (lvl === 'info') infoCount++;
                        if (lvl === 'error') errorCount++;
                    }
                    
                    if (line.includes('/lobby')) accessesLobby++;
                    if (line.includes('/game')) accessesGame++;
                }
            }
        }

        // Mostrar salida en consola según formato solicitado
        console.log(`Accesos a lobby: ${accessesLobby}`);
        console.log(`Accesos a game: ${accessesGame}`);
        console.log(`INFO: ${infoCount}`);
        console.log(`ERROR: ${errorCount}`);

    } catch (err) {
        console.error("Error al analizar los logs:", err.message);
    }
}

analyzeLogs();
