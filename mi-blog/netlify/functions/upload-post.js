// netlify/functions/upload-post.js
// Función para crear nuevas publicaciones

const fs = require('fs').promises;
const path = require('path');

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
        // Parsear datos del post
        const postData = JSON.parse(event.body);
        
        // Validar campos requeridos
        const camposRequeridos = ['titulo', 'descripcion', 'categoria', 'archivo', 'tipo'];
        for (const campo of camposRequeridos) {
            if (!postData[campo]) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ 
                        error: `Campo requerido faltante: ${campo}` 
                    })
                };
            }
        }

        // Validar longitud de campos
        if (postData.titulo.length > 100) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'El título no puede exceder 100 caracteres' })
            };
        }

        if (postData.descripcion.length > 500) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'La descripción no puede exceder 500 caracteres' })
            };
        }

        // Generar ID único
        const postId = generateId();
        
        // Crear objeto del post
        const nuevoPost = {
            id: postId,
            titulo: postData.titulo.trim(),
            descripcion: postData.descripcion.trim(),
            categoria: postData.categoria,
            archivo: postData.archivo,
            tipo: postData.tipo,
            fecha: postData.fecha || new Date().toISOString(),
            thumbnail: postData.thumbnail || null
        };

        // Leer posts existentes
        const postsPath = path.join(process.cwd(), 'data', 'posts.json');
        let posts = [];
        
        try {
            const contenido = await fs.readFile(postsPath, 'utf8');
            posts = JSON.parse(contenido);
            
            // Asegurar que posts sea un array
            if (!Array.isArray(posts)) {
                posts = [];
            }
        } catch (error) {
            // Si no existe el archivo o está corrupto, crear array vacío
            console.log('Creando nuevo archivo posts.json');
            posts = [];
        }

        // Agregar nuevo post al inicio (más reciente primero)
        posts.unshift(nuevoPost);

        // Limitar a máximo 100 posts para evitar que crezca indefinidamente
        if (posts.length > 100) {
            posts = posts.slice(0, 100);
        }

        // Asegurar que el directorio existe
        const dataDir = path.join(process.cwd(), 'data');
        try {
            await fs.mkdir(dataDir, { recursive: true });
        } catch (error) {
            // Directorio ya existe
        }

        // Guardar posts actualizados
        await fs.writeFile(postsPath, JSON.stringify(posts, null, 2));

        return {
            statusCode: 201,
            headers,
            body: JSON.stringify({ 
                success: true,
                id: postId,
                post: nuevoPost,
                message: 'Post creado exitosamente'
            })
        };

    } catch (error) {
        console.error('Error al crear post:', error);
        
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                error: 'Error interno del servidor',
                details: process.env.NODE_ENV === 'development' ? error.message : 'Error procesando solicitud'
            })
        };
    }
};

// Función para generar ID único
function generateId() {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `post_${timestamp}_${random}`;
}
