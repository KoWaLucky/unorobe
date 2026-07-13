/* Supabase — каталог и отзывы (без GitHub Token) */
let supabaseClient = null;

function isSupabaseConfigured() {
  const c = typeof UNOROBE_CONFIG !== 'undefined' ? UNOROBE_CONFIG.supabase : null;
  return !!(c?.url && c?.anonKey && c.url.startsWith('http'));
}

function getSupabase() {
  if (!isSupabaseConfigured()) return null;
  if (!supabaseClient && window.supabase) {
    supabaseClient = window.supabase.createClient(
      UNOROBE_CONFIG.supabase.url,
      UNOROBE_CONFIG.supabase.anonKey
    );
  }
  return supabaseClient;
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
  const sb = getSupabase();
  if (!sb) return null;
  let q = sb.from('products').select('*').order('created_at', { ascending: false });
  if (!includeHidden) q = q.eq('active', true);
  const { data, error } = await q;
  if (error) throw error;
  return (data || []).map(dbProductToApp);
}

async function supabaseLoadReviews(includeHidden = false) {
  const sb = getSupabase();
  if (!sb) return null;
  let q = sb.from('reviews').select('*').order('created_at', { ascending: false });
  if (!includeHidden) q = q.eq('approved', true);
  const { data, error } = await q;
  if (error) throw error;
  return (data || []).map((r) => ({
    id: r.id,
    author: r.author,
    text: r.text,
    rating: r.rating || 5,
    approved: r.approved,
  }));
}

async function supabaseSaveProduct(product) {
  const sb = getSupabase();
  const { error } = await sb.from('products').upsert(appProductToDb(product));
  if (error) throw error;
}

async function supabaseDeleteProduct(id) {
  const sb = getSupabase();
  const { error } = await sb.from('products').update({ active: false }).eq('id', id);
  if (error) throw error;
}

async function supabaseSaveReview(review) {
  const sb = getSupabase();
  const { error } = await sb.from('reviews').upsert({
    id: review.id,
    author: review.author,
    text: review.text,
    rating: review.rating || 5,
    approved: !!review.approved,
  });
  if (error) throw error;
}

async function supabaseDeleteReview(id) {
  const sb = getSupabase();
  const { error } = await sb.from('reviews').delete().eq('id', id);
  if (error) throw error;
}

async function supabaseUploadImage(file, productId) {
  const sb = getSupabase();
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const path = `${productId}.${ext}`;
  const { error } = await sb.storage.from('products').upload(path, file, { upsert: true });
  if (error) throw error;
  const { data } = sb.storage.from('products').getPublicUrl(path);
  return data.publicUrl;
}

async function supabaseSignIn(email, password) {
  const sb = getSupabase();
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.user;
}

async function supabaseSignOut() {
  const sb = getSupabase();
  if (sb) await sb.auth.signOut();
}

async function supabaseGetSession() {
  const sb = getSupabase();
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  return data.session;
}

async function supabaseSubmitPublicReview(review) {
  const sb = getSupabase();
  if (!sb) return false;
  const { error } = await sb.from('reviews').insert({
    id: review.id,
    author: review.author,
    text: review.text,
    rating: review.rating || 5,
    approved: false,
  });
  if (error) throw error;
  return true;
}
