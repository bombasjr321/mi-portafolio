// netlify/functions/upload-post.js
// Actualiza posts.json via GitHub API

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
        const postData = JSON.parse(event.body);
        
        // Validar campos requeridos
        const camposRequeridos = ['titulo', 'descripcion', 'categoria', 'archivo', 'tipo'];
        for (const campo of camposRequeridos) {
            if (!postData[campo]) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ error: `Campo faltante: ${campo}` })
                };
            }
        }

        // Generar nuevo post
        const nuevoPost = {
            id: generateId(),
            titulo: postData.titulo.trim(),
            descripcion: postData.descripcion.trim(),
            categoria: postData.categoria,
            archivo: postData.archivo,
            tipo: postData.tipo,
            fecha: new Date().toISOString(),
            thumbnail: postData.thumbnail || null
        };

        // Obtener posts actuales desde GitHub
        const currentPosts = await obtenerPostsDesdeGitHub();
        
        // Agregar nuevo post al inicio
        currentPosts.unshift(nuevoPost);
        
        // Limitar a 100 posts
        if (currentPosts.length > 100) {
            currentPosts.length = 100;
        }

        // Actualizar archivo en GitHub
        await actualizarPostsEnGitHub(currentPosts);

        return {
            statusCode: 201,
            headers,
            body: JSON.stringify({
                success: true,
                id: nuevoPost.id,
                message: 'Post creado y actualizado en GitHub'
            })
        };

    } catch (error) {
        console.error('Error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: 'Error interno',
                details: error.message
            })
        };
    }
};

// Función para obtener posts desde GitHub
async function obtenerPostsDesdeGitHub() {
    const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
    const REPO_OWNER = process.env.GITHUB_OWNER; // tu-usuario
    const REPO_NAME = process.env.GITHUB_REPO;   // nombre-repo
    
    if (!GITHUB_TOKEN || !REPO_OWNER || !REPO_NAME) {
        throw new Error('Faltan variables de entorno de GitHub');
    }

    const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/data/posts.json`;
    
    try {
        const response = await fetch(url, {
            headers: {
                'Authorization': `token ${GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });

        if (!response.ok) {
            if (response.status === 404) {
                // Archivo no existe, devolver array vacío
                return [];
            }
            throw new Error(`GitHub API error: ${response.status}`);
        }

        const data = await response.json();
        const content = Buffer.from(data.content, 'base64').toString();
        return JSON.parse(content);
        
    } catch (error) {
        console.log('Error obteniendo posts, devolviendo array vacío:', error.message);
        return [];
    }
}

// Función para actualizar posts en GitHub
async function actualizarPostsEnGitHub(posts) {
    const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
    const REPO_OWNER = process.env.GITHUB_OWNER;
    const REPO_NAME = process.env.GITHUB_REPO;
    
    const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/data/posts.json`;
    
    // Primero obtener el SHA actual del archivo
    let sha = null;
    try {
        const currentFile = await fetch(url, {
            headers: {
                'Authorization': `token ${GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });
        
        if (currentFile.ok) {
            const fileData = await currentFile.json();
            sha = fileData.sha;
        }
    } catch (error) {
        // Archivo no existe, sha será null
    }

    // Actualizar o crear archivo
    const content = JSON.stringify(posts, null, 2);
    const encodedContent = Buffer.from(content).toString('base64');

    const body = {
        message: `Agregar nuevo post: ${posts[0]?.titulo || 'Sin título'}`,
        content: encodedContent,
        ...(sha && { sha }) // Solo incluir SHA si existe
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
        const error = await response.text();
        throw new Error(`Error actualizando GitHub: ${response.status} - ${error}`);
    }

    return await response.json();
}

// Generar ID único
function generateId() {
    return `post_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}
