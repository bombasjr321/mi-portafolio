// admin.js - Panel admin (frontend) - versión extendida y compatible
class AdminPanel {
  constructor() {
    this.posts = [];
    this.container = document.querySelector('#posts-list');
    this.uploadForm = document.querySelector('#upload-form');
    this.fileInput = document.querySelector('#file-input');
    this.previewArea = document.querySelector('#preview-area');
    this.previewMedia = document.querySelector('#preview-media');
    this.previewTitle = document.querySelector('#preview-title');
    this.previewDesc = document.querySelector('#preview-desc');
    this.previewMeta = document.querySelector('#preview-meta');
    this.previewBtn = document.querySelector('#preview-btn');
    this.statusDiv = document.querySelector('#upload-status');

    // endpoints (ajusta si tus functions usan otras rutas)
    this.endpoints = {
      uploadFile: '/.netlify/functions/upload-file',
      uploadPost: '/.netlify/functions/upload-post',
      getPosts: '/.netlify/functions/get-posts',
      deletePost: '/.netlify/functions/delete-post'
    };
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

    if (this.fileInput) {
      this.fileInput.addEventListener('change', () => {
        const f = this.fileInput.files && this.fileInput.files[0];
        if (f) this.renderPreviewFile(f);
        else this.clearPreview();
      });
    }

    if (this.previewBtn) {
      this.previewBtn.addEventListener('click', (e) => {
        e.preventDefault();
        // probar preview desde inputs del form
        const f = this.fileInput && this.fileInput.files && this.fileInput.files[0];
        if (f) this.renderPreviewFile(f);
        else {
          // si no hay archivo, intentar preview por URL si el form lo tuviera
          alert('Selecciona un archivo para ver la vista previa.');
        }
      });
    }

    // Delegación: botones Ver y Eliminar en la lista de posts
    if (this.container) {
      this.container.addEventListener('click', (e) => {
        const viewBtn = e.target.closest('.btn-view');
        const delBtn = e.target.closest('.btn-delete');

        if (viewBtn) {
          const url = viewBtn.dataset.url;
          if (url) window.open(url, '_blank');
          return;
        }

        if (delBtn) {
          const id = delBtn.dataset.id;
          if (id) this.handleDelete(id);
          return;
        }
      });
    }
  }

