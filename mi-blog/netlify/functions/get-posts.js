/* ======================================================
netlify/functions/get-posts.js
- Lee public/posts.json desde GitHub via API y devuelve array JSON
====================================================== */


exports.handler = async (event, context) => {
const headers = {
'Access-Control-Allow-Origin': '*',
'Access-Control-Allow-Headers': 'Content-Type, Accept'
};


try {
if (!process.env.GITHUB_OWNER || !process.env.GITHUB_REPO || !process.env.GITHUB_TOKEN) {
return { statusCode: 500, headers, body: JSON.stringify({ error: 'Faltan variables de entorno GITHUB_OWNER/GITHUB_REPO/GITHUB_TOKEN' }) };
}


const owner = process.env.GITHUB_OWNER;
const repo = process.env.GITHUB_REPO;
const token = process.env.GITHUB_TOKEN;
const branch = process.env.GITHUB_BRANCH || 'main';


const postsPath = 'public/posts.json';
const fetchUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(postsPath)}?ref=${branch}`;


const resp = await fetch(fetchUrl, { headers: { Authorization: `Bearer ${token}`, 'User-Agent': 'netlify-function' } });


if (!resp.ok) {
console.warn('get-posts: posts.json no encontrado en repo, status:', resp.status);
// devolver array vacío para que frontend no rompa
return { statusCode: 200, headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify([]) };
}


const json = await resp.json();
const decoded = Buffer.from(json.content, 'base64').toString('utf8');
const posts = JSON.parse(decoded);


return { statusCode: 200, headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(posts) };


} catch (err) {
console.error('get-posts handler error:', err);
return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
}
};
