// admin.js - JavaScript del panel de administración

class AdminPanel {
    constructor() {
        this.posts = [];
        this.archivoSeleccionado = null;
        this.postToDelete = null;
        this.init();
    }

    async init() {
        this.setupEventListeners();
        await this.cargarPosts();
        this.renderizarPostsAdmin();
    }

    setupEventListeners() {
        // Formulario de subida
        const uploadForm = document.getElementById('upload-form');
        if (uploadForm) {
            uploadForm.addEventListener('submit', this.manejarSubida.bind(this));
        }

        // Botón de vista previa
        const previewBtn = document.getElementById('preview-btn');
        if (previewBtn) {
            previewBtn.addEventListener('click', this.mostrarVistaPrevia.bind(this));
        }

        // Input de archivo
        const archivoInput = document.getElementById('archivo');
        if (archivoInput) {
            archivoInput.addEventListener('change', this.manejarSeleccionArchivo.bind(this));
        }

        // Contador de caracteres
        const descripcion = document.getElementById('descripcion');
        if (descripcion) {
            descripcion.addEventListener('input', this.actualizarContador.bind(this));
        }

        // Búsqueda de posts
        const searchInput = document.getElementById('search-posts');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.filtrarPostsAdmin(e.target.value);
            });
        }

        // Modales
        this.setupModales();
    }

    setupModales() {
        // Modal de eliminación
        const deleteModal = document.getElementById('delete-modal');
        const cancelDelete = document.getElementById('cancel-delete');
        const confirmDelete = document.getElementById('confirm-delete');

        if (cancelDelete) {
            cancelDelete.addEventListener('click', () => {
                deleteModal.style.display = 'none';
                this.postToDelete = null;
            });
        }

        if (confirmDelete) {
            confirmDelete.addEventListener('click', this.confirmarEliminacion.bind(this));
        }

        // Modal de éxito
        const successModal = document.getElementById('success-modal');
        const closeSuccess = document.getElementById('close-success');
        const viewPortfolio = document.getElementById('view-portfolio');

        if (closeSuccess) {
            closeSuccess.addEventListener('click', () => {
                successModal.style.display = 'none';
            });
        }

        if (viewPortfolio) {
            viewPortfolio.addEventListener('click', () => {
                window.open('index.html', '_blank');
            });
        }
    }

    manejarSeleccionArchivo(e) {
        const archivo = e.target.files[0];
        if (!archivo) return;

        // Validar tamaño (50MB máximo)
        const maxSize = 50 * 1024 * 1024; // 50MB
        if (archivo.size > maxSize) {
            alert('El archivo es demasiado grande. Máximo 50MB.');
            e.target.value = '';
            return;
        }

        // Validar tipo
        const tiposPermitidos = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'video/mp4', 'video/mov', 'video/avi', 'video/webm'];
        if (!tiposPermitidos.includes(archivo.type)) {
            alert('Tipo de archivo no permitido. Solo imágenes (JPG, PNG, WebP) y videos (MP4, MOV, AVI, WebM).');
            e.target.value = '';
            return;
        }

        this.archivoSeleccionado = archivo;
        this.actualizarInfoArchivo(archivo);
    }

    actualizarInfoArchivo(archivo) {
        const fileInfo = document.querySelector('.file-info');
        const size = (archivo.size / (1024 * 1024)).toFixed(1);
        const tipo = archivo.type.startsWith('image') ? 'Imagen' : 'Video';
        
        if (fileInfo) {
            fileInfo.textContent = `${tipo} seleccionado: ${archivo.name} (${size}MB)`;
        }
    }

    actualizarContador(e) {
        const contador = document.querySelector('.char-counter');
        if (contador) {
            contador.textContent = `${e.target.value.length}/500 caracteres`;
        }
    }

    async mostrarVistaPrevia() {
        const titulo = document.getElementById('titulo').value;
        const descripcion = document.getElementById('descripcion').value;
        const categoria = document.getElementById('categoria').value;

        if (!titulo || !descripcion || !categoria || !this.archivoSeleccionado) {
            alert('Por favor completa todos los campos y selecciona un archivo.');
            return;
        }

        const previewArea = document.getElementById('preview-area');
        const previewContent = document.getElementById('preview-content');

        // Crear vista previa
        const esVideo = this.archivoSeleccionado.type.startsWith('video');
        const fileURL = URL.createObjectURL(this.archivoSeleccionado);

        const mediaHtml = esVideo 
            ? `<video src="${fileURL}" controls style="max-width: 300px;"></video>`
            : `<img src="${fileURL}" alt="Vista previa" style="max-width: 300px; max-height: 200px;">`;

        previewContent.innerHTML = `
            <div class="preview-card">
                ${mediaHtml}
                <h4>${titulo}</h4>
                <p>${descripcion}</p>
                <small>Categoría: ${categoria}</small>
            </div>
        `;

        previewArea.style.display = 'block';
    }

    async manejarSubida(e) {
        e.preventDefault();

        const titulo = document.getElementById('titulo').value.trim();
        const descripcion = document.getElementById('descripcion').value.trim();
        const categoria = document.getElementById('categoria').value;

        if (!titulo || !descripcion || !categoria || !this.archivoSeleccionado) {
            alert('Por favor completa todos los campos y selecciona un archivo.');
            return;
        }

        try {
            this.mostrarProgreso(true, 'Subiendo archivo...');

            // Primero subir el archivo
            const formData = new FormData();
            formData.append('file', this.archivoSeleccionado);

            const uploadResponse = await fetch('/.netlify/functions/upload-file', {
                method: 'POST',
                body: formData
            });

            if (!uploadResponse.ok) {
                throw new Error('Error al subir el archivo');
            }

            const uploadResult = await uploadResponse.json();
            
            this.actualizarProgreso(50, 'Guardando publicación...');

            // Crear el post
            const postData = {
                titulo,
                descripcion,
                categoria,
                archivo: uploadResult.url,
                tipo: this.archivoSeleccionado.type.startsWith('image') ? 'imagen' : 'video',
                fecha: new Date().toISOString(),
                thumbnail: uploadResult.thumbnail || null
            };

            const postResponse = await fetch('/.netlify/functions/upload-post', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(postData)
            });

            if (!postResponse.ok) {
                throw new Error('Error al crear la publicación');
            }

            this.actualizarProgreso(100, '¡Publicación creada exitosamente!');

            // Limpiar formulario
            e.target.reset();
            this.archivoSeleccionado = null;
            document.getElementById('preview-area').style.display = 'none';
            document.querySelector('.char-counter').textContent = '0/500 caracteres';
            document.querySelector('.file-info').textContent = 'Formatos: JPG, PNG, MP4, MOV. Máximo 50MB';

            // Recargar lista de posts
            await this.cargarPosts();
            this.renderizarPostsAdmin();

            // Mostrar modal de éxito
            setTimeout(() => {
                this.mostrarProgreso(false);
                document.getElementById('success-modal').style.display = 'block';
            }, 1000);

        } catch (error) {
            console.error('Error en la subida:', error);
            this.mostrarProgreso(false);
            alert('Error al subir el trabajo: ' + error.message);
        }
    }

    async cargarPosts() {
        try {
            const response = await fetch('/.netlify/functions/get-posts');
            if (!response.ok) {
                throw new Error('Error al cargar posts');
            }
            this.posts = await response.json();
        } catch (error) {
            console.error('Error cargando posts:', error);
            this.posts = [];
        }
    }

    renderizarPostsAdmin() {
        const container = document.getElementById('admin-posts-list');
        if (!container) return;

        if (this.posts.length === 0) {
            container.innerHTML = '<p class="no-posts">No hay trabajos publicados aún.</p>';
            return;
        }

        container.innerHTML = this.posts.map(post => this.crearCardPostAdmin(post)).join('');
    }

    crearCardPostAdmin(post) {
        const fechaFormateada = new Date(post.fecha).toLocaleDateString('es-ES');
        const esVideo = post.tipo === 'video';
        
        return `
            <div class="admin-post-card" data-id="${post.id}">
                <div class="admin-post-media">
                    ${esVideo 
                        ? `<video src="${post.archivo}" muted></video>`
                        : `<img src="${post.archivo}" alt="${post.titulo}">`
                    }
                </div>
                <div class="admin-post-info">
                    <h4>${post.titulo}</h4>
                    <p>${this.truncarTexto(post.descripcion, 80)}</p>
                    <div class="admin-post-meta">
                        <span class="categoria">${post.categoria}</span>
                        <span class="fecha">${fechaFormateada}</span>
                        <span class="tipo">${post.tipo === 'video' ? '📹 Video' : '📸 Foto'}</span>
                    </div>
                </div>
                <div class="admin-post-actions">
                    <button onclick="adminPanel.verPost('${post.id}')" class="btn-view">Ver</button>
                    <button onclick="adminPanel.eliminarPost('${post.id}')" class="btn-delete">Eliminar</button>
                </div>
            </div>
        `;
    }

    filtrarPostsAdmin(termino) {
        const container = document.getElementById('admin-posts-list');
        if (!container) return;

        const terminoLower = termino.toLowerCase();
        const postsFiltrados = this.posts.filter(post => 
            post.titulo.toLowerCase().includes(terminoLower) ||
            post.descripcion.toLowerCase().includes(terminoLower) ||
            post.categoria.toLowerCase().includes(terminoLower)
        );

        container.innerHTML = postsFiltrados.map(post => this.crearCardPostAdmin(post)).join('');
    }

    verPost(postId) {
        window.open(`index.html#post-${postId}`, '_blank');
    }

    eliminarPost(postId) {
        this.postToDelete = postId;
        document.getElementById('delete-modal').style.display = 'block';
    }

    async confirmarEliminacion() {
        if (!this.postToDelete) return;

        try {
            const response = await fetch('/.netlify/functions/delete-post', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: this.postToDelete })
            });

            if (!response.ok) {
                throw new Error('Error al eliminar el post');
            }

            // Recargar posts
            await this.cargarPosts();
            this.renderizarPostsAdmin();

            // Cerrar modal
            document.getElementById('delete-modal').style.display = 'none';
            this.postToDelete = null;

            alert('Trabajo eliminado exitosamente');

        } catch (error) {
            console.error('Error eliminando post:', error);
            alert('Error al eliminar el trabajo: ' + error.message);
        }
    }

    mostrarProgreso(mostrar, mensaje = '') {
        const statusDiv = document.getElementById('upload-status');
        const submitBtn = document.getElementById('submit-btn');

        if (mostrar) {
            statusDiv.style.display = 'block';
            submitBtn.disabled = true;
            this.actualizarProgreso(0, mensaje);
        } else {
            statusDiv.style.display = 'none';
            submitBtn.disabled = false;
        }
    }

    actualizarProgreso(porcentaje, mensaje) {
        const progressFill = document.getElementById('progress-fill');
        const statusMessage = document.getElementById('status-message');

        if (progressFill) {
            progressFill.style.width = `${porcentaje}%`;
        }
        
        if (statusMessage) {
            statusMessage.textContent = mensaje;
        }
    }

    // Función helper para convertir archivo a base64
    archivoABase64(archivo) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                // Remover el prefijo "data:image/jpeg;base64," etc.
                const base64 = reader.result.split(',')[1];
                resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(archivo);
        });
    }

    truncarTexto(texto, limite) {
        if (texto.length <= limite) return texto;
        return texto.substring(0, limite) + '...';
    }
}

// Inicializar panel de administración
let adminPanel;
document.addEventListener('DOMContentLoaded', () => {
    adminPanel = new AdminPanel();
});

// Funciones globales para los botones
window.adminPanel = null;
document.addEventListener('DOMContentLoaded', () => {
    window.adminPanel = new AdminPanel();
});
