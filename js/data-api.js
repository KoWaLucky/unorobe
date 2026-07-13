/* UNO RÓBE — загрузка каталога и отзывов */
const CATEGORY_LABELS = {
  mini: 'Мини',
  midi: 'Миди',
  maxi: 'Макси',
  outer: 'Жакеты и блузы',
};

let PRODUCTS = [];
let REVIEWS = [];

const CATALOG_CACHE_KEY = 'unorobe_catalog_v1';
const REVIEWS_CACHE_KEY = 'unorobe_reviews_v1';
const CATALOG_VERSION_KEY = 'unorobe_catalog_ver';
const CACHE_TTL_MS = 2 * 60 * 1000;

function readCache(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const { ts, data, ver } = JSON.parse(raw);
    const currentVer = localStorage.getItem(CATALOG_VERSION_KEY) || '0';
    if (key === CATALOG_CACHE_KEY && ver && ver !== currentVer) return null;
    if (!data || Date.now() - ts > CACHE_TTL_MS) return null;
    return data;
  } catch (e) {
    return null;
  }
}

function writeCache(key, data) {
  try {
    const payload = { ts: Date.now(), data };
    if (key === CATALOG_CACHE_KEY) {
      payload.ver = localStorage.getItem(CATALOG_VERSION_KEY) || String(Date.now());
    }
    localStorage.setItem(key, JSON.stringify(payload));
  } catch (e) { /* quota */ }
}

function bumpCatalogVersion() {
  const ver = String(Date.now());
  try { localStorage.setItem(CATALOG_VERSION_KEY, ver); } catch (e) { /* ignore */ }
  return ver;
}

function applyCachedCatalog() {
  const cached = readCache(CATALOG_CACHE_KEY);
  if (!cached?.length) return false;
  PRODUCTS = cached.map((p) => ({ ...p, priceFormatted: p.priceFormatted || formatPrice(p.price) }));
  return true;
}

function applyCachedReviews() {
  const cached = readCache(REVIEWS_CACHE_KEY);
  if (!cached) return false;
  REVIEWS = cached;
  return true;
}

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
  const localUrl = path.startsWith('http') ? path : `${path}?v=${Math.floor(Date.now() / CACHE_TTL_MS)}`;
  try {
    const localRes = await fetch(localUrl);
    if (localRes.ok) return parseJsonResponse(localRes);
  } catch (e) { /* offline */ }

  const base = dataBaseUrl();
  if (base) {
    const remoteRes = await fetch(`${base}/${path}?t=${Date.now()}`);
    if (remoteRes.ok) return parseJsonResponse(remoteRes);
  }
  throw new Error(`Не удалось загрузить ${path}`);
}

async function parseJsonResponse(res) {
  if (res.status === 204 || res.status === 205) return null;
  const text = await res.text();
  if (!text.trim()) return null;
  try {
    return JSON.parse(text);
  } catch (e) {
    throw new Error('Некорректный ответ сервера');
  }
}

async function loadCatalog() {
  if (isSupabaseConfigured()) {
    try {
      const data = await supabaseLoadCatalog();
      if (data?.length) {
        PRODUCTS = data;
        writeCache(CATALOG_CACHE_KEY, data);
        return PRODUCTS;
      }
    } catch (e) {
      console.warn('Supabase catalog fallback:', e.message);
    }
  }

  try {
    const data = await fetchJson('data/catalog.json');
    PRODUCTS = data.filter((p) => p.active !== false).map(normalizeProduct);
    writeCache(CATALOG_CACHE_KEY, PRODUCTS);
    return PRODUCTS;
  } catch (e) {
    if (typeof window.PRODUCTS_STATIC !== 'undefined') {
      PRODUCTS = window.PRODUCTS_STATIC.map(normalizeProduct);
      writeCache(CATALOG_CACHE_KEY, PRODUCTS);
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
        writeCache(REVIEWS_CACHE_KEY, data);
        return REVIEWS;
      }
    } catch (e) {
      console.warn('Supabase reviews fallback:', e.message);
    }
  }
  try {
    REVIEWS = await fetchJson('data/reviews.json');
    writeCache(REVIEWS_CACHE_KEY, REVIEWS);
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
