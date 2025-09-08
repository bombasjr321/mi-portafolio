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
        // Filtros
        const filtros = document.querySelectorAll('.filtro-btn');
        filtros.forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.cambiarFiltro(e.target.dataset.filter);
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
        // dentro de setupEventListeners()
const contactForm = document.getElementById('contacto-form');
if (contactForm) {
  // Sólo agregamos listener AJAX si el formulario NO es manejado por Netlify (data-netlify)
  if (!contactForm.hasAttribute('data-netlify')) {
    contactForm.addEventListener('submit', this.manejarFormularioContacto.bind(this));
  } else {
    // si quieres mostrar un mensaje client-side después del submit, podrías usar el evento 'submit' sin preventDefault
    // o dejar que Netlify redirija a una 'thank-you' page configurada.
  }
}

    }

    async cargarPosts() {
        try {
            this.mostrarLoading(true);
            const response = await fetch('/.netlify/functions/get-posts');
            if (!response.ok) throw new Error(`Error ${response.status}: ${response.statusText}`);

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
        this.setupPostClickHandlers();
    }

    crearCardPost(post) {
        const url = post.url || '';
        const title = post.title || 'Sin título';
        const excerpt = post.excerpt || '';
        const isVideo = this.esVideo(url);

        return `
          <article class="post-card" data-id="${post.id}">
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

    setupPostClickHandlers() {
        const cards = document.querySelectorAll('.post-card');
        cards.forEach(card => {
            card.addEventListener('click', () => {
                const postId = parseInt(card.dataset.id, 10);
                this.abrirModal(postId);
            });
        });
    }

    filtrarPosts() {
        if (this.filtroActual === 'todos') return this.posts;

        const tipoBuscado = this.filtroActual === 'fotos' ? 'imagen' : 'video';
        return this.posts.filter(post => post.tipo === tipoBuscado);
    }

    cambiarFiltro(nuevoFiltro) {
        this.filtroActual = nuevoFiltro;
        document.querySelectorAll('.filtro-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelector(`[data-filter="${nuevoFiltro}"]`).classList.add('active');
        this.renderizarPosts();
    }

    buscarPosts(termino) {
        const container = document.getElementById('posts-container');
        if (!container) return;

        const terminoLower = termino.toLowerCase();
        const postsFiltrados = this.posts.filter(post =>
            (post.title || '').toLowerCase().includes(terminoLower) ||
            (post.excerpt || '').toLowerCase().includes(terminoLower)
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

        const post = this.posts.find(p => p.id === postId);
        if (!post || !this.modal) return;

        const modalMedia = document.getElementById('modal-media');
        const modalTitle = document.getElementById('modal-title');
        const modalDescription = document.getElementById('modal-description');
        const modalDate = document.getElementById('modal-date');

        const esVideo = this.esVideo(post.url);
        const fechaFormateada = post.fecha
            ? new Date(post.fecha).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })
            : '';

        modalMedia.innerHTML = esVideo
            ? `<video src="${post.url}" controls autoplay muted></video>`
            : `<img src="${post.url}" alt="${post.title}">`;

        modalTitle.textContent = post.title;
        modalDescription.textContent = post.excerpt;
        modalDate.textContent = fechaFormateada;

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
    if (!archivo || typeof archivo !== 'string' || !archivo.includes('.')) return false;
    const extension = archivo.split('.').pop().toLowerCase();
    return ['mp4', 'mov', 'avi', 'webm', 'mkv'].includes(extension);
	}

    truncarTexto(texto, limite) {
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
}

// Inicializar
document.addEventListener('DOMContentLoaded', () => {
    window.portfolio = new Portfolio();
});

// Compartir
window.compartirTrabajo = function(postId) {
    const post = portfolio.posts.find(p => p.id === postId);
    if (!post) return;

    if (navigator.share) {
        navigator.share({
            title: post.title,
            text: post.excerpt,
            url: `${window.location.origin}?post=${post.id}`
        });
    } else {
        navigator.clipboard.writeText(window.location.href);
        alert('¡Enlace copiado al portapapeles!');
    }
};

