// public/main.js

// ===== 1) Noticias locales (las por defecto) =====
const LOCAL_NEWS = [
  { id: 1, title: 'Pokémon Legends: Nueva expansión', section: 'pokemon', img: '/img/pokemon.jpg',  text: 'Game Freak confirma detalles...' },
  { id: 2, title: 'El sable perdido de Luke Skywalker', section: 'starwars', img: '/img/starwars.jpg', text: 'Fans descubren una conexión...' },
  { id: 3, title: 'El retorno del rey (4K)',           section: 'lotr',     img: '/img/lord2.jpg',    text: 'Peter Jackson anuncia...' },
  { id: 4, title: 'Castillos medievales y su historia', section: 'medieval', img: '/img/medieval.jpg', text: 'Un recorrido por fortalezas...' },
  { id: 5, title: 'Remake de KOTOR rumores',           section: 'starwars', img: '/img/starwars2.jpg', text: 'Nuevas pistas sugieren...' },
  { id: 6, title: 'Nuevo spin-off de Gollum (ojalá no 😅)', section: 'lotr', img: '/img/LotR2.jpg',    text: 'Se filtra un pitch...' },
].map(n => ({ ...n, source: 'local', idDisplay: n.id, idReal: n.id }));

const newsGrid = document.getElementById('newsGrid');
const navLinks = document.querySelectorAll('[data-section]');
const btnAll  = document.getElementById('btnAll');
const btnFavs = document.getElementById('btnFavs');

// ===== 2) Estado =====
let me = { loggedIn: false };
let favSet = new Set();           // contiene IDs tal como se guardan en backend
let dbNews = [];                  // noticias traídas de /api/news (mapeadas)
let allNews = [];                 // fusión LOCAL + BD
let currentSection = 'all';       // all | pokemon | starwars | lotr | medieval
let showOnlyFavs   = false;       // false = todas, true = solo favoritos

// ===== 3) Utilidades =====
async function loadSession() {
  try {
    const r = await fetch('/api/me');
    me = await r.json();
  } catch {
    me = { loggedIn: false };
  }
}

async function loadFavorites() {
  if (!me.loggedIn) {
    favSet = new Set();
    return;
  }
  try {
    const r = await fetch('/api/favorites');
    const data = await r.json();
    if (data && data.ok && Array.isArray(data.items)) {
      favSet = new Set(data.items);
    }
  } catch {
    favSet = new Set();
  }
}

// Trae noticias publicadas de BD y hace mapeo seguro de IDs
async function loadDbNews() {
  try {
    const r = await fetch('/api/news?limit=50');
    const data = await r.json();
    if (!data || !data.ok || !Array.isArray(data.items)) {
      dbNews = [];
      return;
    }

    const usedLocalIds = new Set(LOCAL_NEWS.map(n => n.id)); // para detectar choques
    dbNews = data.items.map(row => {
      // row: {id, title, section, image_url, excerpt, created_at}
      const realId = Number(row.id);
      // Si por casualidad choca con un id local, en el front usamos uno "presentación"
      const idDisplay = usedLocalIds.has(realId) ? realId + 100000 : realId;

      return {
        source: 'db',
        idReal: realId,       // este es el que usamos para favoritos en backend
        idDisplay,            // este es el que usamos en el DOM si hubiera choque
        title: row.title,
        section: row.section,
        img: row.image_url || '/img/medieval.jpg', // placeholder simple si viene vacío
        text: row.excerpt || '',
        created_at: row.created_at
      };
    });
  } catch {
    dbNews = [];
  }
}

function computeItemsToRender() {
  // 1) Filtra por categoría
  let base = currentSection === 'all'
    ? allNews
    : allNews.filter(n => n.section === currentSection);

  // 2) Si es "solo favoritos", filtra por si su id "para el backend" está en favSet
  if (showOnlyFavs) {
    base = base.filter(n => favSet.has(n.idReal));
  }
  return base;
}

