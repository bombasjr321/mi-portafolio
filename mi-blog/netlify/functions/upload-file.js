/* ======================================================
netlify/functions/upload-file.js
- Recibe JSON: { filename, content (base64), title, excerpt, branch? }
- Sube archivo a repo en public/media/<filename>
- Actualiza public/posts.json (crea si no existe)
- Devuelve { url, postId }
====================================================== */


// Nota: Netlify Functions en Node 18+ tienen fetch disponible globalmente.


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


const bodyText = event.body;
const payload = JSON.parse(bodyText);


const owner = process.env.GITHUB_OWNER;
const repo = process.env.GITHUB_REPO;
const token = process.env.GITHUB_TOKEN;
const branch = payload.branch || process.env.GITHUB_BRANCH || 'main';


const filepath = `public/media/${payload.filename}`;


// 1) Check if file exists to get sha (so we update instead of create)
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


// 2) Upload (create or update) the media file
const uploadMessage = fileSha ? `Update ${filepath}` : `Add ${filepath}`;
const uploadResp = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/${encodeURIComponent(filepath)}`, {
method: 'PUT',
headers: {
Authorization: `Bearer ${token}`,
'User-Agent': 'netlify-function',
'Content-Type': 'application/json'
},
body: JSON.stringify({
message: uploadMessage,
content: payload.content,
branch,
sha: fileSha || undefined
})
});


if (!uploadResp.ok) {
const txt = await uploadResp.text();
console.error('Error subiendo archivo:', uploadResp.status, txt);
return { statusCode: 500, headers, body: JSON.stringify({ error: 'Error subiendo archivo a GitHub', detail: txt }) };
}


const uploadJson = await uploadResp.json();


// raw URL (public)
const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${filepath}`;


