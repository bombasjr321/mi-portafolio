// netlify/functions/upload-file.js
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
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'Faltan variables de entorno GITHUB_OWNER/GITHUB_REPO/GITHUB_TOKEN' }) };
    }

    const payload = JSON.parse(event.body);
    const owner = process.env.GITHUB_OWNER;
    const repo = process.env.GITHUB_REPO;
    const token = process.env.GITHUB_TOKEN;
    const branch = payload.branch || process.env.GITHUB_BRANCH || 'main';

    // Guardaremos la imagen en public/media/trabajos/fotos/
    const filepath = `public/media/trabajos/fotos/${payload.filename}`;

    // 1) Comprobar si existe para obtener sha (update) — si no existe se creará
    let fileSha = null;
    try {
      const getFileResp = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/${encodeURIComponent(filepath)}?ref=${branch}`, {
        headers: { Authorization: `Bearer ${token}`, 'User-Agent': 'netlify-function' }
      });
      if (getFileResp.ok) {
        const fileJson = await getFileResp.json();
        fileSha = fileJson.sha;
      }
    } catch (err) {
      console.log('No existe el archivo aún o error al comprobarlo:', err.message);
    }

    // 2) Subir el archivo (create/update)
    const uploadResp = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/${encodeURIComponent(filepath)}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'User-Agent': 'netlify-function',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: fileSha ? `Update ${filepath}` : `Add ${filepath}`,
        content: payload.content, // BASE64 puro
        branch,
        sha: fileSha || undefined
      })
    });

    if (!uploadResp.ok) {
      const txt = await uploadResp.text();
      console.error('Error subiendo archivo:', uploadResp.status, txt);
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'Error subiendo archivo a GitHub', detail: txt }) };
    }

    // raw URL público (si tu repo es público funcionará directamente)
    const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${filepath}`;

    // 3) Actualizar posts.json -> primero intenta public/posts.json, si no existe usa data/posts.json
    const candidatePaths = ['public/posts.json', 'data/posts.json'];
    let posts = [];
    let postsSha = null;
    let postsPathUsed = null;

    for (const p of candidatePaths) {
      try {
        const getPostsResp = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/${encodeURIComponent(p)}?ref=${branch}`, {
          headers: { Authorization: `Bearer ${token}`, 'User-Agent': 'netlify-function' }
        });
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

    // Si no se encontró ningún posts.json, default a data/posts.json (se crea)
    if (!postsPathUsed) postsPathUsed = 'data/posts.json';

    // 4) Añadir nuevo post al inicio
    const postId = `${Date.now()}-${payload.filename}`;
    const newPost = {
      id: postId,
      title: payload.title || payload.filename,
      url: rawUrl,
      excerpt: payload.excerpt || '',
      date: new Date().toISOString()
    };
    posts.unshift(newPost);

    const updatedPostsContent = Buffer.from(JSON.stringify(posts, null, 2), 'utf8').toString('base64');

    // 5) Commit posts.json (create o update)
    const commitResp = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/${encodeURIComponent(postsPathUsed)}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'User-Agent': 'netlify-function',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: `Update ${postsPathUsed} - add ${payload.filename}`,
        content: updatedPostsContent,
        branch,
        sha: postsSha || undefined
      })
    });

    if (!commitResp.ok) {
      const txt = await commitResp.text();
      console.error('Error actualizando posts.json:', commitResp.status, txt);
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'Error actualizando posts.json', detail: txt }) };
    }

    return { statusCode: 200, headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ url: rawUrl, postId }) };

  } catch (err) {
    console.error('upload-file handler error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};

