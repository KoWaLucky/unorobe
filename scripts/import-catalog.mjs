#!/usr/bin/env node
/**
 * Импорт catalog.json и reviews.json в Supabase
 * Запуск:
 *   SUPABASE_ANON_KEY=eyJ... node scripts/import-catalog.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const URL = process.env.SUPABASE_URL || 'https://luzmjxmwtkskyhbvgzoa.supabase.co';
const ANON = process.env.SUPABASE_ANON_KEY || '';
const EMAIL = process.env.SUPABASE_EMAIL || 'admin@unorobe.ru';
const PASS = process.env.SUPABASE_PASSWORD || 'Adminka1188!';
const SITE = 'https://kowalucky.github.io/unorobe';

if (!ANON) {
  console.error('Укажите SUPABASE_ANON_KEY (Settings → API → anon public)');
  process.exit(1);
}

const CATEGORY_LABELS = { mini: 'Мини', midi: 'Миди', maxi: 'Макси', outer: 'Жакеты и блузы' };

function toDbProduct(p) {
  const image = p.image?.startsWith('http') ? p.image : `${SITE}/${p.image}`;
  return {
    id: String(p.id),
    sku: p.sku,
    title: p.title || '',
    title_ru: p.titleRu || p.title || '',
    description: p.description || '',
    price: p.price,
    image,
    category: p.category || 'midi',
    category_ru: p.categoryRu || CATEGORY_LABELS[p.category] || 'Миди',
    color: p.color || 'other',
    color_ru: p.colorRu || 'Другой',
    available: p.available !== false,
    track_sizes: !!p.trackSizes,
    sizes: p.sizes || [],
    active: p.active !== false,
  };
}

async function signIn() {
  const res = await fetch(`${URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASS }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.msg || 'Ошибка входа');
  return data.access_token;
}

async function upsert(table, rows, token) {
  const res = await fetch(`${URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      apikey: ANON,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates',
    },
    body: JSON.stringify(rows),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`${table}: ${err}`);
  }
}

const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/catalog.json'), 'utf8'));
const reviews = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/reviews.json'), 'utf8'));

console.log('Вход в Supabase...');
const token = await signIn();
console.log('OK');

console.log(`Импорт ${catalog.length} товаров...`);
for (let i = 0; i < catalog.length; i += 20) {
  const chunk = catalog.slice(i, i + 20).map(toDbProduct);
  await upsert('products', chunk, token);
  console.log(`  ${Math.min(i + 20, catalog.length)} / ${catalog.length}`);
}

console.log(`Импорт ${reviews.length} отзывов...`);
await upsert('reviews', reviews.map((r) => ({
  id: r.id,
  author: r.author,
  text: r.text,
  rating: r.rating || 5,
  approved: !!r.approved,
})), token);

console.log('Готово! Каталог и отзывы в базе.');
