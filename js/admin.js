/* UNO RÓBE — админ-панель (вход: email + пароль) */
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

function renderProductsTable() {
  const tbody = $('#products-table tbody');
  if (!tbody) return;
  const items = adminCatalog.filter((p) => p.active !== false);
  if (!items.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-muted">Нет товаров</td></tr>';
    return;
  }
  tbody.innerHTML = items.map((p) => {
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
  const id = editingProductId || newProductId();
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

  $('#btn-add-product')?.addEventListener('click', () => fillProductForm());
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
    const item = readProductForm();
    try {
      await saveProduct(item);
      await loadAdminData();
      renderProductsTable();
      $('#product-form').classList.remove('open');
      showToast('Товар сохранён — уже на сайте');
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
    if (delId && confirm('Скрыть товар из каталога?')) {
      try {
        if (isSupabaseConfigured()) await supabaseDeleteProduct(delId);
        await loadAdminData();
        renderProductsTable();
        showToast('Товар скрыт');
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
