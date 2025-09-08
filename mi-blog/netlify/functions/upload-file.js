// ==========================
const uploadResp = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/${encodeURIComponent(filepath)}`, {
method: 'PUT',
headers: {
Authorization: `Bearer ${token}`,
'User-Agent': 'netlify-function',
'Content-Type': 'application/json'
},
body: JSON.stringify({
message: fileSha ? `Update ${filepath}` : `Add ${filepath}`,
content: payload.content,
branch,
sha: fileSha || undefined
})
});


if (!uploadResp.ok) {
const txt = await uploadResp.text();
return { statusCode: 500, headers, body: JSON.stringify({ error: 'Error subiendo archivo a GitHub', detail: txt }) };
}


const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${filepath}`;


// Update posts.json
const postsPath = 'public/posts.json';
let posts = [];
let postsSha = null;
try {
const getPostsResp = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/${encodeURIComponent(postsPath)}?ref=${branch}`, {
headers: { Authorization: `Bearer ${token}`, 'User-Agent': 'netlify-function' }
});
if (getPostsResp.ok) {
const postsJson = await getPostsResp.json();
postsSha = postsJson.sha;
const decoded = Buffer.from(postsJson.content, 'base64').toString('utf8');
posts = JSON.parse(decoded);
if (!Array.isArray(posts)) posts = [];
}
} catch (err) {
console.warn('posts.json no existe o no se pudo leer:', err.message);
}


const postId = `${Date.now()}-${payload.filename}`;
const newPost = { id: postId, title: payload.title || payload.filename, url: rawUrl, excerpt: payload.excerpt || '', date: new Date().toISOString() };
posts.unshift(newPost);


const updatedPostsContent = Buffer.from(JSON.stringify(posts, null, 2), 'utf8').toString('base64');


const commitResp = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/${encodeURIComponent(postsPath)}`, {
method: 'PUT',
headers: {
Authorization: `Bearer ${token}`,
'User-Agent': 'netlify-function',
'Content-Type': 'application/json'
},
body: JSON.stringify({ message: `Update posts.json - add ${payload.filename}`, content: updatedPostsContent, branch, sha: postsSha || undefined })
});


if (!commitResp.ok) {
const txt = await commitResp.text();
return { statusCode: 500, headers, body: JSON.stringify({ error: 'Error actualizando posts.json', detail: txt }) };
}


return { statusCode: 200, headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ url: rawUrl, postId }) };


} catch (err) {
return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
}
};