  async cargarPosts() {
    try {
      const response = await fetch(this.endpoints.getPosts);
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Error al cargar posts: ${response.status} ${text}`);
      }
      const data = await response.json();
      if (Array.isArray(data)) this.posts = data;
      else if (Array.isArray(data.posts)) this.posts = data.posts;
      else this.posts = [];
      console.log('Posts cargados:', this.posts.length);
    } catch (err) {
      console.error('Error en cargarPosts:', err);
      this.posts = [];
      this.setStatus('No se pudieron cargar posts', 'error');
    }
  }

  renderizarPostsAdmin() {
    if (!this.container) {
      console.warn('No se encontró el contenedor #posts-list');
      return;
    }
    if (!Array.isArray(this.posts)) this.posts = [];

    if (this.posts.length === 0) {
      this.container.innerHTML = '<div class="no-posts">No hay publicaciones.</div>';
      return;
    }

    const html = this.posts.map(post => this.postToAdminCard(post)).join('');
    this.container.innerHTML = html;
  }

  postToAdminCard(post) {
    const title = post.title || post.titulo || 'Sin título';
    const id = post.id || post.slug || post.fileName || '';
    const categoria = post.categoria || '';
    const date = post.fecha ? new Date(post.fecha).toLocaleString() : '';
    const archivo = post.archivo || post.url || post.file || post.path || '';
    const thumb = post.thumbnail || post.thumb || post.thumbUrl || (/\.(jpg|jpeg|png|webp|gif)$/i.test(archivo) ? archivo : '');
    const isVideo = /\.(mp4|mov|avi|webm|mkv)$/i.test(archivo) || (post.tipo && post.tipo === 'video');

    const mediaHtml = isVideo
      ? `<div class="admin-post-media"><video src="${archivo}" muted playsinline style="width:100%;height:100%;object-fit:cover"></video></div>`
      : `<div class="admin-post-media"><img src="${thumb || archivo}" alt="${this.escapeHtml(title)}" style="width:100%;height:100%;object-fit:cover"></div>`;

    return `
      <div class="admin-post-card" data-id="${this.escapeHtml(id)}">
        ${mediaHtml}
        <div class="admin-post-info">
          <h4>${this.escapeHtml(title)}</h4>
          <div class="admin-post-meta">
            <span class="categoria">${this.escapeHtml(categoria)}</span>
            <span>${this.escapeHtml(date)}</span>
          </div>
        </div>
        <div class="admin-post-actions">
          <button class="btn-view" data-id="${this.escapeHtml(id)}" data-url="${this.escapeHtml(archivo)}">Ver</button>
          <button class="btn-delete" data-id="${this.escapeHtml(id)}">Eliminar</button>
        </div>
      </div>
    `;
  }

  // Manejar subida: sube archivo (upload-file) -> registra post (upload-post)
  async manejarSubida(event) {
    event.preventDefault();
    try {
      const form = event.target;
      const fileInput = form.querySelector('input[type=file]');
      const titleInput = form.querySelector('input[name=title]');
      const excerptInput = form.querySelector('textarea[name=excerpt]');
      const categoriaInput = form.querySelector('select[name=categoria]') || form.querySelector('select[id=categoria]');
      const branchInput = form.querySelector('input[name=branch]');

      if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
        return this.alertOrStatus('Selecciona un archivo', 'error');
      }

      const file = fileInput.files[0];
      const filename = `${Date.now()}_${file.name}`.replace(/[^a-zA-Z0-9._-]/g, '_');
      const title = (titleInput && titleInput.value) ? titleInput.value.trim() : filename;
      const excerpt = excerptInput && excerptInput.value ? excerptInput.value.trim() : '';
      const categoria = categoriaInput && categoriaInput.value ? categoriaInput.value : '';
      const branch = branchInput && branchInput.value ? branchInput.value : 'main';

      this.setStatus('Leyendo archivo...', 'loading');

      // Convertir archivo a base64 puro (sin encabezado data:)
      const base64 = await this.readFileAsBase64(file);
      const commaIndex = base64.indexOf(',');
      const pureBase64 = commaIndex >= 0 ? base64.slice(commaIndex + 1) : base64;

      // ✅ AQUÍ ESTÁ EL CAMBIO: enviamos JSON con el formato que espera upload-file
      this.setStatus('Subiendo archivo...', 'loading');
      const payloadFile = {
        filename: filename,
        branch: branch,
        content: pureBase64  // base64 puro sin "data:image/png;base64,"
      };

      const resp = await fetch(this.endpoints.uploadFile, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payloadFile)
      });

      if (!resp.ok) {
        const txt = await resp.text();
        throw new Error(`Error al subir el archivo: ${resp.status} ${txt}`);
      }

      const body = await resp.json();
      // la función ahora devuelve { url, postId }
      const fileUrl = body.url;
      const postId = body.postId;
      
      if (!fileUrl) {
        console.warn('upload-file response:', body);
        throw new Error('La función upload-file no devolvió la URL pública del archivo.');
      }

      this.setStatus('Archivo subido y post registrado ✅', 'success');

      // ✅ YA NO NECESITAMOS llamar upload-post porque upload-file ya actualiza posts.json
      // actualizar UI: insertar al inicio
      const tipo = /\.(mp4|mov|avi|webm|mkv)$/i.test(file.name) ? 'video' : 'imagen';
      const newPost = {
        id: postId || `${Date.now()}_${Math.random().toString(36).slice(2,8)}`,
        title: title,
        titulo: title, // compatibilidad
        url: fileUrl,
        archivo: fileUrl, // compatibilidad
        excerpt: excerpt,
        descripcion: excerpt, // compatibilidad
        categoria: categoria,
        tipo: tipo,
        thumbnail: tipo === 'imagen' ? fileUrl : null,
        date: new Date().toISOString(),
        fecha: new Date().toISOString() // compatibilidad
      };
      
      this.posts.unshift(newPost);
      this.renderizarPostsAdmin();

      // limpiar form y preview
      form.reset();
      this.clearPreview();

      setTimeout(() => this.setStatus('', ''), 2000);

    } catch (err) {
      console.error('Error en la subida:', err);
      this.setStatus('Error en la subida: ' + (err.message || err), 'error');
    }
  }

  // Delete post (llama a delete-post function). Si no existe, solo elimina del UI local.
  async handleDelete(id) {
    if (!confirm('¿Eliminar este post? Esta acción actualizará posts.json en GitHub.')) return;
    this.setStatus('Eliminando...', 'loading');

    try {
      // intentar eliminar vía function
      const resp = await fetch(this.endpoints.deletePost, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });

      if (!resp.ok) {
        // si función no existe o falla, fallback: quitar solo en UI
        const txt = await resp.text();
        console.warn('delete-post falló:', resp.status, txt);
        // eliminar localmente
        this.posts = this.posts.filter(p => String(p.id) !== String(id));
        this.renderizarPostsAdmin();
        this.setStatus('Eliminado localmente (delete function falló).', 'error');
        setTimeout(() => this.setStatus('', ''), 2000);
        return;
      }

      // si OK -> refrescar lista desde github (para mantener sincronía)
      this.setStatus('Post eliminado. Actualizando lista...', 'success');
      await this.cargarPosts();
      this.renderizarPostsAdmin();
      setTimeout(() => this.setStatus('', ''), 1500);
    } catch (err) {
      console.error('Error eliminando post:', err);
      this.setStatus('Error eliminando: ' + (err.message || err), 'error');
    }
  }

  // Preview helpers
  renderPreviewFile(fileOrUrl) {
    if (!this.previewArea || !this.previewMedia) return;
    this.previewMedia.innerHTML = '';
    let isVideo = false;

    // Si es objeto File
    if (fileOrUrl instanceof File) {
      const file = fileOrUrl;
      isVideo = /\.(mp4|mov|avi|webm|mkv)$/i.test(file.name);
      const url = URL.createObjectURL(file);
      if (isVideo) this.previewMedia.innerHTML = `<video src="${url}" controls style="width:100%;height:100%;object-fit:cover"></video>`;
      else this.previewMedia.innerHTML = `<img src="${url}" alt="preview" style="width:100%;height:100%;object-fit:cover">`;
    } else {
      // URL string
      const url = String(fileOrUrl);
      isVideo = /\.(mp4|mov|avi|webm|mkv)$/i.test(url);
      if (isVideo) this.previewMedia.innerHTML = `<video src="${url}" controls style="width:100%;height:100%;object-fit:cover"></video>`;
      else this.previewMedia.innerHTML = `<img src="${url}" alt="preview" style="width:100%;height:100%;object-fit:cover">`;
    }

    // rellenar meta desde inputs si existen
    if (this.previewTitle) this.previewTitle.textContent = (document.querySelector('#title')?.value) || (document.querySelector('input[name=title]')?.value) || 'Sin título';
    if (this.previewDesc) this.previewDesc.textContent = (document.querySelector('#excerpt')?.value) || (document.querySelector('textarea[name=excerpt]')?.value) || '';
    if (this.previewMeta) this.previewMeta.innerHTML = `<span class="categoria">${(document.querySelector('#categoria')?.value) || ''}</span>`;
    this.previewArea.style.display = 'block';
  }

  clearPreview() {
    if (!this.previewArea || !this.previewMedia) return;
    this.previewMedia.innerHTML = '';
    if (this.previewTitle) this.previewTitle.textContent = '';
    if (this.previewDesc) this.previewDesc.textContent = '';
    if (this.previewMeta) this.previewMeta.innerHTML = '';
    this.previewArea.style.display = 'none';
  }

  // util
  readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  setStatus(text, cls='') {
    if (!this.statusDiv) {
      if (text) alert(text);
      return;
    }
    this.statusDiv.style.display = text ? 'block' : 'none';
    this.statusDiv.className = 'upload-status' + (cls ? ' ' + cls : '');
    this.statusDiv.textContent = text || '';
  }

  alertOrStatus(text, type='') {
    // prefer status if visible, else alert
    if (this.statusDiv) this.setStatus(text, type);
    else alert(text);
  }

  escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"'`=\/]/g, s => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;','`':'&#96;','/':'&#47;','=':'&#61;'
    })[s]);
  }
}

// Inicializar solo en navegador
if (typeof window !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    const admin = new AdminPanel();
    admin.init();
  });
}
