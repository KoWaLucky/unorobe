/* GitHub API — сохранение каталога и отзывов в репозиторий */
const GH_TOKEN_KEY = 'unorobe_gh_token';

function getGhToken() {
  return sessionStorage.getItem(GH_TOKEN_KEY) || '';
}

function setGhToken(token) {
  if (token) sessionStorage.setItem(GH_TOKEN_KEY, token);
  else sessionStorage.removeItem(GH_TOKEN_KEY);
}

function ghCfg() {
  return UNOROBE_CONFIG.github;
}

async function ghApi(path, options = {}) {
  const token = getGhToken();
  if (!token) throw new Error('Нужен GitHub Token. Войдите в админку с токеном.');
  const res = await fetch(`https://api.github.com${path}`, {
    ...options,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `GitHub API ${res.status}`);
  }
  return res.status === 204 ? null : res.json();
}

async function getFileSha(path) {
  const { owner, repo, branch } = ghCfg();
  try {
    const data = await ghApi(`/repos/${owner}/${repo}/contents/${path}?ref=${branch}`);
    return data.sha;
  } catch (e) {
    return null;
  }
}

async function saveJsonFile(path, data) {
  const { owner, repo, branch } = ghCfg();
  const sha = await getFileSha(path);
  const body = {
    message: `admin: обновление ${path}`,
    content: btoa(unescape(encodeURIComponent(JSON.stringify(data, null, 2)))),
    branch,
  };
  if (sha) body.sha = sha;
  return ghApi(`/repos/${owner}/${repo}/contents/${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function uploadImage(path, file) {
  const { owner, repo, branch } = ghCfg();
  const sha = await getFileSha(path);
  const base64 = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
  const body = {
    message: `admin: фото ${path}`,
    content: base64,
    branch,
  };
  if (sha) body.sha = sha;
  await ghApi(`/repos/${owner}/${repo}/contents/${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return path;
}

async function saveCatalog(catalog) {
  return saveJsonFile('data/catalog.json', catalog);
}

async function saveReviews(reviews) {
  return saveJsonFile('data/reviews.json', reviews);
}

async function verifyGhToken() {
  const user = await ghApi('/user');
  const { owner, repo } = ghCfg();
  await ghApi(`/repos/${owner}/${repo}`);
  return user.login;
}
