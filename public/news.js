// public/news.js

// Noticias locales espejo (para poder mostrar detalle si vienen de "local")
const LOCAL_NEWS = [
  { id: 1, title: 'Pokémon Legends: Nueva expansión', section: 'pokemon', img: '/img/pokemon.jpg',  text: 'Game Freak confirma detalles...' },
  { id: 2, title: 'El sable perdido de Luke Skywalker', section: 'starwars', img: '/img/starwars.jpg', text: 'Fans descubren una conexión...' },
  { id: 3, title: 'El retorno del rey (4K)',           section: 'lotr',     img: '/img/lord2.jpg',    text: 'Peter Jackson anuncia...' },
  { id: 4, title: 'Castillos medievales y su historia', section: 'medieval', img: '/img/medieval.jpg', text: 'Un recorrido por fortalezas...' },
  { id: 5, title: 'Remake de KOTOR rumores',           section: 'starwars', img: '/img/starwars2.jpg', text: 'Nuevas pistas sugieren...' },
  { id: 6, title: 'Nuevo spin-off de Gollum (ojalá no 😅)', section: 'lotr', img: '/img/LotR2.jpg',    text: 'Se filtra un pitch...' },
];

const alertBox   = document.getElementById('detailAlert');
const imgEl      = document.getElementById('detailImg');
const titleEl    = document.getElementById('detailTitle');
const excerptEl  = document.getElementById('detailExcerpt');
const contentEl  = document.getElementById('detailContent');
const sectionEl  = document.getElementById('detailSection');
const dateEl     = document.getElementById('detailDate');

function showAlert(type, text) {
  alertBox.className = `alert alert-${type}`;
  alertBox.textContent = text;
  alertBox.classList.remove('d-none');
}

function formatDate(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleString();
  } catch { return ''; }
}

async function loadDetail() {
  // Limpia el contenido antes de pintar (evita “quedarse” con lo anterior)
  imgEl.src = '';
  imgEl.alt = '';
  titleEl.textContent = '';
  excerptEl.textContent = '';
  sectionEl.textContent = '';
  dateEl.textContent = '';
  contentEl.innerHTML = '';

  const params = new URLSearchParams(location.search);
  const id = Number(params.get('id'));
  const type = (params.get('type') || 'db').toLowerCase();

  if (!id) {
    showAlert('danger', 'Falta el parámetro id.');
    return;
  }

  if (type === 'local') {
    const n = LOCAL_NEWS.find(x => x.id === id);
    if (!n) {
      showAlert('danger', 'Noticia local no encontrada.');
      titleEl.textContent = 'Noticia no encontrada';
      contentEl.innerHTML = '<p class="text-secondary">Verifica el enlace.</p>';
      return;
    }
    imgEl.src = n.img || '';
    imgEl.alt = n.title || '';
    titleEl.textContent = n.title || '';
    excerptEl.textContent = n.text || '';
    sectionEl.textContent = n.section || '';
    dateEl.textContent = '';
    contentEl.innerHTML = `<p>${(n.text || '').replace(/\n/g, '<br>')}</p>`;
    return;
  }

  // type === 'db'
  try {
    const res = await fetch(`/api/news/${id}`);
    const data = await res.json();
    if (!res.ok || !data.ok || !data.item) {
      showAlert('danger', data.msg || `No se pudo cargar la noticia #${id}`);
      titleEl.textContent = 'Noticia no encontrada';
      contentEl.innerHTML = '<p class="text-secondary">Es posible que haya sido eliminada o no esté publicada.</p>';
      return;
    }
    const item = data.item;

    imgEl.src = item.image_url || '/img/medieval.jpg';
    imgEl.alt = item.title || '';
    titleEl.textContent = item.title || '';
    excerptEl.textContent = item.excerpt || '';
    sectionEl.textContent = item.section || '';
    dateEl.textContent = formatDate(item.created_at);

    const html = (item.content || item.excerpt || '')
      .split(/\n{2,}/)
      .map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`)
      .join('');
    contentEl.innerHTML = html || '<p class="text-secondary">Sin contenido.</p>';

  } catch (e) {
    console.error(e);
    showAlert('danger', 'Error de conexión al cargar la noticia.');
    titleEl.textContent = 'Error de conexión';
    contentEl.innerHTML = '<p class="text-secondary">Intenta de nuevo más tarde.</p>';
  }
}


loadDetail();
