// admin.js - Admin panel (Cloudinary upload + crear post)
class AdminPanel {
  constructor() {
    this.posts = [];
    this.container = document.querySelector('#posts-list');
    this.uploadForm = document.querySelector('#upload-form');
    this.fileInput = document.querySelector('#file-input');
    this.titleInput = document.querySelector('#title');
    this.excerptInput = document.querySelector('#excerpt');
    this.categoriaInput = document.querySelector('#categoria');
    this.previewBtn = document.querySelector('#preview-btn');
    this.uploadStatus = document.querySelector('#upload-status');

    // CONFIGURACIÓN Cloudinary: reemplaza con tu preset
    this.CLOUD_NAME = 'dhv8izd9i';              // ya lo tienes
    this.UPLOAD_PRESET = 'mi_preset_unsigned';  // <- Cambia esto por tu preset unsigned

    // Endpoint netlify function que actualiza posts.json
    this.UPLOAD_POST_ENDPOINT = '/.netlify/functions/upload-post';

    // Tamaño máximo recomendado en cliente (200 MB)
    this.MAX_SIZE_BYTES = 200 * 1024 * 1024;
  }

  async init() {
    try {
      this.attachListeners();
      await this.cargarPosts();
      this.renderizarPostsAdmin();
    } catch (err) {
      console.error('init error:', err);
    }
  }

  attachListeners() {
    if (this.uploadForm) this.uploadForm.addEventListener('submit', (e) => this.manejarSubida(e));
    if (this.previewBtn) this.previewBtn.addEventListener('click', (e) => this.mostrarPreview(e));
  }

  async cargarPosts() {
    try {
      const resp = await fetch('/.netlify/functions/get-posts');
      if (!resp.ok) {
        const txt = await resp.text();
        throw new Error(`Error ${resp.status} ${txt}`);
      }
      const data = await resp.json();
      this.posts = Array.isArray(data) ? data : (Array.isArray(data.posts) ? data.posts : []);
      console.log('Posts cargados:', this.posts.length);
    } catch (err) {
      console.error('cargarPosts error:', err);
      this.posts = [];
    }
  }

  renderizarPostsAdmin() {
    if (!this.container) return;
    if (!Array.isArray(this.posts)) this.posts = [];

    const html = this.posts.map(post => {
      const title = post.titulo || post.title || 'Sin título';
      const slug = post.id || post.slug || '';
      const mediaUrl = post.archivo || post.url || '';
      const excerpt = post.descripcion || post.excerpt || '';
      const mediaHtml = this._getMediaHtml(mediaUrl, post.tipo, post.thumbnail);

      return `
        <article class="post-card admin-post-card">
          <div class="admin-post-media">${mediaHtml}</div>
          <div class="admin-post-info">
            <h4>${this._escapeHtml(title)}</h4>
            <div class="admin-post-meta">${this._escapeHtml(excerpt).slice(0,120)}</div>
          </div>
          <div class="admin-post-actions">
            <a class="btn-view" href="/admin/editar.html?slug=${encodeURIComponent(slug)}" target="_blank">Editar</a>
          </div>
        </article>
      `;
    }).join('');

    this.container.innerHTML = html || '<p>No hay publicaciones.</p>';
  }

