/* UNO RÓBE — каталог, фильтры, русский интерфейс */
const UNOROBE = {
  brand: 'UNO RÓBE',
  tagline: 'Для женщин, которые ведут',
  instagram: 'https://www.instagram.com/unorobeofficial/',
  city: 'Краснодар',
};

const PRICE_FILTERS = [
  { id: 'all', label: 'Все цены', test: () => true },
  { id: 'p1', label: 'до 25 000 ₽', test: (p) => p.price < 25000 },
  { id: 'p2', label: '25 000 – 30 000 ₽', test: (p) => p.price >= 25000 && p.price < 30000 },
  { id: 'p3', label: '30 000 – 40 000 ₽', test: (p) => p.price >= 30000 && p.price < 40000 },
  { id: 'p4', label: 'от 40 000 ₽', test: (p) => p.price >= 40000 },
];

let shopState = {
  category: 'all',
  color: 'all',
  price: 'all',
  query: '',
  sort: '',
};

function displayTitle(product) {
  return product.titleRu || product.title;
}

function productUrl(id) {
  return `single-product.html?id=${id}`;
}

function instagramOrderLink(product) {
  const text = encodeURIComponent(
    `Здравствуйте! Хочу заказать: ${displayTitle(product)} (${product.priceFormatted})`
  );
  return `https://www.instagram.com/direct/t/unorobeofficial/?text=${text}`;
}

/* ===================== Корзина ===================== */
const CART_KEY = 'unorobe_cart';

function getCart() {
  try { return JSON.parse(localStorage.getItem(CART_KEY)) || []; }
  catch (e) { return []; }
}

function saveCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  updateCartCount();
  renderCart();
}

function addToCart(id, size, qty) {
  const product = getProductById(id);
  if (!product) return;
  qty = Math.max(1, parseInt(qty, 10) || 1);
  size = size || '';
  const cart = getCart();
  const existing = cart.find((i) => String(i.id) === String(id) && i.size === size);
  if (existing) existing.qty += qty;
  else cart.push({ id, size, qty });
  saveCart(cart);
  showCartToast(`${displayTitle(product)} — добавлено в корзину`);
}

function removeFromCart(index) {
  const cart = getCart();
  cart.splice(index, 1);
  saveCart(cart);
}

function changeQty(index, delta) {
  const cart = getCart();
  if (!cart[index]) return;
  cart[index].qty = Math.max(1, cart[index].qty + delta);
  saveCart(cart);
}

function cartCount() {
  return getCart().reduce((sum, i) => sum + i.qty, 0);
}

function cartTotal() {
  return getCart().reduce((sum, i) => {
    const p = getProductById(i.id);
    return sum + (p ? p.price * i.qty : 0);
  }, 0);
}

function formatPrice(n) {
  return `${Math.round(n).toLocaleString('ru-RU')} ₽`;
}

function updateCartCount() {
  const n = cartCount();
  document.querySelectorAll('.cart-count').forEach((el) => { el.textContent = n; });
}

function renderCart() {
  const list = document.getElementById('cart-items');
  const empty = document.getElementById('cart-empty');
  const totalEl = document.getElementById('cart-total');
  const checkout = document.getElementById('cart-checkout');
  if (!list) return;

  const cart = getCart();
  if (!cart.length) {
    list.innerHTML = '';
    if (empty) empty.style.display = '';
    if (checkout) checkout.disabled = true;
    if (totalEl) totalEl.textContent = formatPrice(0);
    return;
  }
  if (empty) empty.style.display = 'none';
  if (checkout) checkout.disabled = false;

  list.innerHTML = cart.map((item, index) => {
    const p = getProductById(item.id);
    if (!p) return '';
    const sizeLabel = item.size ? `Размер: ${item.size}` : 'Размер уточнить';
    return `
      <li class="list-group-item px-0 py-3">
        <div class="d-flex gap-3">
          <a href="${productUrl(p.id)}"><img src="${p.image}" alt="${displayTitle(p)}" style="width:64px;height:80px;object-fit:cover;"></a>
          <div class="flex-grow-1">
            <div class="d-flex justify-content-between">
              <a href="${productUrl(p.id)}" class="fw-semibold text-dark text-decoration-none small">${displayTitle(p)}</a>
              <button type="button" class="btn-close btn-sm ms-2" data-cart-remove="${index}" aria-label="Удалить"></button>
            </div>
            <div class="text-muted small">${sizeLabel}</div>
            <div class="d-flex justify-content-between align-items-center mt-2">
              <div class="input-group input-group-sm w-auto">
                <button type="button" class="btn btn-outline-secondary" data-cart-minus="${index}">−</button>
                <span class="btn btn-outline-secondary disabled px-3">${item.qty}</span>
                <button type="button" class="btn btn-outline-secondary" data-cart-plus="${index}">+</button>
              </div>
              <span class="fw-semibold">${formatPrice(p.price * item.qty)}</span>
            </div>
          </div>
        </div>
      </li>`;
  }).join('');

  if (totalEl) totalEl.textContent = formatPrice(cartTotal());
}

