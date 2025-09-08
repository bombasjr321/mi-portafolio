// netlify/functions/delete-post.js
// Función para eliminar publicaciones

const fs = require('fs').promises;
const path = require('path');

exports.handler = async (event, context) => {
    // Manejar CORS
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'DELETE, OPTIONS'
    };

    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: ''
        };
    }

    // Solo permitir DELETE
    if (event.httpMethod !== 'DELETE') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Método no permitido' })
        };
    }

    try {
        // Parsear datos de la solicitud
        const requestData = JSON.parse(event.body);
        
        // Validar que se proporcione el ID
        if (!requestData.id) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ 
                    error: 'ID del post requerido' 
                })
            };
        }

        const postId = requestData.id;

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
            // Si no existe el archivo, no hay nada que eliminar
            return {
                statusCode: 404,
                headers,
                body: JSON.stringify({ 
                    error: 'No se encontraron posts' 
                })
            };
        }

        // Buscar el post a eliminar
        const postIndex = posts.findIndex(post => post.id === postId);
        
        if (postIndex === -1) {
            return {
                statusCode: 404,
                headers,
                body: JSON.stringify({ 
                    error: 'Post no encontrado' 
                })
            };
        }

        // Obtener información del post antes de eliminarlo
        const postEliminado = posts[postIndex];

        // Eliminar el post del array
        posts.splice(postIndex, 1);

        // Guardar posts actualizados
        await fs.writeFile(postsPath, JSON.stringify(posts, null, 2));

        // TODO: Aquí podrías agregar lógica para eliminar el archivo físico
        // del storage si es necesario
        // await eliminarArchivo(postEliminado.archivo);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ 
                success: true,
                message: 'Post eliminado exitosamente',
                postEliminado: {
                    id: postEliminado.id,
                    titulo: postEliminado.titulo
                },
                totalPosts: posts.length
            })
        };

    } catch (error) {
        console.error('Error al eliminar post:', error);
        
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

// Función helper para eliminar archivos del storage (implementar según necesidad)
async function eliminarArchivo(urlArchivo) {
    try {
        // Aquí implementarías la lógica para eliminar el archivo
        // del servicio de storage que uses (Netlify Large Media, Cloudinary, etc.)
        
        // Ejemplo conceptual:
        // const filename = extraerNombreArchivo(urlArchivo);
        // await servicioStorage.delete(filename);
        
        console.log(`Archivo marcado para eliminación: ${urlArchivo}`);
        return true;
    } catch (error) {
        console.error('Error eliminando archivo:', error);
        return false;
    }
}

// Función helper para extraer nombre de archivo de URL
function extraerNombreArchivo(url) {
    try {
        const urlObj = new URL(url);
        return path.basename(urlObj.pathname);
    } catch (error) {
        return null;
    }
}
