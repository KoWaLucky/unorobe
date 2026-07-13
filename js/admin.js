/* UNO RÓBE — админ-панель (вход: email + пароль) */
let adminCatalog = [];
let adminReviews = [];
let editingProductId = null;
let productFilter = 'active';

const $ = (sel) => document.querySelector(sel);

function showToast(msg, ok = true) {
  const el = $('#admin-toast');
  if (!el) return;
  el.textContent = msg;
  el.className = `admin-toast show ${ok ? 'ok' : 'err'}`;
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => el.classList.remove('show'), 3200);
}

function switchTab(name) {
  document.querySelectorAll('.admin-tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === name));
  document.querySelectorAll('.admin-panel').forEach((p) => p.classList.toggle('active', p.id === `panel-${name}`));
}

async function loadAdminData() {
  if (isSupabaseConfigured()) {
    adminCatalog = await supabaseLoadCatalog(true);
    adminReviews = await supabaseLoadReviews(true);
    return;
  }
  adminCatalog = await fetchJson('data/catalog.json');
  adminReviews = await fetchJson('data/reviews.json');
}

function getFilteredAdminProducts() {
  if (productFilter === 'hidden') return adminCatalog.filter((p) => p.active === false);
  if (productFilter === 'all') return adminCatalog;
  return adminCatalog.filter((p) => p.active !== false);
}

function emptyProductsMessage() {
  if (productFilter === 'hidden') return 'Скрытых товаров нет';
  if (productFilter === 'all') return 'Нет товаров';
  return 'Нет товаров на сайте';
}

function renderProductsTable() {
  const tbody = $('#products-table tbody');
  if (!tbody) return;
  const items = getFilteredAdminProducts();
  document.querySelectorAll('[data-product-filter]').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.productFilter === productFilter);
  });
  if (!items.length) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-muted">${emptyProductsMessage()}</td></tr>`;
    return;
  }
  tbody.innerHTML = items.map((p) => {
    const hidden = p.active === false;
    const sizes = p.trackSizes && p.sizes?.length
      ? p.sizes.map((s) => `${s.size}:${s.stock}`).join(', ')
      : '—';
    const status = hidden
      ? '<span class="badge bg-secondary">Скрыт</span>'
      : '<span class="badge bg-success">На сайте</span>';
    const actions = hidden
      ? `<button class="btn btn-sm btn-outline-dark" data-edit="${p.id}">Изменить</button>
         <button class="btn btn-sm btn-outline-success" data-show="${p.id}">Показать</button>
         <button class="btn btn-sm btn-outline-danger" data-hard-del="${p.id}">Удалить</button>`
      : `<button class="btn btn-sm btn-outline-dark" data-edit="${p.id}">Изменить</button>
         <button class="btn btn-sm btn-outline-secondary" data-hide="${p.id}">Скрыть</button>
         <button class="btn btn-sm btn-outline-danger" data-hard-del="${p.id}">Удалить</button>`;
    return `<tr class="${hidden ? 'product-row-hidden' : ''}">
      <td><img src="${p.image}" alt="" class="admin-thumb"></td>
      <td><strong>${p.titleRu || p.title}</strong><br><small class="text-muted">${p.sku}</small></td>
      <td>${Number(p.price).toLocaleString('ru-RU')} ₽</td>
      <td>${p.categoryRu || p.category}</td>
      <td>${sizes}</td>
      <td>${status}</td>
      <td class="text-end"><div class="admin-actions">${actions}</div></td>
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

function ensureEditingProductId() {
  if (!editingProductId) editingProductId = newProductId();
  return editingProductId;
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
  $('#pf-active').checked = p?.active !== false;
  $('#pf-available').checked = p?.available !== false;
  $('#pf-trackSizes').checked = !!p?.trackSizes;
  $('#pf-image-url').value = p?.image || '';
  $('#pf-image-preview').src = p?.image || '';
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
  const id = existing?.id || ensureEditingProductId();
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
    active: $('#pf-active').checked,
  };
}

async function saveProduct(item) {
  if (isSupabaseConfigured()) {
    await supabaseSaveProduct(item);
    return;
  }
  throw new Error('Supabase не настроен — см. инструкцию на экране входа');
}

async function saveReviewItem(review) {
  if (isSupabaseConfigured()) {
    await supabaseSaveReview(review);
    return;
  }
  throw new Error('Supabase не настроен');
}

async function handleImageUpload(file) {
  if (!file) return;
  const id = ensureEditingProductId();
  if (isSupabaseConfigured()) {
    const url = await supabaseUploadImage(file, id);
    $('#pf-image-url').value = url;
    $('#pf-image-preview').src = url;
    showToast('Фото загружено');
    return;
  }
  throw new Error('Загрузка фото доступна после настройки Supabase');
}

function showSetupNotice() {
  const el = $('#setup-notice');
  if (!el) return;
  el.classList.toggle('hidden', isSupabaseConfigured());
}

function bindEvents() {
  $('#login-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!isSupabaseConfigured()) {
      showToast('Сначала настройте Supabase (инструкция ниже)', false);
      return;
    }
    try {
      const user = await supabaseSignIn($('#login-email').value.trim(), $('#login-password').value);
      $('#login-screen').classList.add('hidden');
      $('#admin-app').classList.remove('hidden');
      $('#admin-user').textContent = user.email;
      await loadAdminData();
      renderProductsTable();
      renderReviewsTable();
      showToast('Вход выполнен');
    } catch (err) {
      showToast(err.message || 'Ошибка входа', false);
    }
  });

  $('#btn-logout')?.addEventListener('click', async () => {
    await supabaseSignOut();
    location.reload();
  });

  document.querySelectorAll('.admin-tab').forEach((tab) => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  });

  document.querySelectorAll('[data-product-filter]').forEach((btn) => {
    btn.addEventListener('click', () => {
      productFilter = btn.dataset.productFilter;
      renderProductsTable();
    });
  });

  $('#btn-add-product')?.addEventListener('click', () => {
    editingProductId = null;
    fillProductForm();
  });
  $('#btn-close-form')?.addEventListener('click', () => $('#product-form').classList.remove('open'));

  $('#pf-trackSizes')?.addEventListener('change', (e) => {
    $('#sizes-block').style.display = e.target.checked ? '' : 'none';
  });

  $('#btn-add-size')?.addEventListener('click', () => {
    renderSizesInputs(collectSizes().concat([{ size: '', stock: 0 }]));
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
    const form = e.target;
    const btn = form.querySelector('[type="submit"]');
    const item = readProductForm();
    if (!item.titleRu) {
      showToast('Укажите название товара', false);
      return;
    }
    btn.disabled = true;
    btn.textContent = 'Сохранение…';
    try {
      await saveProduct(item);
      bumpCatalogVersion();
      try { localStorage.removeItem(CATALOG_CACHE_KEY); } catch (err) { /* ignore */ }
      $('#product-form').classList.remove('open');
      editingProductId = null;
      showToast('Товар сохранён — уже на сайте');
      try {
        await loadAdminData();
        renderProductsTable();
      } catch (reloadErr) {
        console.warn('Reload after save:', reloadErr);
        showToast('Сохранено. Обновите страницу, если список не обновился.', true);
      }
    } catch (err) {
      const msg = err?.message || 'Ошибка сохранения';
      if (msg.includes('JWT') || msg.includes('401') || msg.includes('403')) {
        showToast('Сессия истекла — войдите заново', false);
      } else {
        showToast(msg, false);
      }
    } finally {
      btn.disabled = false;
      btn.textContent = 'Сохранить товар';
    }
  });

  $('#products-table')?.addEventListener('click', async (e) => {
    const editId = e.target.closest('[data-edit]')?.dataset.edit;
    const hideId = e.target.closest('[data-hide]')?.dataset.hide;
    const showId = e.target.closest('[data-show]')?.dataset.show;
    const hardDelId = e.target.closest('[data-hard-del]')?.dataset.hardDel;

    if (editId) {
      fillProductForm(adminCatalog.find((p) => p.id === editId));
      return;
    }
    if (hideId && confirm('Скрыть товар с сайта? Его можно будет вернуть во вкладке «Скрытые».')) {
      try {
        if (isSupabaseConfigured()) await supabaseHideProduct(hideId);
        bumpCatalogVersion();
        try { localStorage.removeItem(CATALOG_CACHE_KEY); } catch (err) { /* ignore */ }
        await loadAdminData();
        renderProductsTable();
        showToast('Товар скрыт с сайта');
      } catch (err) {
        showToast(err.message, false);
      }
      return;
    }
    if (showId) {
      try {
        if (isSupabaseConfigured()) await supabaseShowProduct(showId);
        bumpCatalogVersion();
        try { localStorage.removeItem(CATALOG_CACHE_KEY); } catch (err) { /* ignore */ }
        await loadAdminData();
        productFilter = 'active';
        renderProductsTable();
        showToast('Товар снова на сайте');
      } catch (err) {
        showToast(err.message, false);
      }
      return;
    }
    if (hardDelId && confirm('Удалить товар навсегда? Это действие нельзя отменить.')) {
      try {
        if (isSupabaseConfigured()) await supabaseHardDeleteProduct(hardDelId);
        bumpCatalogVersion();
        try { localStorage.removeItem(CATALOG_CACHE_KEY); } catch (err) { /* ignore */ }
        await loadAdminData();
        renderProductsTable();
        if (editingProductId === hardDelId) $('#product-form').classList.remove('open');
        showToast('Товар удалён');
      } catch (err) {
        showToast(err.message, false);
      }
    }
  });

  $('#review-add-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const review = {
      id: `r${Date.now()}`,
      author: $('#rv-author').value.trim(),
      text: $('#rv-text').value.trim(),
      rating: parseInt($('#rv-rating').value, 10) || 5,
      approved: $('#rv-approved').checked,
    };
    try {
      await saveReviewItem(review);
      await loadAdminData();
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
      if (r) {
        try {
          await saveReviewItem({ ...r, approved: true });
          await loadAdminData();
          renderReviewsTable();
          showToast('Отзыв опубликован');
        } catch (err) {
          showToast(err.message, false);
        }
      }
    }
    if (delId && confirm('Удалить отзыв?')) {
      try {
        if (isSupabaseConfigured()) await supabaseDeleteReview(delId);
        await loadAdminData();
        renderReviewsTable();
        showToast('Отзыв удалён');
      } catch (err) {
        showToast(err.message, false);
      }
    }
  });

  $('#btn-import-json')?.addEventListener('click', async () => {
    if (!confirm('Импортировать товары из catalog.json в Supabase?')) return;
    try {
      const catalog = await fetchJson('data/catalog.json');
      for (const p of catalog) {
        await supabaseSaveProduct(normalizeProduct(p));
      }
      await loadAdminData();
      renderProductsTable();
      showToast(`Импортировано ${catalog.length} товаров`);
    } catch (err) {
      showToast(err.message, false);
    }
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  showSetupNotice();
  bindEvents();
  if (isSupabaseConfigured()) {
    const session = await supabaseGetSession();
    if (session) {
      $('#login-screen').classList.add('hidden');
      $('#admin-app').classList.remove('hidden');
      $('#admin-user').textContent = session.user.email;
      await loadAdminData();
      renderProductsTable();
      renderReviewsTable();
    }
  }
});
