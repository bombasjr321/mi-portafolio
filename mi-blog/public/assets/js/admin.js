// ==========================
// admin.js (FRONTEND) - Copia únicamente esta sección al archivo público de tu sitio
// ==========================
class AdminPanel {
constructor() {
this.posts = [];
this.container = document.querySelector('#posts-list');
this.uploadForm = document.querySelector('#upload-form');
}


async init() {
try {
this.attachListeners();
await this.cargarPosts();
this.renderizarPostsAdmin();
} catch (err) {
console.error('Error en init:', err);
}
}


attachListeners() {
if (this.uploadForm) {
this.uploadForm.addEventListener('submit', (e) => this.manejarSubida(e));
}
}


async cargarPosts() {
try {
const response = await fetch('/.netlify/functions/get-posts');
if (!response.ok) {
const text = await response.text();
throw new Error(`Error al cargar posts: ${response.status} ${text}`);
}


const data = await response.json();
if (Array.isArray(data)) {
this.posts = data;
} else if (Array.isArray(data.posts)) {
this.posts = data.posts;
} else {
console.warn('Formato inesperado de get-posts, asignando array vacío', data);
this.posts = [];
}


} catch (err) {
console.error('Error en cargarPosts:', err);
this.posts = [];
}
}


renderizarPostsAdmin() {
if (!this.container) return console.warn('No se encontró el contenedor #posts-list');


if (!Array.isArray(this.posts)) this.posts = [];


const html = this.posts.map(post => {
const title = post.title || post.titulo || 'Sin título';
const slug = post.slug || post.id || '';
const img = post.url || post.image || post.img || '';
const excerpt = post.excerpt || post.descripcion || '';


return `
<article class="post-card">
${img ? `<img src="${img}" alt="${title}" onerror="this.style.display='none'">` : ''}
<h3>${title}</h3>
<p>${excerpt}</p>
<a href="/admin/editar.html?slug=${encodeURIComponent(slug)}">Editar</a>
</article>
`;
}).join('');


this.container.innerHTML = html || '<p>No hay publicaciones.</p>';
}


async manejarSubida(event) {
event.preventDefault();
}
