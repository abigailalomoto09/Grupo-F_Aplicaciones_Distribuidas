const jwt = require('jsonwebtoken');

// Middleware que protege las rutas usando JWT
function authMiddleware(req, res, next) {
    
    // Extraer el token del header Authorization
    const token = req.headers.authorization?.split(' ')[1];

    // Si no hay token, devolver un error
    if (!token) return res.status(401).json({ message: 'No autorizado' });

    try {
        // Verificar y codificar el token
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'nose1012');
        req.userId = decoded.id;
        next();
    } catch {
        // Si el token no es válido, devolver un error
        return res.status(403).json({ message: 'Token inválido' });
    }

}

// Exportar el middleware para usarlo en las rutas protegidas
module.exports = authMiddleware;
