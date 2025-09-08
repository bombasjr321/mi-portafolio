// netlify/functions/upload-file.js
// Función para subir archivos SIN dependencias externas

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

exports.handler = async (event, context) => {
    // Manejar CORS
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
    };

    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: ''
        };
    }

    // Solo permitir POST
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Método no permitido' })
        };
    }

    try {
        // Para simplicidad, vamos a usar base64 en lugar de multipart
        // El frontend enviará: { filename, content, contentType }
        const requestData = JSON.parse(event.body);
        
        if (!requestData.filename || !requestData.content || !requestData.contentType) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ 
                    error: 'Faltan datos requeridos: filename, content, contentType' 
                })
            };
        }

        // Decodificar base64
        const fileBuffer = Buffer.from(requestData.content, 'base64');
        
        // Validar tamaño (50MB máximo)
        const maxSize = 50 * 1024 * 1024; // 50MB
        if (fileBuffer.length > maxSize) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Archivo demasiado grande. Máximo 50MB.' })
            };
        }

        // Validar tipo de archivo
        const tiposPermitidos = [
            'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif',
            'video/mp4', 'video/mov', 'video/avi', 'video/webm', 'video/quicktime'
        ];
        
        if (!tiposPermitidos.includes(requestData.contentType)) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ 
                    error: 'Tipo de archivo no permitido',
                    permitidos: 'JPG, PNG, WebP, GIF, MP4, MOV, AVI, WebM'
                })
            };
        }

        // Generar nombre único para el archivo
        const extension = obtenerExtension(requestData.filename, requestData.contentType);
        const nombreUnico = generarNombreUnico(extension);
        
        // Determinar carpeta según tipo
        const esVideo = requestData.contentType.startsWith('video/');
        const carpeta = esVideo ? 'videos' : 'fotos';
        
        // Crear directorios si no existen
        const mediaDir = path.join(process.cwd(), 'public', 'media', 'trabajos', carpeta);
        await fs.mkdir(mediaDir, { recursive: true });
        
        // Guardar archivo
        const rutaArchivo = path.join(mediaDir, nombreUnico);
        await fs.writeFile(rutaArchivo, fileBuffer);
        
        // Crear URL pública
        const urlPublica = `/media/trabajos/${carpeta}/${nombreUnico}`;
        
        // Registrar subida en log
        await registrarSubida({
            archivo: nombreUnico,
            tipo: requestData.contentType,
            tamaño: fileBuffer.length,
            fecha: new Date().toISOString()
        });

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                url: urlPublica,
                filename: nombreUnico,
                size: fileBuffer.length,
                type: requestData.contentType,
                message: 'Archivo subido exitosamente'
            })
        };

    } catch (error) {
        console.error('Error subiendo archivo:', error);
        
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: 'Error interno del servidor',
                details: process.env.NODE_ENV === 'development' ? error.message : 'Error procesando archivo'
            })
        };
    }
};

// Función para generar nombre único
function generarNombreUnico(extension) {
    const timestamp = Date.now();
    const random = crypto.randomBytes(8).toString('hex');
    return `${timestamp}_${random}${extension}`;
}

// Función para obtener extensión correcta
function obtenerExtension(filename, contentType) {
    if (filename && filename.includes('.')) {
        return '.' + filename.split('.').pop().toLowerCase();
    }
    
    // Fallback basado en content type
    const extensiones = {
        'image/jpeg': '.jpg',
        'image/jpg': '.jpg',
        'image/png': '.png',
        'image/webp': '.webp',
        'image/gif': '.gif',
        'video/mp4': '.mp4',
        'video/mov': '.mov',
        'video/quicktime': '.mov',
        'video/avi': '.avi',
        'video/webm': '.webm'
    };
    
    return extensiones[contentType] || '.bin';
}

// Función para registrar subidas (log simple)
async function registrarSubida(datos) {
    try {
        const logPath = path.join(process.cwd(), 'data', 'upload-log.json');
        let logs = [];
        
        try {
            const contenido = await fs.readFile(logPath, 'utf8');
            logs = JSON.parse(contenido);
        } catch (error) {
            // Archivo no existe, crear nuevo
        }
        
        logs.unshift(datos);
        
        // Mantener solo los últimos 1000 registros
        if (logs.length > 1000) {
            logs = logs.slice(0, 1000);
        }
        
        await fs.writeFile(logPath, JSON.stringify(logs, null, 2));
    } catch (error) {
        console.error('Error registrando subida:', error);
    }
}
