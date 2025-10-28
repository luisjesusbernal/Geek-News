// public/admin.js
const form      = document.getElementById('newsForm');
const alertBox  = document.getElementById('adminAlert');
const imageFile = document.getElementById('image_file');
const imageUrl  = document.getElementById('image_url');
const preview   = document.getElementById('image_preview');

const tableBody   = document.querySelector('#adminNewsTable tbody');
const reloadBtn   = document.getElementById('reloadNews');

const subsTbody     = document.querySelector('#subsTable tbody');
const reloadSubsBtn = document.getElementById('reloadSubs');

// Campañas
const campForm     = document.getElementById('campaignForm');
const campSubject  = document.getElementById('campSubject');
const campBody     = document.getElementById('campBody');
const campsTbody   = document.querySelector('#campsTable tbody');
const reloadCamps  = document.getElementById('reloadCamps');

function showAlert(type, text) {
  if (!alertBox) return;
  alertBox.className = `alert alert-${type}`;
  alertBox.textContent = text;
  alertBox.classList.remove('d-none');
}

// --- Verifica admin y carga datos iniciales ---
(async () => {
  try {
    const res = await fetch('/api/me');
    const me  = await res.json();
    if (!me.loggedIn) {
      window.location.href = '/login.html';
      return;
    }
    if (me.role !== 'admin') {
      showAlert('danger', 'Solo administradores pueden acceder a esta página.');
      if (form) form.classList.add('d-none');
      if (campForm) campForm.classList.add('d-none');
      return;
    }
    await loadAdminNews();
    await loadSubscribers();
    await loadCampaigns();
  } catch {
    window.location.href = '/login.html';
  }
})();

// --- Subida/Vista previa de imagen ---
if (imageFile && preview) {
  imageFile.addEventListener('change', () => {
    const file = imageFile.files?.[0];
    if (!file) {
      preview.classList.add('d-none');
      preview.src = '';
      return;
    }
    const url = URL.createObjectURL(file);
    preview.src = url;
    preview.classList.remove('d-none');
  });
}

// --- Crear noticia ---
if (form) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const payload = {
      title:     document.getElementById('title').value.trim(),
      section:   document.getElementById('section').value,
      image_url: '',
      excerpt:   document.getElementById('excerpt').value.trim(),
      content:   document.getElementById('content').value.trim(),
      published: document.getElementById('published').checked,
    };

    if (!payload.title || !payload.section) {
      showAlert('danger', 'Título y sección son obligatorios.');
      return;
    }

    try {
      // Subir imagen si hay archivo
      const file = imageFile?.files?.[0];
      if (file) {
        const fd = new FormData();
        fd.append('image', file);
        const up = await fetch('/api/upload-image', { method: 'POST', body: fd });
        const ur = await up.json();
        if (!up.ok || !ur.ok) {
          showAlert('danger', ur.msg || `Error ${up.status} al subir imagen`);
          return;
        }
        payload.image_url = ur.url;
      } else {
        payload.image_url = imageUrl?.value?.trim() || '';
      }

      const res  = await fetch('/api/news', {
        method: 'POST',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        showAlert('danger', data.msg || `Error ${res.status} al guardar`);
        return;
      }

      showAlert('success', `Noticia creada (ID ${data.id}).`);
      form.reset();
      if (preview) { preview.src = ''; preview.classList.add('d-none'); }
      document.getElementById('published').checked = true;

      await loadAdminNews();
    } catch (err) {
      console.error(err);
      showAlert('danger', 'Error de conexión. Intenta de nuevo.');
    }
  });
}

// --- Listado admin + Eliminar noticias ---
async function loadAdminNews() {
  if (!tableBody) return;
  tableBody.innerHTML = `<tr><td colspan="6" class="text-center text-secondary">Cargando…</td></tr>`;
  try {
    const res  = await fetch('/api/admin/news?limit=100');
    const data = await res.json();
    if (!res.ok || !data.ok) {
      tableBody.innerHTML = `<tr><td colspan="6" class="text-center text-danger">Error al cargar</td></tr>`;
      return;
    }
    const rows = data.items;
    if (!rows.length) {
      tableBody.innerHTML = `<tr><td colspan="6" class="text-center text-secondary">Sin noticias aún</td></tr>`;
      return;
    }

    const frag = document.createDocumentFragment();
    rows.forEach(n => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${n.id}</td>
        <td>${escapeHtml(n.title)}</td>
        <td class="text-uppercase small">${n.section}</td>
        <td>${n.published ? '<span class="badge text-bg-success">Publicada</span>' : '<span class="badge text-bg-secondary">Borrador</span>'}</td>
        <td><small>${n.created_at || ''}</small></td>
        <td class="text-end">
          <button class="btn btn-sm btn-outline-danger" data-del="${n.id}">Eliminar</button>
        </td>
      `;
      frag.appendChild(tr);
    });
    tableBody.innerHTML = '';
    tableBody.appendChild(frag);

    // handler de eliminar
    tableBody.querySelectorAll('[data-del]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = Number(btn.dataset.del);
        const ok = confirm(`¿Eliminar noticia #${id}? Esta acción no se puede deshacer.`);
        if (!ok) return;
        try {
          const res  = await fetch(`/api/news/${id}`, { method: 'DELETE' });
          const data = await res.json();
          if (!res.ok || !data.ok) {
            showAlert('danger', data.msg || `Error ${res.status} al eliminar`);
            return;
          }
          showAlert('success', `Noticia #${id} eliminada.`);
          await loadAdminNews();
        } catch (e) {
          console.error(e);
          showAlert('danger', 'Error de conexión al eliminar.');
        }
      });
    });

  } catch (e) {
    console.error(e);
    tableBody.innerHTML = `<tr><td colspan="6" class="text-center text-danger">Error de conexión</td></tr>`;
  }
}

