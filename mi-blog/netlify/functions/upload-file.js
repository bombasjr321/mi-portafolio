// netlify/functions/upload-file.js
// Sube archivos a GitHub repository

exports.handler = async (event, context) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Método no permitido' })
        };
    }

    try {
        const { filename, content, contentType } = JSON.parse(event.body);
        
        if (!filename || !content || !contentType) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Faltan datos requeridos' })
            };
        }

        // Validar tamaño (GitHub tiene límite de 100MB, pero recomendamos 50MB)
        const estimatedSize = (content.length * 3) / 4; // base64 to bytes
        const maxSize = 50 * 1024 * 1024; // 50MB
        
        if (estimatedSize > maxSize) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Archivo demasiado grande. Máximo 50MB.' })
            };
        }

        // Validar tipo
        const tiposPermitidos = [
            'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif',
            'video/mp4', 'video/mov', 'video/avi', 'video/webm', 'video/quicktime'
        ];
        
        if (!tiposPermitidos.includes(contentType)) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Tipo de archivo no permitido' })
            };
        }

        // Generar nombre único
        const extension = obtenerExtension(filename, contentType);
        const nombreUnico = generarNombreUnico(extension);
        
        // Determinar carpeta
        const esVideo = contentType.startsWith('video/');
        const carpeta = esVideo ? 'videos' : 'fotos';
        const rutaArchivo = `public/media/trabajos/${carpeta}/${nombreUnico}`;

        // Subir archivo a GitHub
        await subirArchivoAGitHub(rutaArchivo, content, `Subir ${carpeta.slice(0, -1)}: ${nombreUnico}`);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                url: `/media/trabajos/${carpeta}/${nombreUnico}`,
                filename: nombreUnico,
                size: Math.round(estimatedSize),
                type: contentType,
                message: 'Archivo subido a GitHub exitosamente'
            })
        };

    } catch (error) {
        console.error('Error subiendo archivo:', error);
        
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: 'Error interno del servidor',
                details: error.message
            })
        };
    }
};

// Función para subir archivo a GitHub
async function subirArchivoAGitHub(rutaArchivo, contenidoBase64, mensaje) {
    const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
    const REPO_OWNER = process.env.GITHUB_OWNER;
    const REPO_NAME = process.env.GITHUB_REPO;
    
    if (!GITHUB_TOKEN || !REPO_OWNER || !REPO_NAME) {
        throw new Error('Faltan variables de entorno de GitHub');
    }

    const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${rutaArchivo}`;

    const body = {
        message: mensaje,
        content: contenidoBase64
    };

    const response = await fetch(url, {
        method: 'PUT',
        headers: {
            'Authorization': `token ${GITHUB_TOKEN}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Error GitHub API: ${response.status} - ${errorText}`);
    }

    return await response.json();
}

// Utilidades
function generarNombreUnico(extension) {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `${timestamp}_${random}${extension}`;
}

function obtenerExtension(filename, contentType) {
    if (filename && filename.includes('.')) {
        return '.' + filename.split('.').pop().toLowerCase();
    }
    
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