function renderCards(items) {
  if (!newsGrid) return;
  newsGrid.innerHTML = '';

  if (!items.length) {
    newsGrid.innerHTML = `
      <div class="col-12">
        <p class="text-center text-secondary mb-0">
          ${showOnlyFavs ? 'No tienes favoritos en esta categoría.' : 'No hay noticias para esta categoría.'}
        </p>
      </div>`;
    return;
  }

  const frag = document.createDocumentFragment();

  items.forEach(n => {
    // El corazón debe considerar si el ID "real" (de backend) está en favSet
    const isFav = favSet.has(n.idReal);

    const col = document.createElement('div');
    col.className = 'col-md-4';

    col.innerHTML = `
      <div class="card h-100 shadow-sm">
        <img src="${n.img}" class="card-img-top" alt="${n.title}">
        <div class="card-body d-flex flex-column">
          <h5 class="card-title">${n.title}</h5>
          <p class="card-text flex-grow">${n.text}</p>

          <!-- Footer de la card: sección + Leer más + corazón -->
          <div class="d-flex justify-content-between align-items-center">
            <span class="badge text-bg-secondary text-uppercase">${n.section}</span>

            <div class="d-flex gap-2">
              <a class="btn btn-sm btn-outline-primary"
                 href="/news.html?id=${n.idReal}&type=${n.source}">
                Leer más
              </a>

              <button
                class="btn btn-sm ${isFav ? 'btn-danger' : 'btn-outline-danger'} fav-btn"
                data-id="${n.idReal}"
                title="${isFav ? 'Quitar de favoritos' : 'Agregar a favoritos'}"
              >
                ${isFav ? '♥' : '♡'}
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    frag.appendChild(col);
  });

  newsGrid.appendChild(frag);

  // Click en corazones
  document.querySelectorAll('.fav-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const idForBackend = Number(btn.dataset.id); // siempre el id REAL para el backend
      if (!me.loggedIn) {
        window.location.href = '/login.html';
        return;
      }
      try {
        const res = await fetch(`/api/favorites/${idForBackend}`, { method: 'POST' });
        const data = await res.json();
        if (data && data.ok) {
          // Actualiza favSet con lo que responde el backend (ids reales)
          favSet = new Set(data.items);

          // Si estamos en "solo favoritos", re-renderiza todo (podría desaparecer una card)
          if (showOnlyFavs) {
            renderCards(computeItemsToRender());
            return;
          }

          // Si no, sólo actualiza el botón
          const isFav = favSet.has(idForBackend);
          btn.className = `btn btn-sm ${isFav ? 'btn-danger' : 'btn-outline-danger'} fav-btn`;
          btn.textContent = isFav ? '♥' : '♡';
          btn.title = isFav ? 'Quitar de favoritos' : 'Agregar a favoritos';
        }
      } catch (e) {
        console.error('FAVORITE TOGGLE ERROR', e);
      }
    });
  });
}

// ===== 4) Listeners de UI =====
navLinks.forEach(link => {
  link.addEventListener('click', (e) => {
    const href = link.getAttribute('href') || '#';
    const section = link.dataset.section;
    if (href === '#') e.preventDefault();

    navLinks.forEach(l => l.classList.remove('active'));
    link.classList.add('active');

    currentSection = section || 'all';
    renderCards(computeItemsToRender());
  });
});

if (btnAll && btnFavs) {
  btnAll.addEventListener('click', () => {
    showOnlyFavs = false;
    btnAll.classList.add('active');
    btnFavs.classList.remove('active');
    renderCards(computeItemsToRender());
  });

  btnFavs.addEventListener('click', () => {
    if (!me.loggedIn) {
      window.location.href = '/login.html';
      return;
    }
    showOnlyFavs = true;
    btnFavs.classList.add('active');
    btnAll.classList.remove('active');
    renderCards(computeItemsToRender());
  });
}

// ===== 5) Boot =====
(async () => {
  await loadSession();
  await loadFavorites();
  await loadDbNews();

  // Fusión: BD (mapeada) + LOCAL
  // allNews: objeto unificado con {idReal, idDisplay, title, section, img, text, source}
  const localMapped = LOCAL_NEWS.map(n => ({
    source: 'local',
    idReal: n.id,       // al backend le mandamos estos ids si marcas favoritos en locales
    idDisplay: n.id,    // no hay choque con locales mismos
    title: n.title,
    section: n.section,
    img: n.img,
    text: n.text
  }));

  allNews = [...dbNews, ...localMapped];

  renderCards(computeItemsToRender());
})();
