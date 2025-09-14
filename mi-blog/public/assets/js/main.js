// main.js - JavaScript principal del portafolio (VERSIÓN NORMALIZADA)
class Portfolio {
    constructor() {
        this.posts = [];
        this.filtroActual = 'todos';
        this.modal = null;
        this.init();
    }

    async init() {
        this.setupEventListeners();
        await this.cargarPosts();
        this.renderizarPosts();
        this.setupModal();
    }

    setupEventListeners() {
        // Filtros
        const filtros = document.querySelectorAll('.filtro-btn');
        filtros.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const filtro = e.currentTarget.dataset.filter || e.currentTarget.getAttribute('data-filter');
                this.cambiarFiltro(filtro);
            });
        });

        // Búsqueda
        const searchInput = document.getElementById('search-posts');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.buscarPosts(e.target.value);
            });
        }

        // Formulario de contacto
        const contactForm = document.getElementById('contacto-form');
        if (contactForm) {
            // Si el form tiene atributo data-netlify o netlify, dejamos que Netlify lo procese
            if (!contactForm.hasAttribute('data-netlify') && !contactForm.hasAttribute('netlify')) {
                contactForm.addEventListener('submit', this.manejarFormularioContacto.bind(this));
            } else {
                // si quieres manejar client-side mostrar mensajes, podríamos suscribirnos sin preventDefault
                // por ahora no interferimos con Netlify.
            }
        }
    }

    async cargarPosts() {
        try {
            this.mostrarLoading(true);
            const response = await fetch('/.netlify/functions/get-posts');
            if (!response.ok) throw new Error(`Error ${response.status}: ${response.statusText}`);

            const raw = await response.json();

            // Normalizar formato: puede venir [] o { posts: [] }
            const arr = Array.isArray(raw) ? raw : (Array.isArray(raw.posts) ? raw.posts : []);
            this.posts = arr.map(p => this._normalizePost(p));
            console.log('Posts cargados:', this.posts.length);
            // debug opcional:
            // console.log('Posts sample:', this.posts.slice(0,3));
        } catch (error) {
            console.error('Error cargando posts:', error);
            this.mostrarError('No se pudieron cargar los trabajos');
            this.posts = [];
        } finally {
            this.mostrarLoading(false);
        }
    }

    // Normaliza cualquiera de estos formatos:
    // { titulo, descripcion, archivo, tipo, fecha, thumbnail, categoria, id }
    // { title, excerpt, url, type, date, thumbnail, category, id }
    _normalizePost(p) {
        const titulo = p.titulo || p.title || p.name || '';
        const descripcion = p.descripcion || p.excerpt || p.description || '';
        const archivo = p.archivo || p.url || p.image || p.file || p.src || '';
        const tipoRaw = (p.tipo || p.type || '').toString().toLowerCase();
        const categoria = p.categoria || p.category || '';
        const thumbnail = p.thumbnail || p.thumb || null;
        const fecha = p.fecha || p.date || p.created_at || null;
        const id = (p.id !== undefined && p.id !== null) ? String(p.id) : `post_${Date.now()}_${Math.random().toString(36).slice(2,6)}`;

        // Determinar tipo si no viene
        let tipo = 'imagen';
        if (tipoRaw === 'video' || /\.mp4($|\?)/i.test(archivo) || /\.webm($|\?)/i.test(archivo) || archivo.includes('youtube')) {
            tipo = 'video';
        }

        return {
            id,
            titulo: titulo || 'Sin título',
            descripcion: descripcion || '',
            archivo: archivo || '',
            tipo,
            categoria,
            thumbnail,
            fecha
        };
    }

    renderizarPosts() {
        const container = document.getElementById('posts-container');
        const noPosts = document.getElementById('no-posts');
        if (!container) return;

        let postsFiltrados = this.filtrarPosts();

        if (!postsFiltrados || postsFiltrados.length === 0) {
            container.innerHTML = '';
            if (noPosts) noPosts.style.display = 'block';
            return;
        }

        if (noPosts) noPosts.style.display = 'none';
        container.innerHTML = postsFiltrados.map(post => this.crearCardPost(post)).join('');
        this.setupPostClickHandlers();
    }

    crearCardPost(post) {
        const url = post.archivo || '';
        const title = post.titulo || 'Sin título';
        const excerpt = post.descripcion || '';
        const tipo = (post.tipo || 'imagen').toLowerCase();
        const thumbnail = post.thumbnail || '';

        // Media HTML: detecta Youtube, video o imagen
        const mediaHtml = this._mediaHtml(url, tipo, thumbnail);

        return `
          <article class="post-card" data-id="${this._escapeHtml(String(post.id))}" data-tipo="${this._escapeHtml(tipo)}">
            <div class="post-media">
              ${mediaHtml}
              ${tipo === 'video' ? '<div class="play-overlay"><span class="play-icon">▶</span></div>' : ''}
              ${post.categoria ? `<div class="post-categoria">${this._escapeHtml(post.categoria)}</div>` : ''}
            </div>
            <div class="post-content">
              <h3 class="post-titulo">${this._escapeHtml(title)}</h3>
              <p class="post-descripcion">${this._escapeHtml(this.truncarTexto(excerpt || '', 120))}</p>
              <div class="post-meta">
                <span class="post-fecha">${post.fecha ? new Date(post.fecha).toLocaleDateString('es-ES',{year:'numeric',month:'long',day:'numeric'}) : ''}</span>
                <span class="post-tipo">${tipo === 'video' ? '📹' : '📸'}</span>
              </div>
            </div>
          </article>
        `;
    }

    _mediaHtml(url, tipo, thumbnail) {
        if (!url) {
            return `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#999;background:#f5f5f5">Sin archivo</div>`;
        }

        // YouTube detect (soporta enlaces y embed)
        const ytMatch = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/))([A-Za-z0-9_-]{6,})/);
        if (ytMatch) {
            const id = ytMatch[1];
            return `<iframe src="https://www.youtube.com/embed/${id}" title="YouTube video" frameborder="0" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowfullscreen style="width:100%;height:100%;min-height:250px;border:0;"></iframe>`;
        }

        // Video detection
        const isVideo = tipo === 'video' || /\.mp4($|\?)/i.test(url) || /\.webm($|\?)/i.test(url);
        if (isVideo) {
            const poster = thumbnail ? ` poster="${thumbnail}" ` : '';
            return `<video src="${url}" controls preload="metadata" ${poster} style="width:100%;height:100%;object-fit:cover;"></video>`;
        }

        // Image fallback
        return `<img src="${url}" alt="" loading="lazy" style="width:100%;height:100%;object-fit:cover;">`;
    }

    setupPostClickHandlers() {
        const cards = document.querySelectorAll('.post-card');
        cards.forEach(card => {
            card.addEventListener('click', () => {
                const postId = card.dataset.id;
                this.abrirModal(postId);
            });
        });
    }

    filtrarPosts() {
        if (this.filtroActual === 'todos') return this.posts;

        const tipoBuscado = this.filtroActual === 'fotos' ? 'imagen' : 'video';
        return this.posts.filter(post => (post.tipo || '').toLowerCase() === tipoBuscado);
    }

    cambiarFiltro(nuevoFiltro) {
        if (!nuevoFiltro) return;
        this.filtroActual = nuevoFiltro;
        document.querySelectorAll('.filtro-btn').forEach(btn => btn.classList.remove('active'));
        const btn = document.querySelector(`[data-filter="${nuevoFiltro}"]`);
        if (btn) btn.classList.add('active');
        this.renderizarPosts();
    }

    buscarPosts(termino) {
        const container = document.getElementById('posts-container');
        if (!container) return;

        const terminoLower = (termino || '').toLowerCase();
        const postsFiltrados = this.posts.filter(post =>
            (post.titulo || '').toLowerCase().includes(terminoLower) ||
            (post.descripcion || '').toLowerCase().includes(terminoLower) ||
            (post.categoria || '').toLowerCase().includes(terminoLower)
        );

        container.innerHTML = postsFiltrados.map(post => this.crearCardPost(post)).join('');
        this.setupPostClickHandlers();
    }

    setupModal() {
        this.modal = document.getElementById('modal');
        const closeBtn = document.querySelector('.close-modal');

        if (closeBtn) closeBtn.addEventListener('click', () => this.cerrarModal());

        if (this.modal) {
            this.modal.addEventListener('click', (e) => {
                if (e.target === this.modal) this.cerrarModal();
            });
        }

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.modal && this.modal.style.display === 'block') {
                this.cerrarModal();
            }
        });
    }

    abrirModal(postId) {
        if (!Array.isArray(this.posts)) return;

        // ID es string - buscamos comparando como string
        const post = this.posts.find(p => String(p.id) === String(postId));
        if (!post || !this.modal) return;

        const modalMedia = document.getElementById('modal-media');
        const modalTitle = document.getElementById('modal-title');
        const modalDescription = document.getElementById('modal-description');
        const modalDate = document.getElementById('modal-date');

        const mediaHtml = this._mediaHtml(post.archivo, post.tipo, post.thumbnail);
        const fechaFormateada = post.fecha ? new Date(post.fecha).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' }) : '';

        if (modalMedia) modalMedia.innerHTML = mediaHtml;
        if (modalTitle) modalTitle.textContent = post.titulo || post.title || 'Sin título';
        if (modalDescription) modalDescription.textContent = post.descripcion || post.excerpt || '';
        if (modalDate) modalDate.textContent = fechaFormateada;

        this.modal.style.display = 'block';
        document.body.style.overflow = 'hidden';
    }

    cerrarModal() {
        if (this.modal) {
            this.modal.style.display = 'none';
            document.body.style.overflow = 'auto';
            const video = this.modal.querySelector('video');
            if (video) video.pause();
        }
    }

    async manejarFormularioContacto(e) {
        e.preventDefault();
        const formData = new FormData(e.target);
        const statusDiv = document.getElementById('form-status');

        try {
            if (statusDiv) {
                statusDiv.style.display = 'block';
                statusDiv.className = 'form-status loading';
                statusDiv.innerHTML = '<p>Enviando mensaje...</p>';
            }

            const response = await fetch('/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams(formData).toString()
            });

            if (response.ok) {
                if (statusDiv) {
                    statusDiv.className = 'form-status success';
                    statusDiv.innerHTML = '<p>✅ ¡Mensaje enviado! Te contactaré pronto.</p>';
                    e.target.reset();
                }
            } else {
                throw new Error('Error en el envío');
            }
        } catch (error) {
            if (statusDiv) {
                statusDiv.className = 'form-status error';
                statusDiv.innerHTML = '<p>❌ Error al enviar el mensaje. Intenta por WhatsApp.</p>';
            }
        }
    }

    // Utilidades
    esVideo(archivo) {
        if (!archivo || typeof archivo !== 'string') return false;
        return /\.mp4($|\?)/i.test(archivo) || /\.webm($|\?)/i.test(archivo) || archivo.includes('youtube');
    }

    truncarTexto(texto, limite) {
        if (!texto) return '';
        if (texto.length <= limite) return texto;
        return texto.substring(0, limite) + '...';
    }

    mostrarLoading(mostrar) {
        const loading = document.getElementById('loading');
        if (loading) loading.style.display = mostrar ? 'block' : 'none';
    }

    mostrarError(mensaje) {
        const container = document.getElementById('posts-container');
        if (container) {
            container.innerHTML = `
                <div class="error-message">
                    <p>⚠️ ${mensaje}</p>
                    <button onclick="window.location.reload()">Reintentar</button>
                </div>
            `;
        }
    }

    _escapeHtml(text) {
        if (!text) return '';
        return String(text).replace(/[&<>"'`]/g, (s) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;', '`':'&#x60;'})[s]);
    }
}

// Inicializar
document.addEventListener('DOMContentLoaded', () => {
    window.portfolio = new Portfolio();
});

// Compartir
window.compartirTrabajo = function(postId) {
    const post = (window.portfolio && window.portfolio.posts) ? window.portfolio.posts.find(p => String(p.id) === String(postId)) : null;
    if (!post) return;

    if (navigator.share) {
        navigator.share({
            title: post.titulo || post.title || '',
            text: post.descripcion || post.excerpt || '',
            url: `${window.location.origin}?post=${post.id}`
        });
    } else {
        navigator.clipboard.writeText(window.location.href);
        alert('¡Enlace copiado al portapapeles!');
    }
};

