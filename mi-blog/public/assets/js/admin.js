// public/assets/js/admin.js - Admin panel (Cloudinary upload + crear/editar/eliminar posts)
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

    // CONFIG Cloudinary (pon aquí tu preset unsigned)
    this.CLOUD_NAME = 'dhv8izd9i';              // ya lo tienes
    this.UPLOAD_PRESET = 'mi_preset_unsigned';  // <- Cambia por tu preset unsigned real

    // Endpoint netlify functions
    this.UPLOAD_POST_ENDPOINT = '/.netlify/functions/upload-post';
    this.DELETE_POST_ENDPOINT = '/.netlify/functions/delete-post';

    // Tamaño máximo recomendado en cliente (200 MB)
    this.MAX_SIZE_BYTES = 200 * 1024 * 1024;

    // id del modal de edición
    this.modalId = 'admin-edit-modal';
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

    // actualizar preview cuando cambie el file input
    if (this.fileInput) {
      this.fileInput.addEventListener('change', () => this._updatePreviewFromFile());
    }

    // Delegación para botones Editar / Eliminar dentro del contenedor
    if (this.container) {
      this.container.addEventListener('click', (e) => {
        const editBtn = e.target.closest('.btn-edit');
        const delBtn = e.target.closest('.btn-delete');

        if (editBtn) {
          const id = editBtn.dataset.id;
          this.abrirEditor(id);
        } else if (delBtn) {
          const id = delBtn.dataset.id;
          this.confirmarYEliminar(id);
        }
      });
    }

    // Buscador admin (opcional, si existe input #admin-search)
    const adminSearch = document.querySelector('#admin-search');
    if (adminSearch) {
      adminSearch.addEventListener('input', (e) => this._filtrarAdmin(e.target.value));
    }
  }

  async cargarPosts() {
    try {
      const resp = await fetch('/.netlify/functions/get-posts');
      if (!resp.ok) {
        const txt = await resp.text();
        throw new Error(`Error ${resp.status}: ${txt}`);
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
        <article class="post-card admin-post-card" data-id="${this._escapeHtml(slug)}">
          <div class="admin-post-media">${mediaHtml}</div>
          <div class="admin-post-info">
            <h4>${this._escapeHtml(title)}</h4>
            <div class="admin-post-meta">${this._escapeHtml(String(excerpt || '')).slice(0,120)}</div>
          </div>
          <div class="admin-post-actions">
            <button type="button" class="btn-view btn-edit" data-id="${this._escapeHtml(slug)}">Editar</button>
            <button type="button" class="btn-delete" data-id="${this._escapeHtml(slug)}">Eliminar</button>
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

    // Video detection or explicit tipo === 'video'
    const isVideo = (typeof tipo === 'string' && tipo.toLowerCase() === 'video') || /\.mp4($|\?)/i.test(url) || /\.webm($|\?)/i.test(url);
    if (isVideo) {
      const poster = thumbnail ? ` poster="${thumbnail}" ` : '';
      return `<video src="${url}" controls preload="metadata" style="width:100%;height:100%;object-fit:cover;border-radius:6px;" ${poster}></video>`;
    }

    // image fallback
    return `<img src="${url}" alt="" loading="lazy" style="width:100%;height:100%;object-fit:cover;border-radius:6px">`;
  }

  _escapeHtml(text) {
    if (text === undefined || text === null) return '';
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

  // Mostrar/ocultar y rellenar preview usando el preview-area ya presente en el HTML
  mostrarPreview(e) {
    e && e.preventDefault && e.preventDefault();

    const previewArea = document.querySelector('#preview-area');
    const previewCard = document.querySelector('#preview-card');
    const previewMedia = document.querySelector('#preview-media');
    const previewTitle = document.querySelector('#preview-title');
    const previewMeta = document.querySelector('#preview-meta');
    const previewDesc = document.querySelector('#preview-desc');

    // si no existe contenedor, crear minimal (pero tu HTML ya tiene uno)
    if (!previewArea) {
      const pa = document.createElement('div');
      pa.className = 'preview-area';
      document.body.appendChild(pa);
    }

    // Si preview ya visible, ocultar
    if (previewArea && previewArea.style && previewArea.style.display && previewArea.style.display !== 'none') {
      previewArea.style.display = 'none';
      return;
    }

    // Forzar mostrar
    if (previewArea) previewArea.style.display = 'block';

    // Rellenar desde valores del formulario (si existe file, tomarlo; sino usar campos)
    const file = this.fileInput && this.fileInput.files && this.fileInput.files[0];
    const title = (this.titleInput && this.titleInput.value) || '';
    const excerpt = (this.excerptInput && this.excerptInput.value) || '';

    if (file) {
      // usa URL.createObjectURL para previsualizar
      const url = URL.createObjectURL(file);
      if (file.type.startsWith('image/')) {
        if (previewMedia) previewMedia.innerHTML = `<img src="${url}" alt="preview" style="max-width:100%;height:auto;display:block;border-radius:8px">`;
      } else if (file.type.startsWith('video/')) {
        if (previewMedia) previewMedia.innerHTML = `<video controls src="${url}" style="width:100%;height:auto;border-radius:8px;display:block;"></video>`;
      } else {
        if (previewMedia) previewMedia.innerHTML = `<p>Tipo no soportado</p>`;
      }
      if (previewTitle) previewTitle.textContent = title || file.name;
      if (previewMeta) previewMeta.textContent = (this.categoriaInput && this.categoriaInput.value) || '';
      if (previewDesc) previewDesc.textContent = excerpt || '';
      // liberar el objectURL después (timeout prudente)
      setTimeout(() => { try { URL.revokeObjectURL(url); } catch (e) {} }, 30000);
    } else {
      // No hay file: rellenar con texto / campos
      if (previewMedia) previewMedia.innerHTML = `<div style="width:100%;height:160px;background:#f3f3f3;display:flex;align-items:center;justify-content:center;color:#999">No hay archivo seleccionado</div>`;
      if (previewTitle) previewTitle.textContent = title || 'Sin título';
      if (previewMeta) previewMeta.textContent = (this.categoriaInput && this.categoriaInput.value) || '';
      if (previewDesc) previewDesc.textContent = excerpt || '';
    }
  }

  // Llamada que usan change del input file para actualizar preview automáticamente
  _updatePreviewFromFile() {
    // Si existe preview-area y está visible, actualizar su contenido
    const previewArea = document.querySelector('#preview-area');
    if (previewArea && previewArea.style && previewArea.style.display && previewArea.style.display !== 'none') {
      this.mostrarPreview();
    } else {
      // si no está visible, dejar preparado (no mostrar) o mostrar según tu preferencia:
      // aquí no mostramos automáticamente para no interrumpir al usuario; el botón "Vista previa" lo mostrará
      return;
    }
  }

  async manejarSubida(event) {
    event.preventDefault();
    this.clearStatus();
    try {
      // Validación preset
      //if (!this.CLOUD_NAME || !this.UPLOAD_PRESET || this.UPLOAD_PRESET === 'TU_UNSIGNED_PRESET' || this.UPLOAD_PRESET === 'mi_preset_unsigned') {
      //  throw new Error('Configura UPLOAD_PRESET en admin.js antes de subir (reemplaza "mi_preset_unsigned").');
     // }

      const title = (this.titleInput && this.titleInput.value.trim()) || '';
      const excerpt = (this.excerptInput && this.excerptInput.value.trim()) || '';
      const categoria = (this.categoriaInput && this.categoriaInput.value) || '';
      const file = this.fileInput && this.fileInput.files && this.fileInput.files[0];

      if (!file) return alert('Selecciona un archivo (imagen o video).');

      if (file.size > this.MAX_SIZE_BYTES) {
        return alert('El archivo es demasiado grande (más de 200 MB). Reduce su tamaño o sube a Cloudinary por la web.');
      }

      this.setStatus('Subiendo a Cloudinary...');

      // Subida a Cloudinary (auto endpoint soporta imagen/video)
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

      const previewArea = document.querySelector('#preview-area');
      if (previewArea) previewArea.style.display = 'none';

    } catch (err) {
      console.error('manejarSubida error:', err);
      if (!this.uploadStatus || !this.uploadStatus.style) return alert('Error en la subida: ' + (err.message || err));
      if (!this.uploadStatus.classList.contains('error')) {
        this.setStatus('Error en la subida: ' + (err.message || err), 'error');
      }
    }
  }

  // Abre modal de edición (inline)
  abrirEditor(id) {
    const post = this.posts.find(p => String(p.id) === String(id) || String(p.slug || '') === String(id));
    if (!post) return alert('No se encontró el post para editar.');

    // crear modal si no existe
    let modal = document.getElementById(this.modalId);
    if (!modal) {
      modal = document.createElement('div');
      modal.id = this.modalId;
      modal.className = 'modal';
      modal.innerHTML = `
        <div class="modal-content">
          <span class="close-modal" id="${this.modalId}-close">&times;</span>
          <h3>Editar trabajo</h3>
          <form id="${this.modalId}-form">
            <div class="form-group">
              <label>Título</label>
              <input name="titulo" type="text" required>
            </div>
            <div class="form-group">
              <label>Descripción</label>
              <textarea name="descripcion" rows="3"></textarea>
            </div>
            <div class="form-group">
              <label>Categoría</label>
              <input name="categoria" type="text">
            </div>
            <div class="form-group">
              <label>URL del archivo (si no cambia, dejar)</label>
              <input name="archivo" type="text">
            </div>
            <div class="form-actions">
              <button type="submit" class="btn-primary">Guardar cambios</button>
              <button type="button" id="${this.modalId}-cancel" class="btn-secondary">Cancelar</button>
            </div>
          </form>
        </div>
      `;
      document.body.appendChild(modal);

      // estilos mínimos encapsulados
      const style = document.createElement('style');
      style.innerHTML = `
      #${this.modalId} { position:fixed; left:0; top:0; right:0; bottom:0; background:rgba(0,0,0,0.6); display:flex; align-items:center; justify-content:center; z-index:2000; }
      #${this.modalId} .modal-content { background:white; padding:20px; width:520px; max-width:94%; border-radius:10px; box-shadow:0 8px 30px rgba(0,0,0,0.4); position:relative; }
      #${this.modalId} .close-modal { position:absolute; right:18px; top:12px; font-size:26px; cursor:pointer; }
      `;
      document.head.appendChild(style);

      // listeners
      modal.querySelector(`#${this.modalId}-close`).addEventListener('click', () => this._closeModal(modal));
      modal.querySelector(`#${this.modalId}-cancel`).addEventListener('click', () => this._closeModal(modal));
      modal.querySelector(`#${this.modalId}-form`).addEventListener('submit', (e) => this._submitEdit(e, id));
      modal.addEventListener('click', (e) => { if (e.target === modal) this._closeModal(modal); });
    }

    // rellenar campos
    const form = modal.querySelector('form');
    form.elements['titulo'].value = post.titulo || post.title || '';
    form.elements['descripcion'].value = post.descripcion || post.excerpt || '';
    form.elements['categoria'].value = post.categoria || post.category || '';
    form.elements['archivo'].value = post.archivo || post.url || '';

    modal.style.display = 'flex';
  }

  _closeModal(modal) {
    if (!modal) modal = document.getElementById(this.modalId);
    if (modal) modal.style.display = 'none';
  }

  async _submitEdit(e, id) {
    e.preventDefault();
    const modal = document.getElementById(this.modalId);
    const form = modal.querySelector('form');
    const titulo = (form.elements['titulo'].value || '').trim();
    const descripcion = (form.elements['descripcion'].value || '').trim();
    const categoria = (form.elements['categoria'].value || '').trim();
    const archivo = (form.elements['archivo'].value || '').trim();

    const payload = {
      id: id,
      titulo,
      descripcion,
      categoria,
      archivo
    };

    try {
      const resp = await fetch(this.UPLOAD_POST_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const body = await resp.json();
      if (!resp.ok) {
        console.error('Edit error:', body);
        throw new Error(body.error || body.detail || `HTTP ${resp.status}`);
      }

      // actualizar localmente
      this.posts = this.posts.map(p => {
        if (String(p.id) === String(id) || String(p.slug || '') === String(id)) {
          return {
            ...p,
            titulo: payload.titulo || p.titulo || p.title,
            title: payload.titulo || p.title || p.titulo,
            descripcion: payload.descripcion || p.descripcion || p.excerpt,
            excerpt: payload.descripcion || p.excerpt || p.descripcion,
            categoria: payload.categoria || p.categoria,
            category: payload.categoria || p.category,
            archivo: payload.archivo || p.archivo || p.url,
            url: payload.archivo || p.url || p.archivo
          };
        }
        return p;
      });

      this.renderizarPostsAdmin();
      this._closeModal(modal);
      alert('Cambios guardados correctamente.');
    } catch (err) {
      console.error('Error editando post:', err);
      alert('Error editando: ' + (err.message || err));
    }
  }

  async confirmarYEliminar(id) {
    if (!confirm('¿Eliminar este trabajo? Esta operación no se puede deshacer.')) return;

    try {
      const resp = await fetch(this.DELETE_POST_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });

      const body = await resp.json();
      if (!resp.ok) {
        console.error('delete error:', body);
        throw new Error(body.error || body.detail || `HTTP ${resp.status}`);
      }

      // quitar del array y re-render
      this.posts = this.posts.filter(p => String(p.id) !== String(id) && String(p.slug || '') !== String(id));
      this.renderizarPostsAdmin();
      alert('Trabajo eliminado correctamente.');
    } catch (err) {
      console.error('Error eliminando post:', err);
      alert('Error eliminando: ' + (err.message || err));
    }
  }

  // simple filtro en admin
  _filtrarAdmin(term) {
    if (!term) {
      this.renderizarPostsAdmin();
      return;
    }
    const t = term.toLowerCase();
    const filtered = this.posts.filter(p => {
      const title = (p.titulo || p.title || '').toLowerCase();
      const cat = (p.categoria || p.category || '').toLowerCase();
      return title.includes(t) || cat.includes(t);
    });
    const old = this.posts;
    this.posts = filtered;
    this.renderizarPostsAdmin();
    this.posts = old; // keep original
  }
}

// Inicializar en navegador
if (typeof window !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    window.adminPanel = new AdminPanel();
    window.adminPanel.init();
  });
}

