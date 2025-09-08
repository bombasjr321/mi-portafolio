// ==========================
const titleInput = form.querySelector('input[name=title]');
const excerptInput = form.querySelector('textarea[name=excerpt]');


if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
return alert('Selecciona un archivo');
}


const file = fileInput.files[0];
const filename = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');


const base64 = await this.readFileAsBase64(file);
// base64 includes prefix like "data:...;base64,AAA..." -> strip prefix
const commaIndex = base64.indexOf(',');
const pureBase64 = commaIndex >= 0 ? base64.slice(commaIndex + 1) : base64;


const payload = {
filename,
content: pureBase64,
title: titleInput ? titleInput.value : filename,
excerpt: excerptInput ? excerptInput.value : '',
branch: (form.querySelector('input[name=branch]') && form.querySelector('input[name=branch]').value) || undefined
};


console.log('Enviando payload (sin content visible):', { filename: payload.filename, title: payload.title, excerpt: payload.excerpt, branch: payload.branch });


const resp = await fetch('/.netlify/functions/upload-file', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify(payload)
});


if (!resp.ok) {
const txt = await resp.text();
throw new Error(`Error al subir el archivo: ${resp.status} ${txt}`);
}


const body = await resp.json();
console.log('Subida completada:', body);
alert('Subida correcta: ' + body.url);


// actualizar UI
this.posts.unshift({ title: payload.title, url: body.url, excerpt: payload.excerpt, id: body.postId || payload.filename });
this.renderizarPostsAdmin();


} catch (err) {
console.error('Error en la subida:', err);
alert('Error en la subida: ' + err.message);
}
}


readFileAsBase64(file) {
return new Promise((resolve, reject) => {
const reader = new FileReader();
reader.onload = () => resolve(reader.result);
reader.onerror = reject;
reader.readAsDataURL(file);
});
}
}


// Inicializar
document.addEventListener('DOMContentLoaded', () => {
const admin = new AdminPanel();
admin.init();
});
