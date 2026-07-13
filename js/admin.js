/* UNO RÓBE — админ-панель */
const ADMIN_SESSION = 'unorobe_admin_ok';

let adminCatalog = [];
let adminReviews = [];
let editingProductId = null;

const $ = (sel) => document.querySelector(sel);

function showToast(msg, ok = true) {
  const el = $('#admin-toast');
  if (!el) return;
  el.textContent = msg;
  el.className = `admin-toast show ${ok ? 'ok' : 'err'}`;
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => el.classList.remove('show'), 3200);
}

function isLoggedIn() {
  return sessionStorage.getItem(ADMIN_SESSION) === '1';
}

function login(password, token) {
  if (password !== UNOROBE_CONFIG.adminPassword) {
    throw new Error('Неверный пароль');
  }
  if (!token || token.length < 20) {
    throw new Error('Нужен GitHub Token (classic, scope: repo)');
  }
  setGhToken(token);
  sessionStorage.setItem(ADMIN_SESSION, '1');
}

function logout() {
  sessionStorage.removeItem(ADMIN_SESSION);
  setGhToken('');
  location.reload();
}

function switchTab(name) {
  document.querySelectorAll('.admin-tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === name));
  document.querySelectorAll('.admin-panel').forEach((p) => p.classList.toggle('active', p.id === `panel-${name}`));
}

async function loadAdminData() {
  adminCatalog = await fetchJson('data/catalog.json');
  adminReviews = await fetchJson('data/reviews.json');
}

function renderProductsTable() {
  const tbody = $('#products-table tbody');
  if (!tbody) return;
  if (!adminCatalog.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-muted">Нет товаров</td></tr>';
    return;
  }
  tbody.innerHTML = adminCatalog.map((p) => {
    const sizes = p.trackSizes && p.sizes?.length
      ? p.sizes.map((s) => `${s.size}:${s.stock}`).join(', ')
      : '—';
    return `<tr>
      <td><img src="${p.image}" alt="" class="admin-thumb"></td>
      <td><strong>${p.titleRu || p.title}</strong><br><small class="text-muted">${p.sku}</small></td>
      <td>${Number(p.price).toLocaleString('ru-RU')} ₽</td>
      <td>${p.categoryRu || p.category}</td>
      <td>${sizes}</td>
      <td class="text-end">
        <button class="btn btn-sm btn-outline-dark" data-edit="${p.id}">Изменить</button>
        <button class="btn btn-sm btn-outline-danger" data-del="${p.id}">Скрыть</button>
      </td>
    </tr>`;
  }).join('');
}

function renderReviewsTable() {
  const tbody = $('#reviews-table tbody');
  if (!tbody) return;
  tbody.innerHTML = adminReviews.map((r) => `<tr>
    <td>${r.author}</td>
    <td>${r.text}</td>
    <td>${'★'.repeat(r.rating || 5)}</td>
    <td>${r.approved ? '<span class="badge bg-success">Да</span>' : '<span class="badge bg-warning text-dark">Модерация</span>'}</td>
    <td class="text-end">
      ${!r.approved ? `<button class="btn btn-sm btn-outline-success" data-approve="${r.id}">Одобрить</button>` : ''}
      <button class="btn btn-sm btn-outline-danger" data-del-review="${r.id}">Удалить</button>
    </td>
  </tr>`).join('');
}

function fillProductForm(p = null) {
  editingProductId = p?.id || null;
  $('#product-form-title').textContent = p ? 'Редактировать товар' : 'Новый товар';
  $('#pf-titleRu').value = p?.titleRu || '';
  $('#pf-title').value = p?.title || '';
  $('#pf-price').value = p?.price || '';
  $('#pf-description').value = p?.description || '';
  $('#pf-category').value = p?.category || 'midi';
  $('#pf-color').value = p?.color || 'other';
  $('#pf-available').checked = p?.available !== false;
  $('#pf-trackSizes').checked = !!p?.trackSizes;
  $('#pf-image-url').value = p?.image || '';
  $('#pf-image-preview').src = p?.image ? p.image : '';
  $('#pf-sku').textContent = p?.sku || nextSku(adminCatalog);
  $('#sizes-block').style.display = p?.trackSizes ? '' : 'none';
  renderSizesInputs(p?.sizes || []);
  $('#product-form').classList.add('open');
}

function renderSizesInputs(sizes) {
  const wrap = $('#sizes-list');
  wrap.innerHTML = (sizes.length ? sizes : [{ size: 'S', stock: 1 }, { size: 'M', stock: 1 }]).map((s, i) => `
    <div class="size-row" data-i="${i}">
      <input type="text" class="form-control form-control-sm size-name" value="${s.size}" placeholder="Размер">
      <input type="number" class="form-control form-control-sm size-stock" value="${s.stock}" min="0" placeholder="Кол-во">
      <button type="button" class="btn btn-sm btn-outline-danger size-remove">×</button>
    </div>`).join('');
}

function collectSizes() {
  return [...document.querySelectorAll('#sizes-list .size-row')].map((row) => ({
    size: row.querySelector('.size-name').value.trim(),
    stock: Math.max(0, parseInt(row.querySelector('.size-stock').value, 10) || 0),
  })).filter((s) => s.size);
}

function readProductForm() {
  const trackSizes = $('#pf-trackSizes').checked;
  const existing = editingProductId ? adminCatalog.find((p) => p.id === editingProductId) : null;
  const id = existing?.id || newProductId();
  const sku = existing?.sku || nextSku(adminCatalog);
  const imageUrl = $('#pf-image-url').value.trim();
  return {
    id,
    sku,
    title: $('#pf-title').value.trim(),
    titleRu: $('#pf-titleRu').value.trim(),
    description: $('#pf-description').value.trim(),
    price: parseFloat($('#pf-price').value) || 0,
    image: imageUrl || `images/products/${id}.jpg`,
    category: $('#pf-category').value,
    categoryRu: CATEGORY_LABELS[$('#pf-category').value] || 'Платья',
    color: $('#pf-color').value,
    colorRu: { black: 'Чёрный', white: 'Белый', light: 'Светлый', red: 'Красный', other: 'Другой' }[$('#pf-color').value] || 'Другой',
    available: $('#pf-available').checked,
    trackSizes,
    sizes: trackSizes ? collectSizes() : [],
    active: true,
  };
}

async function saveAll() {
  await saveCatalog(adminCatalog);
  await saveReviews(adminReviews);
  showToast('Сохранено в GitHub. Сайт обновится через 1–2 мин.');
}

async function handleImageUpload(file) {
  if (!file) return;
  const id = editingProductId || newProductId();
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const path = `images/products/${id}.${ext}`;
  await uploadImage(path, file);
  $('#pf-image-url').value = path;
  $('#pf-image-preview').src = `/${path}`;
  showToast('Фото загружено');
}

function bindEvents() {
  $('#login-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      login($('#login-password').value, $('#login-token').value);
      const user = await verifyGhToken();
      $('#login-screen').classList.add('hidden');
      $('#admin-app').classList.remove('hidden');
      $('#gh-user').textContent = `@${user}`;
      await loadAdminData();
      renderProductsTable();
      renderReviewsTable();
      showToast('Вход выполнен');
    } catch (err) {
      showToast(err.message, false);
    }
  });

  $('#btn-logout')?.addEventListener('click', logout);

  document.querySelectorAll('.admin-tab').forEach((tab) => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  });

  $('#btn-add-product')?.addEventListener('click', () => fillProductForm());
  $('#btn-close-form')?.addEventListener('click', () => $('#product-form').classList.remove('open'));

  $('#pf-trackSizes')?.addEventListener('change', (e) => {
    $('#sizes-block').style.display = e.target.checked ? '' : 'none';
  });

  $('#btn-add-size')?.addEventListener('click', () => {
    const sizes = collectSizes();
    sizes.push({ size: '', stock: 0 });
    renderSizesInputs(sizes);
  });

  $('#sizes-list')?.addEventListener('click', (e) => {
    if (!e.target.classList.contains('size-remove')) return;
    e.target.closest('.size-row')?.remove();
  });

  $('#pf-image-file')?.addEventListener('change', async (e) => {
    try {
      await handleImageUpload(e.target.files[0]);
    } catch (err) {
      showToast(err.message, false);
    }
  });

  $('#product-save-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const item = readProductForm();
    const idx = adminCatalog.findIndex((p) => p.id === item.id);
    if (idx >= 0) adminCatalog[idx] = item;
    else adminCatalog.unshift(item);
    try {
      await saveCatalog(adminCatalog);
      renderProductsTable();
      $('#product-form').classList.remove('open');
      showToast('Товар сохранён');
    } catch (err) {
      showToast(err.message, false);
    }
  });

  $('#products-table')?.addEventListener('click', async (e) => {
    const editId = e.target.closest('[data-edit]')?.dataset.edit;
    const delId = e.target.closest('[data-del]')?.dataset.del;
    if (editId) {
      fillProductForm(adminCatalog.find((p) => p.id === editId));
      return;
    }
    if (delId) {
      if (!confirm('Скрыть товар из каталога?')) return;
      const p = adminCatalog.find((x) => x.id === delId);
      if (p) p.active = false;
      adminCatalog = adminCatalog.filter((x) => x.active !== false);
      try {
        await saveCatalog(adminCatalog);
        renderProductsTable();
        showToast('Товар скрыт');
      } catch (err) {
        showToast(err.message, false);
      }
    }
  });

  $('#review-add-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    adminReviews.unshift({
      id: `r${Date.now()}`,
      author: $('#rv-author').value.trim(),
      text: $('#rv-text').value.trim(),
      rating: parseInt($('#rv-rating').value, 10) || 5,
      approved: $('#rv-approved').checked,
    });
    try {
      await saveReviews(adminReviews);
      renderReviewsTable();
      e.target.reset();
      showToast('Отзыв добавлен');
    } catch (err) {
      showToast(err.message, false);
    }
  });

  $('#reviews-table')?.addEventListener('click', async (e) => {
    const approveId = e.target.closest('[data-approve]')?.dataset.approve;
    const delId = e.target.closest('[data-del-review]')?.dataset.delReview;
    if (approveId) {
      const r = adminReviews.find((x) => x.id === approveId);
      if (r) r.approved = true;
      try {
        await saveReviews(adminReviews);
        renderReviewsTable();
        showToast('Отзыв опубликован');
      } catch (err) {
        showToast(err.message, false);
      }
    }
    if (delId) {
      if (!confirm('Удалить отзыв?')) return;
      adminReviews = adminReviews.filter((x) => x.id !== delId);
      try {
        await saveReviews(adminReviews);
        renderReviewsTable();
        showToast('Отзыв удалён');
      } catch (err) {
        showToast(err.message, false);
      }
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  bindEvents();
  if (isLoggedIn() && getGhToken()) {
    verifyGhToken().then(async (user) => {
      $('#login-screen').classList.add('hidden');
      $('#admin-app').classList.remove('hidden');
      $('#gh-user').textContent = `@${user}`;
      await loadAdminData();
      renderProductsTable();
      renderReviewsTable();
    }).catch(() => logout());
  }
});