function buildOrderText() {
  const cart = getCart();
  const lines = cart.map((item, i) => {
    const p = getProductById(item.id);
    if (!p) return '';
    const size = item.size ? `размер ${item.size}` : 'размер уточнить';
    return `${i + 1}. ${displayTitle(p)} — ${size} × ${item.qty} — ${formatPrice(p.price * item.qty)}`;
  }).filter(Boolean);
  return `Здравствуйте! Хочу оформить заказ в UNO RÓBE:\n\n${lines.join('\n')}\n\nИтого: ${formatPrice(cartTotal())}`;
}

function checkoutToDirect() {
  if (!cartCount()) return;
  const text = buildOrderText();
  const openIg = () => window.open('https://www.instagram.com/direct/t/unorobeofficial/', '_blank');
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text)
      .then(() => { alert('Состав заказа скопирован. Вставьте его в Instagram Direct и отправьте.'); openIg(); })
      .catch(() => { window.prompt('Скопируйте текст заказа и отправьте в Instagram Direct:', text); openIg(); });
  } else {
    window.prompt('Скопируйте текст заказа и отправьте в Instagram Direct:', text);
    openIg();
  }
}

let toastTimer;
function showCartToast(message) {
  let toast = document.getElementById('cart-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'cart-toast';
    toast.style.cssText = 'position:fixed;left:50%;bottom:30px;transform:translateX(-50%);background:#111;color:#fff;padding:14px 22px;z-index:2000;font-size:14px;box-shadow:0 6px 24px rgba(0,0,0,.25);transition:opacity .3s;opacity:0;';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.style.opacity = '1';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.style.opacity = '0'; }, 2200);
}

function initCart() {
  updateCartCount();
  renderCart();

  document.getElementById('cart-checkout')?.addEventListener('click', checkoutToDirect);

  document.getElementById('cart-items')?.addEventListener('click', (e) => {
    const rm = e.target.closest('[data-cart-remove]');
    const minus = e.target.closest('[data-cart-minus]');
    const plus = e.target.closest('[data-cart-plus]');
    if (rm) { removeFromCart(+rm.dataset.cartRemove); }
    else if (minus) { changeQty(+minus.dataset.cartMinus, -1); }
    else if (plus) { changeQty(+plus.dataset.cartPlus, 1); }
  });

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-add-to-cart]');
    if (!btn) return;
    e.preventDefault();
    addToCart(btn.dataset.addToCart, '', 1);
  });
}

function renderProductCard(product) {
  return `
    <div class="col-md-6 col-lg-4 my-4">
      <div class="product-item">
        <div class="image-holder">
          <a href="${productUrl(product.id)}">
            <img src="${product.image}" alt="${displayTitle(product)}" class="product-image img-fluid" loading="lazy">
          </a>
        </div>
        <div class="cart-concern">
          <div class="cart-button d-flex justify-content-between align-items-center">
            <button type="button" data-add-to-cart="${product.id}"
              class="btn-wrap cart-link d-flex align-items-center text-capitalize fs-6 border-0 bg-transparent p-0">
              В корзину
              <svg class="arrow" width="20" height="20"><use xlink:href="#arrow-right"></use></svg>
            </button>
            <a href="${productUrl(product.id)}" class="view-btn" title="Подробнее">
              <svg class="expand" width="16" height="16"><use xlink:href="#expand"></use></svg>
            </a>
          </div>
        </div>
        <div class="d-flex justify-content-between mt-2 gap-2">
          <h5 class="mb-0 flex-grow-1">
            <a href="${productUrl(product.id)}" class="item-name secondary-font">${displayTitle(product)}</a>
          </h5>
          <h5 class="money fw-bold secondary-font text-nowrap mb-0">${product.priceFormatted}</h5>
        </div>
      </div>
    </div>`;
}

