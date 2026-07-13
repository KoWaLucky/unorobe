/* UNO RÓBE — загрузка каталога и отзывов */
const CATEGORY_LABELS = {
  mini: 'Мини',
  midi: 'Миди',
  maxi: 'Макси',
  outer: 'Жакеты и блузы',
};

let PRODUCTS = [];
let REVIEWS = [];

function formatPrice(n) {
  return `${Math.round(Number(n)).toLocaleString('ru-RU')} ₽`;
}

function normalizeProduct(raw) {
  const price = Number(raw.price) || 0;
  return {
    id: String(raw.id),
    sku: raw.sku || `UR-${String(raw.id).slice(-4)}`,
    title: raw.title || '',
    titleRu: raw.titleRu || raw.title || '',
    description: raw.description || '',
    descriptionRu: raw.description || '',
    price,
    priceFormatted: formatPrice(price),
    image: raw.image || 'images/hero.jpg',
    category: raw.category || 'midi',
    categoryRu: raw.categoryRu || CATEGORY_LABELS[raw.category] || 'Платья',
    color: raw.color || 'other',
    colorRu: raw.colorRu || 'Другой',
    available: raw.available !== false,
    trackSizes: !!raw.trackSizes,
    sizes: Array.isArray(raw.sizes) ? raw.sizes : [],
    active: raw.active !== false,
  };
}

function dataBaseUrl() {
  const cfg = typeof UNOROBE_CONFIG !== 'undefined' ? UNOROBE_CONFIG.github : null;
  if (cfg?.owner && cfg?.repo) {
    return `https://raw.githubusercontent.com/${cfg.owner}/${cfg.repo}/${cfg.branch || 'main'}`;
  }
  return '';
}

async function fetchJson(path) {
  const base = dataBaseUrl();
  const url = base ? `${base}/${path}?t=${Date.now()}` : path;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Не удалось загрузить ${path}`);
  return res.json();
}

async function loadCatalog() {
  if (isSupabaseConfigured()) {
    try {
      const data = await supabaseLoadCatalog();
      if (data) {
        PRODUCTS = data;
        return PRODUCTS;
      }
    } catch (e) {
      console.warn('Supabase catalog fallback:', e.message);
    }
  }
  try {
    const data = await fetchJson('data/catalog.json');
    PRODUCTS = data.filter((p) => p.active !== false).map(normalizeProduct);
    return PRODUCTS;
  } catch (e) {
    if (typeof window.PRODUCTS_STATIC !== 'undefined') {
      PRODUCTS = window.PRODUCTS_STATIC.map(normalizeProduct);
      return PRODUCTS;
    }
    PRODUCTS = [];
    return PRODUCTS;
  }
}

async function loadReviews() {
  if (isSupabaseConfigured()) {
    try {
      const data = await supabaseLoadReviews();
      if (data) {
        REVIEWS = data;
        return REVIEWS;
      }
    } catch (e) {
      console.warn('Supabase reviews fallback:', e.message);
    }
  }
  try {
    REVIEWS = await fetchJson('data/reviews.json');
    return REVIEWS;
  } catch (e) {
    REVIEWS = [];
    return REVIEWS;
  }
}

function getApprovedReviews() {
  return REVIEWS.filter((r) => r.approved);
}

function getProductById(id) {
  return PRODUCTS.find((p) => String(p.id) === String(id));
}

function nextSku(catalog) {
  let max = 0;
  catalog.forEach((p) => {
    const m = String(p.sku || '').match(/UR-(\d+)/i);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  });
  return `UR-${String(max + 1).padStart(4, '0')}`;
}

function newProductId() {
  return String(Date.now());
}
