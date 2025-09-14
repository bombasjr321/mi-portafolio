// netlify/functions/upload-post.js
const GITHUB_API_BASE = 'https://api.github.com';

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };
  
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    if (!process.env.GITHUB_OWNER || !process.env.GITHUB_REPO || !process.env.GITHUB_TOKEN) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'Faltan variables de entorno GITHUB_OWNER/GITHUB_REPO/GITHUB_TOKEN' }) };
    }

    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, headers, body: JSON.stringify({ error: 'Método no permitido' }) };
    }

    const payload = JSON.parse(event.body || '{}');
    const titulo = payload.titulo || payload.title || 'Sin título';
    const descripcion = payload.descripcion || payload.excerpt || '';
    const archivo = payload.archivo || payload.url || '';
    const tipo = payload.tipo || (archivo && (archivo.match(/\.mp4($|\?)/i) || archivo.includes('youtube')) ? 'video' : 'imagen');
    const categoria = payload.categoria || (tipo === 'video' ? 'video' : 'imagen');
    const thumbnail = payload.thumbnail || null;

    const owner = process.env.GITHUB_OWNER;
    const repo = process.env.GITHUB_REPO;
    const token = process.env.GITHUB_TOKEN;
    const candidatePaths = ['public/posts.json', 'data/posts.json'];
    
    let posts = [];
    let postsSha = null;
    let postsPathUsed = null;

    // Cargar posts.json existente
    for (const p of candidatePaths) {
      try {
        const getResp = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/${encodeURIComponent(p)}`, {
          headers: { Authorization: `Bearer ${token}`, 'User-Agent': 'netlify-function' }
        });
        if (getResp.ok) {
          const postsJson = await getResp.json();
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

    if (!postsPathUsed) postsPathUsed = 'data/posts.json';

    let postId;
    let isUpdate = false;

    // LÓGICA DE CREACIÓN VS EDICIÓN
    if (payload.id) {
      // MODO EDICIÓN: Buscar y actualizar post existente
      const foundIndex = posts.findIndex(p => 
        String(p.id) === String(payload.id) || 
        String(p.slug || '') === String(payload.id)
      );

      if (foundIndex >= 0) {
        // Actualizar post existente
        isUpdate = true;
        postId = posts[foundIndex].id;
        
        posts[foundIndex] = {
          ...posts[foundIndex],
          titulo: payload.titulo ? payload.titulo.trim() : posts[foundIndex].titulo,
          descripcion: payload.descripcion ? payload.descripcion.trim() : posts[foundIndex].descripcion,
          categoria: payload.categoria || posts[foundIndex].categoria,
          archivo: payload.archivo || posts[foundIndex].archivo,
          tipo: payload.tipo || posts[foundIndex].tipo,
          thumbnail: payload.thumbnail !== undefined ? payload.thumbnail : posts[foundIndex].thumbnail,
          fecha: posts[foundIndex].fecha || new Date().toISOString()
        };
      } else {
        // ID proporcionado pero no encontrado -> crear nuevo con ese ID
        postId = payload.id;
        const nuevoPost = {
          id: postId,
          titulo,
          descripcion,
          categoria,
          archivo,
          tipo,
          fecha: new Date().toISOString(),
          thumbnail
        };
        posts.unshift(nuevoPost);
      }
    } else {
      // MODO CREACIÓN: Crear nuevo post
      postId = `post_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
      const nuevoPost = {
        id: postId,
        titulo,
        descripcion,
        categoria,
        archivo,
        tipo,
        fecha: new Date().toISOString(),
        thumbnail
      };
      posts.unshift(nuevoPost);
    }

    // Limitar a 100 posts
    if (posts.length > 100) posts.length = 100;

    // Actualizar posts.json en GitHub
    const updatedContent = Buffer.from(JSON.stringify(posts, null, 2), 'utf8').toString('base64');

    const commitResp = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/${encodeURIComponent(postsPathUsed)}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'User-Agent': 'netlify-function',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: isUpdate ? 
          `Update ${postsPathUsed} - edit ${titulo}` : 
          `Update ${postsPathUsed} - add ${titulo}`,
        content: updatedContent,
        sha: postsSha || undefined
      })
    });

    if (!commitResp.ok) {
      const text = await commitResp.text();
      console.error('Error actualizando posts.json:', commitResp.status, text);
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'Error actualizando posts.json', detail: text }) };
    }

    const commitJson = await commitResp.json();

    return {
      statusCode: isUpdate ? 200 : 201,
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        success: true, 
        id: postId, 
        message: isUpdate ? 'Post actualizado exitosamente' : 'Post creado exitosamente',
        commit: commitJson 
      })
    };

  } catch (err) {
    console.error('upload-post handler error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