  _getMediaHtml(url, tipo, thumbnail) {
    if (!url) return `<div style="width:100px;height:80px;background:#f3f3f3;display:flex;align-items:center;justify-content:center;color:#999">Sin media</div>`;

    // YouTube embed detect
    const yt = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/))([A-Za-z0-9_-]{6,})/);
    if (yt) {
      const id = yt[1];
      return `<iframe src="https://www.youtube.com/embed/${id}" frameborder="0" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowfullscreen style="width:100%;height:100%;min-height:80px;object-fit:cover;border:0;border-radius:6px"></iframe>`;
    }

    // Video (mp4/webm) detection or explicit tipo === 'video'
    const isVideo = (typeof tipo === 'string' && tipo.toLowerCase() === 'video') || /\.mp4($|\?)/i.test(url) || /\.webm($|\?)/i.test(url);
    if (isVideo) {
      // if we have thumbnail, show as poster
      const poster = thumbnail ? ` poster="${thumbnail}" ` : '';
      return `<video src="${url}" controls preload="metadata" style="width:100%;height:100%;object-fit:cover;"></video>`;
    }

    // image fallback
    return `<img src="${url}" alt="" loading="lazy" style="width:100%;height:100%;object-fit:cover;">`;
  }

  _escapeHtml(text) {
    if (!text) return '';
    return String(text).replace(/[&<>"'`]/g, (s) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;', '`':'&#x60;'})[s]);
  }

  setStatus(msg, type = '') {
    if (!this.uploadStatus) return;
    this.uploadStatus.style.display = 'block';
    this.uploadStatus.className = 'upload-status ' + (type ? type : '');
    this.uploadStatus.innerText = msg;
  }

  clearStatus() {
    if (!this.uploadStatus) return;
    this.uploadStatus.style.display = 'none';
    this.uploadStatus.className = 'upload-status';
    this.uploadStatus.innerText = '';
  }

  async mostrarPreview(e) {
    e.preventDefault();
    // crea o usa un contenedor .preview-area debajo del form
    let previewArea = document.querySelector('.preview-area');
    if (!previewArea) {
      previewArea = document.createElement('div');
      previewArea.className = 'preview-area';
      // insert after form
      this.uploadForm.parentNode.insertBefore(previewArea, this.uploadForm.nextSibling);
    }
    previewArea.innerHTML = '';

    const file = this.fileInput && this.fileInput.files && this.fileInput.files[0];
    if (!file) {
      previewArea.innerHTML = '<p class="file-info">No hay archivo seleccionado para previsualizar.</p>';
      return;
    }

    const url = URL.createObjectURL(file);
    if (file.type.startsWith('image/')) {
      previewArea.innerHTML = `<div class="preview-card"><img src="${url}" alt="preview" style="max-width:100%;height:auto;display:block;border-radius:8px"/></div>`;
    } else if (file.type.startsWith('video/')) {
      previewArea.innerHTML = `<div class="preview-card"><video controls src="${url}" style="width:100%;height:auto;border-radius:8px;display:block;"></video></div>`;
    } else {
      previewArea.innerHTML = `<div class="preview-card"><p>Tipo de archivo no soportado para preview.</p></div>`;
    }
    // liberar objeto URL cuando ya no se necesita (opcional)
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }

  async manejarSubida(event) {
    event.preventDefault();
    this.clearStatus();
    try {
      if (!this.CLOUD_NAME || !this.UPLOAD_PRESET || this.UPLOAD_PRESET === 'TU_UNSIGNED_PRESET') {
        throw new Error('Configura UPLOAD_PRESET en admin.js antes de subir (reemplaza "TU_UNSIGNED_PRESET").');
      }

      const title = (this.titleInput && this.titleInput.value.trim()) || '';
      const excerpt = (this.excerptInput && this.excerptInput.value.trim()) || '';
      const categoria = (this.categoriaInput && this.categoriaInput.value) || '';
      const file = this.fileInput && this.fileInput.files && this.fileInput.files[0];

      if (!file) return alert('Selecciona un archivo (imagen o video).');

      if (file.size > this.MAX_SIZE_BYTES) {
        return alert('El archivo es demasiado grande (más de 200 MB). Reduce su tamaño o sube a Cloudinary por la web.');
      }

      this.setStatus('Subiendo a Cloudinary...');

      // Build cloudinary upload
      const cloudUrl = `https://api.cloudinary.com/v1_1/${this.CLOUD_NAME}/auto/upload`;
      const fd = new FormData();
      fd.append('file', file);
      fd.append('upload_preset', this.UPLOAD_PRESET);

      const cloudResp = await fetch(cloudUrl, { method: 'POST', body: fd });
      const cloudBody = await cloudResp.json();

      if (!cloudResp.ok) {
        console.error('Cloudinary error:', cloudBody);
        this.setStatus('Error subiendo a Cloudinary: ' + (cloudBody.error && cloudBody.error.message ? cloudBody.error.message : 'unknown'), 'error');
        throw new Error('Error Cloudinary');
      }

      const publicUrl = cloudBody.secure_url || cloudBody.url;
      const resourceType = cloudBody.resource_type || (file.type && file.type.startsWith('video') ? 'video' : 'image');
      const thumbnail = cloudBody.thumbnail_url || (cloudBody.eager && cloudBody.eager[0] && cloudBody.eager[0].secure_url) || null;

      this.setStatus('Guardando metadata en posts.json (GitHub)...');

      // Payload para upload-post function
      const postPayload = {
        titulo: title || file.name,
        descripcion: excerpt || '',
        categoria: categoria || (resourceType === 'video' ? 'video' : 'imagen'),
        archivo: publicUrl,
        tipo: resourceType === 'video' ? 'video' : 'imagen',
        thumbnail: thumbnail
      };

      const resp2 = await fetch(this.UPLOAD_POST_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(postPayload)
      });

      const body2 = await resp2.json();
      if (!resp2.ok) {
        console.error('upload-post error:', body2);
        this.setStatus('Error actualizando posts.json en GitHub: ' + (body2.error || body2.detail || resp2.status), 'error');
        throw new Error('Error upload-post');
      }

      // Actualizar UI localmente
      this.posts.unshift({
        id: body2.id || `post_${Date.now()}`,
        titulo: postPayload.titulo,
        descripcion: postPayload.descripcion,
        archivo: postPayload.archivo,
        tipo: postPayload.tipo,
        thumbnail: postPayload.thumbnail || null,
        fecha: new Date().toISOString()
      });
      this.renderizarPostsAdmin();
      this.setStatus('Subida y post creado correctamente ✅', 'success');
      this.uploadForm.reset();
      // borrar preview si existe
      const previewArea = document.querySelector('.preview-area');
      if (previewArea) previewArea.remove();

    } catch (err) {
      console.error('manejarSubida error:', err);
      if (!this.uploadStatus || !this.uploadStatus.style) return alert('Error en la subida: ' + (err.message || err));
      // si ya seteamos mensaje de error arriba, no sobrescribir
      if (!this.uploadStatus.classList.contains('error')) {
        this.setStatus('Error en la subida: ' + (err.message || err), 'error');
      }
    }
  }
}

// Inicializar en navegador
if (typeof window !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    window.adminPanel = new AdminPanel();
    window.adminPanel.init();
  });
}