function renderSwiperSlide(product) {
  return `
    <div class="swiper-slide">
      <div class="product-item position-relative">
        <a href="${productUrl(product.id)}"><img src="${product.image}" alt="${displayTitle(product)}" class="img-fluid product-image"></a>
        <div class="cart-concern">
          <div class="cart-button d-flex justify-content-between align-items-center">
            <button type="button" data-add-to-cart="${product.id}" class="btn-wrap d-flex align-items-center text-capitalize fs-6 border-0 bg-transparent p-0">
              В корзину <svg class="arrow" width="20" height="20"><use xlink:href="#arrow-right"></use></svg>
            </button>
            <a href="${productUrl(product.id)}" class="view-btn">
              <svg class="expand" width="16" height="16"><use xlink:href="#expand"></use></svg>
            </a>
          </div>
        </div>
        <div class="d-flex justify-content-between mt-2 gap-2">
          <h5 class="mb-0"><a href="${productUrl(product.id)}" class="item-name secondary-font">${displayTitle(product)}</a></h5>
          <h5 class="money fw-bold secondary-font text-nowrap mb-0">${product.priceFormatted}</h5>
        </div>
      </div>
    </div>`;
}

function formatProductsCount(n) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 19) return `${n} товаров`;
  if (mod10 === 1) return `${n} товар`;
  if (mod10 >= 2 && mod10 <= 4) return `${n} товара`;
  return `${n} товаров`;
}

