// main.js - JavaScript principal del portafolio

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
        // Filtros de posts
        const filtros = document.querySelectorAll('.filtro-btn');
        filtros.forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.cambiarFiltro(e.target.dataset.filter);
            });
        });

        // Búsqueda (si existe)
        const searchInput = document.getElementById('search-posts');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.buscarPosts(e.target.value);
            });
        }

        // Formulario de contacto
        const contactForm = document.getElementById('contacto-form');
        if (contactForm) {
            contactForm.addEventListener('submit', this.manejarFormularioContacto.bind(this));
        }
    }

    async cargarPosts() {
        try {
            this.mostrarLoading(true);
            const response = await fetch('/.netlify/functions/get-posts');
            
            if (!response.ok) {
                throw new Error(`Error ${response.status}: ${response.statusText}`);
            }
            
            this.posts = await response.json();
            console.log('Posts cargados:', this.posts.length);
            
        } catch (error) {
            console.error('Error cargando posts:', error);
            this.mostrarError('No se pudieron cargar los trabajos');
        } finally {
            this.mostrarLoading(false);
        }
    }

    renderizarPosts() {
        const container = document.getElementById('posts-container');
        const noPosts = document.getElementById('no-posts');
        
        if (!container) return;

        let postsFiltrados = this.filtrarPosts();

        if (postsFiltrados.length === 0) {
            container.innerHTML = '';
            if (noPosts) noPosts.style.display = 'block';
            return;
        }

        if (noPosts) noPosts.style.display = 'none';

        container.innerHTML = postsFiltrados.map(post => this.crearCardPost(post)).join('');
        
        // Agregar event listeners a las cards
        this.setupPostClickHandlers();
    }

