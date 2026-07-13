/* Supabase — REST API (работает с publishable keys sb_publishable_...) */
const SB_TOKEN_KEY = 'unorobe_access_token';

function sbConfig() {
  return UNOROBE_CONFIG?.supabase || {};
}

function isSupabaseConfigured() {
  const c = sbConfig();
  return !!(c.url && c.anonKey && c.url.startsWith('http'));
}

function sbAuthToken() {
  return sessionStorage.getItem(SB_TOKEN_KEY) || sbConfig().anonKey;
}

async function sbFetch(path, options = {}) {
  const cfg = sbConfig();
  const headers = {
    apikey: cfg.anonKey,
    Authorization: `Bearer ${sbAuthToken()}`,
    ...(options.headers || {}),
  };
  const res = await fetch(`${cfg.url}/rest/v1/${path}`, { ...options, headers });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || `Supabase ${res.status}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

function dbProductToApp(row) {
  return normalizeProduct({
    id: row.id,
    sku: row.sku,
    title: row.title,
    titleRu: row.title_ru,
    description: row.description,
    price: row.price,
    image: row.image,
    category: row.category,
    categoryRu: row.category_ru,
    color: row.color,
    colorRu: row.color_ru,
    available: row.available,
    trackSizes: row.track_sizes,
    sizes: row.sizes || [],
    active: row.active,
  });
}

function appProductToDb(p) {
  return {
    id: p.id,
    sku: p.sku,
    title: p.title || '',
    title_ru: p.titleRu || p.title || '',
    description: p.description || '',
    price: p.price,
    image: p.image || '',
    category: p.category || 'midi',
    category_ru: p.categoryRu || CATEGORY_LABELS[p.category] || 'Миди',
    color: p.color || 'other',
    color_ru: p.colorRu || 'Другой',
    available: p.available !== false,
    track_sizes: !!p.trackSizes,
    sizes: p.trackSizes ? (p.sizes || []) : [],
    active: p.active !== false,
  };
}

async function supabaseLoadCatalog(includeHidden = false) {
  if (!isSupabaseConfigured()) return null;
  const path = includeHidden
    ? 'products?select=*&order=created_at.desc'
    : 'products?select=*&active=eq.true&order=created_at.desc';
  const data = await sbFetch(path);
  return (data || []).map(dbProductToApp);
}

async function supabaseLoadReviews(includeHidden = false) {
  if (!isSupabaseConfigured()) return null;
  const path = includeHidden
    ? 'reviews?select=*&order=created_at.desc'
    : 'reviews?select=*&approved=eq.true&order=created_at.desc';
  const data = await sbFetch(path);
  return (data || []).map((r) => ({
    id: r.id,
    author: r.author,
    text: r.text,
    rating: r.rating || 5,
    approved: r.approved,
  }));
}

async function supabaseSaveProduct(product) {
  await sbFetch('products', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify(appProductToDb(product)),
  });
}

async function supabaseHideProduct(id) {
  await sbFetch(`products?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ active: false }),
  });
}

async function supabaseShowProduct(id) {
  await sbFetch(`products?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ active: true }),
  });
}

async function supabaseHardDeleteProduct(id) {
  await sbFetch(`products?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' });
}

/** @deprecated use supabaseHideProduct */
async function supabaseDeleteProduct(id) {
  return supabaseHideProduct(id);
}

async function supabaseSaveReview(review) {
  await sbFetch('reviews', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify({
      id: review.id,
      author: review.author,
      text: review.text,
      rating: review.rating || 5,
      approved: !!review.approved,
    }),
  });
}

async function supabaseDeleteReview(id) {
  await sbFetch(`reviews?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' });
}

async function supabaseUploadImage(file, productId) {
  const cfg = sbConfig();
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const path = `${productId}.${ext}`;
  const res = await fetch(`${cfg.url}/storage/v1/object/products/${path}`, {
    method: 'POST',
    headers: {
      apikey: cfg.anonKey,
      Authorization: `Bearer ${sbAuthToken()}`,
      'Content-Type': file.type || 'image/jpeg',
      'x-upsert': 'true',
    },
    body: file,
  });
  if (!res.ok) throw new Error(await res.text());
  return `${cfg.url}/storage/v1/object/public/products/${path}`;
}

async function supabaseSignIn(email, password) {
  const cfg = sbConfig();
  const res = await fetch(`${cfg.url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: cfg.anonKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.msg || 'Invalid login credentials');
  sessionStorage.setItem(SB_TOKEN_KEY, data.access_token);
  return data.user;
}

async function supabaseSignOut() {
  sessionStorage.removeItem(SB_TOKEN_KEY);
}

async function supabaseGetSession() {
  const token = sessionStorage.getItem(SB_TOKEN_KEY);
  if (!token) return null;
  const cfg = sbConfig();
  const res = await fetch(`${cfg.url}/auth/v1/user`, {
    headers: { apikey: cfg.anonKey, Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    sessionStorage.removeItem(SB_TOKEN_KEY);
    return null;
  }
  const user = await res.json();
  return { user, access_token: token };
}

async function supabaseSubmitPublicReview(review) {
  await sbFetch('reviews', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: review.id,
      author: review.author,
      text: review.text,
      rating: review.rating || 5,
      approved: false,
    }),
  });
  return true;
}