// --- Suscriptores (tabla con Recargar) ---
async function loadSubscribers() {
  if (!subsTbody) return;
  subsTbody.innerHTML = `<tr><td colspan="4" class="text-center text-secondary">Cargando…</td></tr>`;
  try {
    const res = await fetch('/api/admin/subscribers?limit=500');
    const data = await res.json();
    if (!res.ok || !data.ok) {
      subsTbody.innerHTML = `<tr><td colspan="4" class="text-center text-danger">Error al cargar</td></tr>`;
      return;
    }

    const rows = data.items;
    if (!rows.length) {
      subsTbody.innerHTML = `<tr><td colspan="4" class="text-center text-secondary">Sin suscriptores aún</td></tr>`;
      return;
    }

    const frag = document.createDocumentFragment();
    rows.forEach(s => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${s.id}</td>
        <td>${escapeHtml(s.email)}</td>
        <td><small>${s.created_at || ''}</small></td>
        <td class="text-end">
          <button class="btn btn-sm btn-outline-danger" data-del-s="${s.id}">
            Eliminar
          </button>
        </td>
      `;
      frag.appendChild(tr);
    });

    subsTbody.innerHTML = '';
    subsTbody.appendChild(frag);

    // Evento de eliminar
    subsTbody.querySelectorAll('[data-del-s]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = Number(btn.dataset.delS);
        const ok = confirm(`¿Eliminar suscriptor #${id}?`);
        if (!ok) return;

        const res = await fetch(`/api/admin/subscribers/${id}`, { method: 'DELETE' });
        await loadSubscribers();
      });
    });

  } catch (e) {
    console.error(e);
    subsTbody.innerHTML = `<tr><td colspan="4" class="text-center text-danger">Error de conexión</td></tr>`;
  }
}


// --- Campañas: crear, listar y enviar ---
if (campForm) {
  campForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const subject = campSubject.value.trim();
    const body    = campBody.value.trim();
    if (!subject || !body) {
      showAlert('danger', 'Asunto y cuerpo son obligatorios.');
      return;
    }
    try {
      const res  = await fetch('/api/admin/campaigns', {
        method: 'POST',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify({ subject, body })
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        showAlert('danger', data.msg || `Error ${res.status} al crear campaña`);
        return;
      }
      showAlert('success', `Campaña creada (ID ${data.id}).`);
      campForm.reset();
      await loadCampaigns();
    } catch (err) {
      console.error(err);
      showAlert('danger', 'Error de conexión al crear campaña.');
    }
  });
}

async function loadCampaigns() {
  if (!campsTbody) return;
  campsTbody.innerHTML = `<tr><td colspan="4" class="text-center text-secondary">Cargando…</td></tr>`;
  try {
    const res  = await fetch('/api/admin/campaigns?limit=100');
    const data = await res.json();
    if (!res.ok || !data.ok) {
      campsTbody.innerHTML = `<tr><td colspan="4" class="text-center text-danger">Error al cargar</td></tr>`;
      return;
    }
    const rows = data.items;
    if (!rows.length) {
      campsTbody.innerHTML = `<tr><td colspan="4" class="text-center text-secondary">Sin campañas aún</td></tr>`;
      return;
    }

    const frag = document.createDocumentFragment();
    rows.forEach(c => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${c.id}</td>
        <td>${escapeHtml(c.subject)}</td>
        <td><small>${c.created_at || ''}</small></td>
        <td class="text-end">
          <button class="btn btn-sm btn-primary" data-send="${c.id}">Enviar</button>
        </td>
      `;
      frag.appendChild(tr);
    });
    campsTbody.innerHTML = '';
    campsTbody.appendChild(frag);

    campsTbody.querySelectorAll('[data-send]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = Number(btn.dataset.send);
        const ok = confirm(`¿Enviar campaña #${id} a todos los suscriptores? (Simulado con Ethereal)`);
        if (!ok) return;
        try {
          const res  = await fetch(`/api/admin/campaigns/${id}/send`, { method: 'POST' });
          const data = await res.json();
          if (!res.ok || !data.ok) {
            showAlert('danger', data.msg || `Error ${res.status} al enviar campaña`);
            return;
          }
          // Muestra resumen y links de vista previa (si hay)
          const count = data.success_count || 0;
          let html = `Se habría enviado a ${count} suscriptor(es).`;
          if (Array.isArray(data.preview_links) && data.preview_links.length) {
            html += ` Puedes previsualizar ${Math.min(5, data.preview_links.length)} ejemplo(s):\n` +
              data.preview_links.slice(0,5).map(u => `- ${u}`).join('\n');
          }
          showAlert('success', html);
        } catch (err) {
          console.error(err);
          showAlert('danger', 'Error de conexión al enviar campaña.');
        }
      });
    });

  } catch (e) {
    console.error(e);
    campsTbody.innerHTML = `<tr><td colspan="4" class="text-center text-danger">Error de conexión</td></tr>`;
  }
}

// --- Botones de recarga ---
if (reloadBtn) {
  reloadBtn.addEventListener('click', () => loadAdminNews());
}
if (reloadSubsBtn) {
  reloadSubsBtn.addEventListener('click', () => loadSubscribers());
}
if (reloadCamps) {
  reloadCamps.addEventListener('click', () => loadCampaigns());
}

// --- Util: escapar HTML ---
function escapeHtml(s = '') {
  return s.replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}