crearCardPost(post) {
  const url = post.url || '';
  const title = post.title || 'Sin título';
  const excerpt = post.excerpt || '';

  const isVideo = this.esVideo(url);

  return `
    <article class="post-card">
      ${url
        ? isVideo
          ? `<video src="${url}" controls></video>`
          : `<img src="${url}" alt="${title}">`
        : '<p>[Sin archivo]</p>'}
      <h3>${title}</h3>
      <p>${excerpt}</p>
    </article>
  `;
}

        const esVideo = this.esVideo(post.archivo);
        const mediaHtml = esVideo 
            ? `<video src="${post.archivo}" poster="${post.thumbnail || ''}" preload="metadata"></video>`
            : `<img src="${post.archivo}" alt="${post.titulo}" loading="lazy">`;

        return `
            <article class="post-card" data-id="${post.id}" data-tipo="${post.tipo}">
                <div class="post-media">
                    ${mediaHtml}
                    ${esVideo ? '<div class="play-overlay"><span class="play-icon">▶</span></div>' : ''}
                    <div class="post-categoria">${post.categoria}</div>
                </div>
                <div class="post-content">
                    <h3 class="post-titulo">${post.titulo}</h3>
                    <p class="post-descripcion">${this.truncarTexto(post.descripcion, 100)}</p>
                    <div class="post-meta">
                        <span class="post-fecha">${fechaFormateada}</span>
                        <span class="post-tipo">${post.tipo === 'video' ? '📹' : '📸'}</span>
                    </div>
                </div>
            </article>
        `;
    }

    setupPostClickHandlers() {
        const cards = document.querySelectorAll('.post-card');
        cards.forEach(card => {
            card.addEventListener('click', (e) => {
                const postId = card.dataset.id;
                this.abrirModal(postId);
            });
        });
    }

    filtrarPosts() {
        if (this.filtroActual === 'todos') {
            return this.posts;
        }
        
        const tipoBuscado = this.filtroActual === 'fotos' ? 'imagen' : 'video';
        return this.posts.filter(post => post.tipo === tipoBuscado);
    }

    cambiarFiltro(nuevoFiltro) {
        this.filtroActual = nuevoFiltro;
        
        // Actualizar botones activos
        document.querySelectorAll('.filtro-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-filter="${nuevoFiltro}"]`).classList.add('active');
        
        this.renderizarPosts();
    }

    buscarPosts(termino) {
        const container = document.getElementById('posts-container');
        if (!container) return;

        const terminoLower = termino.toLowerCase();
        const postsFiltrados = this.posts.filter(post => 
            post.titulo.toLowerCase().includes(terminoLower) ||
            post.descripcion.toLowerCase().includes(terminoLower) ||
            post.categoria.toLowerCase().includes(terminoLower)
        );

        container.innerHTML = postsFiltrados.map(post => this.crearCardPost(post)).join('');
        this.setupPostClickHandlers();
    }

    setupModal() {
        this.modal = document.getElementById('modal');
        const closeBtn = document.querySelector('.close-modal');
        
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.cerrarModal());
        }
        
        if (this.modal) {
            this.modal.addEventListener('click', (e) => {
                if (e.target === this.modal) {
                    this.cerrarModal();
                }
            });
        }

        // Cerrar modal con ESC
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.modal && this.modal.style.display === 'block') {
                this.cerrarModal();
            }
        });
    }

    abrirModal(postId) {
        // Asegurar que posts sea un array
        if (!Array.isArray(this.posts)) {
            return;
        }

        const post = this.posts.find(p => p.id === postId);
        if (!post || !this.modal) return;

        const modalMedia = document.getElementById('modal-media');
        const modalTitle = document.getElementById('modal-title');
        const modalDescription = document.getElementById('modal-description');
        const modalDate = document.getElementById('modal-date');

        const esVideo = this.esVideo(post.archivo);
        const fechaFormateada = new Date(post.fecha).toLocaleDateString('es-ES', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        modalMedia.innerHTML = esVideo 
            ? `<video src="${post.archivo}" controls autoplay muted></video>`
            : `<img src="${post.archivo}" alt="${post.titulo}">`;

        modalTitle.textContent = post.titulo;
        modalDescription.textContent = post.descripcion;
        modalDate.textContent = fechaFormateada;

        this.modal.style.display = 'block';
        document.body.style.overflow = 'hidden';
    }

    cerrarModal() {
        if (this.modal) {
            this.modal.style.display = 'none';
            document.body.style.overflow = 'auto';
            
            // Pausar video si hay uno
            const video = this.modal.querySelector('video');
            if (video) {
                video.pause();
            }
        }
    }

    async manejarFormularioContacto(e) {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        const statusDiv = document.getElementById('form-status');
        
        try {
            statusDiv.style.display = 'block';
            statusDiv.className = 'form-status loading';
            statusDiv.innerHTML = '<p>Enviando mensaje...</p>';
            
            const response = await fetch('/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams(formData).toString()
            });
            
            if (response.ok) {
                statusDiv.className = 'form-status success';
                statusDiv.innerHTML = '<p>✅ ¡Mensaje enviado! Te contactaré pronto.</p>';
                e.target.reset();
            } else {
                throw new Error('Error en el envío');
            }
            
        } catch (error) {
            statusDiv.className = 'form-status error';
            statusDiv.innerHTML = '<p>❌ Error al enviar el mensaje. Intenta por WhatsApp.</p>';
        }
    }

    // Utilidades
    esVideo(archivo) {
        const extension = archivo.split('.').pop().toLowerCase();
        return ['mp4', 'mov', 'avi', 'webm', 'mkv'].includes(extension);
    }

    truncarTexto(texto, limite) {
        if (texto.length <= limite) return texto;
        return texto.substring(0, limite) + '...';
    }

    mostrarLoading(mostrar) {
        const loading = document.getElementById('loading');
        if (loading) {
            loading.style.display = mostrar ? 'block' : 'none';
        }
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
}

// Inicializar cuando se carga la página
document.addEventListener('DOMContentLoaded', () => {
    new Portfolio();
});

// Utilidades globales
window.compartirTrabajo = function(postId) {
    if (navigator.share) {
        const post = portfolio.posts.find(p => p.id === postId);
        navigator.share({
            title: post.titulo,
            text: post.descripcion,
            url: window.location.href
        });
    } else {
        // Fallback para navegadores que no soportan Web Share API
        navigator.clipboard.writeText(window.location.href);
        alert('¡Enlace copiado al portapapeles!');
    }
};
