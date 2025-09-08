class AdminPanel {
if (!this.container) return console.warn('No se encontró el contenedor #posts-list');
if (!Array.isArray(this.posts)) this.posts = [];


const html = this.posts.map(post => {
const title = post.title || post.titulo || 'Sin título';
const slug = post.slug || post.id || '';
const img = post.url || post.image || post.img || '';
const excerpt = post.excerpt || post.descripcion || '';


return `
<article class="post-card">
${img ? `<img src="${img}" alt="${title}" style="max-width:100%">` : ''}
<h3>${title}</h3>
<p>${excerpt}</p>
<a href="/admin/editar.html?slug=${encodeURIComponent(slug)}">Editar</a>
</article>`;
}).join('');


this.container.innerHTML = html || '<p>No hay publicaciones.</p>';
}


async manejarSubida(event) {
event.preventDefault();
try {
const form = event.target;
const fileInput = form.querySelector('input[type=file]');
const titleInput = form.querySelector('input[name=title]');
const excerptInput = form.querySelector('textarea[name=excerpt]');


if (!fileInput || !fileInput.files || fileInput.files.length === 0) return alert('Selecciona un archivo');


const file = fileInput.files[0];
const filename = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');


const base64 = await this.readFileAsBase64(file);
const commaIndex = base64.indexOf(',');
const pureBase64 = commaIndex >= 0 ? base64.slice(commaIndex + 1) : base64;


const payload = { filename, content: pureBase64, title: titleInput ? titleInput.value : filename, excerpt: excerptInput ? excerptInput.value : '', branch: (form.querySelector('input[name=branch]') && form.querySelector('input[name=branch]').value) || undefined };


const resp = await fetch('/.netlify/functions/upload-file', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });


if (!resp.ok) {
const txt = await resp.text();
throw new Error(`Error al subir el archivo: ${resp.status} ${txt}`);
}


const body = await resp.json();
alert('Subida correcta: ' + body.url);


this.posts.unshift({ title: payload.title, url: body.url, excerpt: payload.excerpt, id: body.postId || payload.filename });
this.renderizarPostsAdmin();


} catch (err) {
console.error('Error en la subida:', err);
alert('Error en la subida: ' + err.message);
}
}


readFileAsBase64(file) { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file); }); }
}


if (typeof window !== 'undefined') document.addEventListener('DOMContentLoaded', () => { const admin = new AdminPanel(); admin.init(); });