function getFilteredProducts() {
  const priceFilter = PRICE_FILTERS.find((f) => f.id === shopState.price) || PRICE_FILTERS[0];
  let items = PRODUCTS.filter((p) => {
    if (shopState.category !== 'all' && p.category !== shopState.category) return false;
    if (shopState.color !== 'all' && p.color !== shopState.color) return false;
    if (!priceFilter.test(p)) return false;
    if (shopState.query) {
      const q = shopState.query.toLowerCase();
      const hay = `${displayTitle(p)} ${p.title}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  if (shopState.sort === 'price-asc') items.sort((a, b) => a.price - b.price);
  if (shopState.sort === 'price-desc') items.sort((a, b) => b.price - a.price);
  if (shopState.sort === 'name-asc') items.sort((a, b) => displayTitle(a).localeCompare(displayTitle(b), 'ru'));
  if (shopState.sort === 'name-desc') items.sort((a, b) => displayTitle(b).localeCompare(displayTitle(a), 'ru'));
  return items;
}

function renderShopSidebar() {
  const cats = [
    { id: 'all', label: 'Все модели' },
    { id: 'mini', label: 'Мини' },
    { id: 'midi', label: 'Миди' },
    { id: 'maxi', label: 'Макси' },
    { id: 'outer', label: 'Жакеты и блузы' },
  ];
  const colors = [
    { id: 'all', label: 'Все цвета' },
    { id: 'black', label: 'Чёрный' },
    { id: 'white', label: 'Белый' },
    { id: 'light', label: 'Светлый' },
    { id: 'red', label: 'Красный' },
    { id: 'other', label: 'Другие' },
  ];

  const catEl = document.getElementById('filter-categories');
  const colorEl = document.getElementById('filter-colors');
  const priceEl = document.getElementById('filter-prices');

  if (catEl) {
    catEl.innerHTML = cats.map((c) =>
      `<li class="cat-item"><a href="#" class="fw-semibold filter-link ${shopState.category === c.id ? 'active' : ''}" data-filter="category" data-value="${c.id}">${c.label}</a></li>`
    ).join('');
  }
  if (colorEl) {
    colorEl.innerHTML = colors.map((c) =>
      `<li class="tags-item"><a href="#" class="fw-semibold filter-link ${shopState.color === c.id ? 'active' : ''}" data-filter="color" data-value="${c.id}">${c.label}</a></li>`
    ).join('');
  }
  if (priceEl) {
    priceEl.innerHTML = PRICE_FILTERS.map((f) =>
      `<li class="tags-item"><a href="#" class="fw-semibold filter-link ${shopState.price === f.id ? 'active' : ''}" data-filter="price" data-value="${f.id}">${f.label}</a></li>`
    ).join('');
  }
}

function renderShopProducts() {
  const grid = document.getElementById('product-grid');
  const countEl = document.getElementById('products-count');
  if (!grid) return;

  const items = getFilteredProducts();
  if (countEl) countEl.textContent = `Показано ${formatProductsCount(items.length)}`;
  grid.innerHTML = items.length
    ? items.map(renderProductCard).join('')
    : '<div class="col-12"><p class="text-muted py-5 text-center">По вашему запросу ничего не найдено. Попробуйте изменить фильтры.</p></div>';
}

function initShopPage() {
  const grid = document.getElementById('product-grid');
  if (!grid) return;

  renderShopSidebar();
  renderShopProducts();

  document.getElementById('shop-search')?.addEventListener('input', (e) => {
    shopState.query = e.target.value.trim();
    const side = document.getElementById('shop-search-side');
    if (side && side !== e.target) side.value = shopState.query;
    renderShopProducts();
  });

  document.getElementById('shop-search-side')?.addEventListener('input', (e) => {
    shopState.query = e.target.value.trim();
    const main = document.getElementById('shop-search');
    if (main && main !== e.target) main.value = shopState.query;
    renderShopProducts();
  });

  document.getElementById('sort-select')?.addEventListener('change', (e) => {
    shopState.sort = e.target.value;
    renderShopProducts();
  });

  document.querySelector('.sidebar')?.addEventListener('click', (e) => {
    const link = e.target.closest('[data-filter]');
    if (!link) return;
    e.preventDefault();
    shopState[link.dataset.filter] = link.dataset.value;
    renderShopSidebar();
    renderShopProducts();
  });
}

function initHomeSwiperProducts() {
  const wrapper = document.getElementById('home-swiper-wrapper');
  if (!wrapper) return;
  wrapper.innerHTML = PRODUCTS.slice(0, 9).map(renderSwiperSlide).join('');
  if (window.Swiper && document.querySelector('.product-Swiper')) {
    new Swiper('.product-Swiper', {
      slidesPerView: 1,
      spaceBetween: 20,
      navigation: {
        nextEl: '.main-slider-button-next',
        prevEl: '.main-slider-button-prev',
      },
      breakpoints: { 768: { slidesPerView: 3 }, 1200: { slidesPerView: 4 } },
    });
  }
}

function initReviewsSection() {
  const wrapper = document.getElementById('reviews-swiper-wrapper');
  if (!wrapper) return;
  const items = getApprovedReviews();
  if (!items.length) {
    wrapper.innerHTML = '<div class="swiper-slide"><p class="review fw-light fs-5">Пока нет отзывов — будьте первой!</p></div>';
    return;
  }
  wrapper.innerHTML = items.map((r) => `
    <div class="swiper-slide">
      <p class="review fw-light fs-5 lh-base">"${r.text}"</p>
      <span class="fw-bold d-block mt-3">${r.author.toUpperCase()}</span>
    </div>`).join('');
  if (window.Swiper && document.querySelector('.testimonial-Swiper')) {
    new Swiper('.testimonial-Swiper', {
      slidesPerView: 1,
      spaceBetween: 30,
      pagination: { el: '.testimonial-pagination', clickable: true },
      autoplay: { delay: 5000 },
    });
  }
}

function initReviewForm() {
  const form = document.getElementById('public-review-form');
  if (!form) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const author = form.querySelector('[name="author"]').value.trim();
    const text = form.querySelector('[name="text"]').value.trim();
    if (!author || !text) return;
    const msg = form.querySelector('.review-form-msg');
    if (isSupabaseConfigured()) {
      try {
        await supabaseSubmitPublicReview({
          id: `r${Date.now()}`,
          author,
          text,
          rating: 5,
        });
        msg.textContent = 'Спасибо! Отзыв отправлен на модерацию — появится после проверки.';
        form.reset();
        return;
      } catch (err) {
        msg.textContent = 'Не удалось отправить. Напишите нам в Instagram.';
        return;
      }
    }
    const payload = encodeURIComponent(`Отзыв для сайта UNO RÓBE\nИмя: ${author}\n\n${text}`);
    window.open(`https://www.instagram.com/direct/t/unorobeofficial/?text=${payload}`, '_blank');
    msg.textContent = 'Откроется Instagram Direct — отправьте сообщение, мы опубликуем отзыв после проверки.';
    form.reset();
  });
}

function initSingleProductPage() {
  const params = new URLSearchParams(window.location.search);
  const product = getProductById(params.get('id'));
  if (!product) return;

  document.title = `${displayTitle(product)} — ${UNOROBE.brand}`;

  const setText = (sel, text) => {
    const el = document.querySelector(sel);
    if (el) el.textContent = text;
  };

  setText('[data-product-title]', displayTitle(product));
  setText('[data-product-price]', product.priceFormatted);
  setText('[data-product-desc]', product.descriptionRu || product.description || 'Элегантная модель из коллекции UNO RÓBE.');
  setText('[data-tab-description]', product.descriptionRu || product.description || 'Элегантная модель из коллекции UNO RÓBE.');
  setText('[data-product-sku]', product.sku || String(product.id));
  setText('[data-product-category]', product.categoryRu || 'Платья');

  document.querySelectorAll('[data-product-category]').forEach((el) => {
    el.textContent = product.categoryRu || 'Платья';
  });

  const mainImg = document.querySelector('[data-product-image]');
  if (mainImg) {
    mainImg.src = product.image;
    mainImg.alt = displayTitle(product);
  }

  const orderBtn = document.querySelector('[data-instagram-order]');
  if (orderBtn) orderBtn.href = instagramOrderLink(product);

  const breadcrumb = document.querySelector('[data-product-breadcrumb]');
  if (breadcrumb) breadcrumb.textContent = displayTitle(product);

  let selectedSize = 'M';
  const sizeList = document.getElementById('size-select');
  if (sizeList) {
    if (product.trackSizes && product.sizes?.length) {
      sizeList.innerHTML = product.sizes.map((s, i) => {
        const disabled = s.stock <= 0 ? ' disabled' : '';
        const active = i === 0 && s.stock > 0 ? ' active' : '';
        const label = s.stock > 0 ? s.size : `${s.size} (нет)`;
        return `<li data-size="${s.size}" class="select-item pe-3"><a href="#" class="btn btn-light fs-6${active}${disabled}">${label}</a></li>`;
      }).join('');
      const first = product.sizes.find((s) => s.stock > 0);
      selectedSize = first ? first.size : product.sizes[0].size;
    }
    sizeList.addEventListener('click', (e) => {
      const li = e.target.closest('[data-size]');
      if (!li || e.target.classList.contains('disabled')) return;
      e.preventDefault();
      sizeList.querySelectorAll('a').forEach((a) => a.classList.remove('active'));
      li.querySelector('a')?.classList.add('active');
      selectedSize = li.dataset.size;
    });
  }

  const qtyInput = document.getElementById('quantity');
  document.querySelector('.qty-minus')?.addEventListener('click', () => {
    qtyInput.value = Math.max(1, (parseInt(qtyInput.value, 10) || 1) - 1);
  });
  document.querySelector('.qty-plus')?.addEventListener('click', () => {
    qtyInput.value = (parseInt(qtyInput.value, 10) || 1) + 1;
  });

  document.getElementById('add-to-cart')?.addEventListener('click', () => {
    addToCart(product.id, selectedSize, qtyInput ? qtyInput.value : 1);
    const cartEl = document.getElementById('offcanvasCart');
    if (cartEl && window.bootstrap) bootstrap.Offcanvas.getOrCreateInstance(cartEl).show();
  });

  if (orderBtn) {
    orderBtn.addEventListener('click', (e) => {
      const text = encodeURIComponent(
        `Здравствуйте! Хочу заказать: ${displayTitle(product)} (${product.priceFormatted}), размер ${selectedSize}`
      );
      orderBtn.href = `https://www.instagram.com/direct/t/unorobeofficial/?text=${text}`;
    });
  }
}

function initHeaderScroll() {
  const header = document.querySelector('.site-header');
  if (!header) return;
  const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 40);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });
}

document.addEventListener('DOMContentLoaded', async () => {
  try {
    await loadCatalog();
    await loadReviews();
  } catch (e) {
    console.error('UNO RÓBE data load failed:', e);
    if (!PRODUCTS.length && typeof window.PRODUCTS_STATIC !== 'undefined') {
      PRODUCTS = window.PRODUCTS_STATIC.map(normalizeProduct);
    }
  }
  initHomeSwiperProducts();
  initShopPage();
  initSingleProductPage();
  initCart();
  initHeaderScroll();
  initReviewsSection();
  initReviewForm();
});
