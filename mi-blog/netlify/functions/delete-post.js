// netlify/functions/delete-post.js
const GITHUB_API_BASE = 'https://api.github.com';

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Accept',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };
  
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers };

  try {
    if (!process.env.GITHUB_OWNER || !process.env.GITHUB_REPO || !process.env.GITHUB_TOKEN) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          error: 'Faltan variables de entorno GITHUB_OWNER/GITHUB_REPO/GITHUB_TOKEN'
        })
      };
    }

    // Parsear datos de la solicitud (POST, no DELETE)
    const payload = JSON.parse(event.body);
    const owner = process.env.GITHUB_OWNER;
    const repo = process.env.GITHUB_REPO;
    const token = process.env.GITHUB_TOKEN;
    const branch = process.env.GITHUB_BRANCH || 'main';

    if (!payload.id) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'ID del post requerido' })
      };
    }

    const postId = payload.id;

    // Buscar y leer posts.json (igual que upload-file)
    const candidatePaths = ['public/posts.json', 'data/posts.json'];
    let posts = [];
    let postsSha = null;
    let postsPathUsed = null;
    let postToDelete = null;

    for (const p of candidatePaths) {
      try {
        const getPostsResp = await fetch(
          `${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/${encodeURIComponent(p)}?ref=${branch}`,
          { headers: { Authorization: `Bearer ${token}`, 'User-Agent': 'netlify-function' } }
        );
        if (getPostsResp.ok) {
          const postsJson = await getPostsResp.json();
          postsSha = postsJson.sha;
          const decoded = Buffer.from(postsJson.content, 'base64').toString('utf8');
          posts = JSON.parse(decoded);
          if (!Array.isArray(posts)) posts = [];
          postsPathUsed = p;
          break;
        }
      } catch (err) {
        console.warn(`No se pudo leer ${p}:`, err.message);
      }
    }

    if (!postsPathUsed) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'No se encontró posts.json' })
      };
    }

    // Buscar el post a eliminar
    const postIndex = posts.findIndex(p => String(p.id) === String(postId));
    
    if (postIndex === -1) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Post no encontrado' })
      };
    }

    // Guardar referencia del post antes de eliminarlo
    postToDelete = posts[postIndex];
    
    // Eliminar del array
    posts.splice(postIndex, 1);

    // Actualizar posts.json en GitHub
    const updatedPostsContent = Buffer.from(
      JSON.stringify(posts, null, 2),
      'utf8'
    ).toString('base64');

    const commitResp = await fetch(
      `${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/${encodeURIComponent(postsPathUsed)}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'User-Agent': 'netlify-function',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: `Delete post: ${postToDelete.title || postToDelete.id}`,
          content: updatedPostsContent,
          branch,
          sha: postsSha
        })
      }
    );

    if (!commitResp.ok) {
      const txt = await commitResp.text();
      console.error('Error actualizando posts.json:', commitResp.status, txt);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Error actualizando posts.json', detail: txt })
      };
    }

    // OPCIONAL: Eliminar archivo físico de GitHub
    // Descomenta si quieres eliminar también la imagen/video
    /*
    try {
      await deleteFileFromGitHub(postToDelete.url || postToDelete.archivo, owner, repo, token, branch);
    } catch (err) {
      console.warn('No se pudo eliminar el archivo físico:', err.message);
    }
    */

    return {
      statusCode: 200,
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        message: 'Post eliminado exitosamente',
        deletedPost: {
          id: postToDelete.id,
          title: postToDelete.title || postToDelete.titulo
        },
        remainingPosts: posts.length
      })
    };

  } catch (err) {
    console.error('delete-post handler error:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message })
    };
  }
};

// Función opcional para eliminar archivo físico de GitHub
async function deleteFileFromGitHub(fileUrl, owner, repo, token, branch) {
  if (!fileUrl) return false;

  // Extraer path del archivo desde la URL
  // Ejemplo: https://raw.githubusercontent.com/user/repo/main/public/media/trabajos/fotos/file.jpg
  const urlParts = fileUrl.split(`${owner}/${repo}/${branch}/`);
  if (urlParts.length < 2) return false;
  
  const filePath = urlParts[1];

  // Obtener SHA del archivo
  const getFileResp = await fetch(
    `${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/${encodeURIComponent(filePath)}?ref=${branch}`,
    { headers: { Authorization: `Bearer ${token}`, 'User-Agent': 'netlify-function' } }
  );

  if (!getFileResp.ok) return false;

  const fileData = await getFileResp.json();

  // Eliminar archivo
  const deleteResp = await fetch(
    `${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/${encodeURIComponent(filePath)}`,
    {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
        'User-Agent': 'netlify-function',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: `Delete file: ${filePath}`,
        sha: fileData.sha,
        branch
      })
    }
  );

  return deleteResp.ok;
}
