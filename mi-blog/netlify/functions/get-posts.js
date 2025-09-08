// netlify/functions/get-posts.js
// Función para obtener todas las publicaciones

const fs = require('fs').promises;
const path = require('path');

exports.handler = async (event, context) => {
    // Manejar CORS
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, OPTIONS'
    };

    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: ''
        };
    }

    // Solo permitir GET
    if (event.httpMethod !== 'GET') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Método no permitido' })
        };
    }

    try {
        // Parsear parámetros de consulta
        const queryParams = event.queryStringParameters || {};
        const limite = parseInt(queryParams.limit) || null;
        const categoria = queryParams.categoria || null;
        const tipo = queryParams.tipo || null; // 'imagen' o 'video'

        // Leer posts desde el archivo
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
            // Si no existe el archivo, devolver array vacío
            console.log('Archivo posts.json no encontrado, devolviendo array vacío');
            posts = [];
        }

        // Filtrar por categoría si se especifica
        if (categoria && categoria !== 'todos') {
            posts = posts.filter(post => post.categoria === categoria);
        }

        // Filtrar por tipo si se especifica
        if (tipo && tipo !== 'todos') {
            posts = posts.filter(post => post.tipo === tipo);
        }

        // Ordenar por fecha (más recientes primero)
        posts.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

        // Limitar cantidad si se especifica
        if (limite && limite > 0) {
            posts = posts.slice(0, limite);
        }

        // Agregar metadatos útiles
        const metadata = {
            total: posts.length,
            categorias: [...new Set(posts.map(p => p.categoria))],
            tipos: [...new Set(posts.map(p => p.tipo))],
            ultimaActualizacion: posts.length > 0 ? posts[0].fecha : null
        };

        return {
            statusCode: 200,
            headers: {
                ...headers,
                'Content-Type': 'application/json',
                'Cache-Control': 'public, max-age=300' // Cache por 5 minutos
            },
            body: JSON.stringify({
                posts,
                metadata
            })
        };

    } catch (error) {
        console.error('Error al obtener posts:', error);
        
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                error: 'Error interno del servidor',
                posts: [],
                metadata: {
                    total: 0,
                    categorias: [],
                    tipos: [],
                    ultimaActualizacion: null
                }
            })
        };
    }
};

// Función helper para validar y limpiar posts
function validarPost(post) {
    return post && 
           post.id && 
           post.titulo && 
           post.descripcion && 
           post.categoria && 
           post.archivo && 
           post.tipo && 
           post.fecha;
}
