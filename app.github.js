/*
  Versión compartida con token para subir imágenes desde cualquier dispositivo.
  Requiere un token personal de GitHub con permisos de escritura sobre el repositorio.
*/

const OWNER = 'aragorn1998';
const REPO = 'Casa-Inventario';
const BRANCH = 'main';
const PATH = 'inventario.json';
const TOKEN_STORAGE_KEY = 'Inventario_publico_token';

const state = {
  items: [],
  filteredItems: [],
  query: '',
  sha: null,
  token: localStorage.getItem(TOKEN_STORAGE_KEY) || '',
  canEdit: false
};

const el = {
  cardsContainer: document.getElementById('cardsContainer'),
  emptyState: document.getElementById('emptyState'),
  statsText: document.getElementById('statsText'),
  searchInput: document.getElementById('searchInput'),
  addBtn: document.getElementById('addBtn'),
  categoryFilter: document.getElementById('categoryFilter'),
  categoryList: document.getElementById('categoryList'),
  categoryClear: document.getElementById('categoryClear'),
  sortSelect: document.getElementById('sortSelect'),
  modal: document.getElementById('itemModal'),
  modalTitle: document.getElementById('modalTitle'),
  closeModalBtn: document.getElementById('closeModalBtn'),
  cancelBtn: document.getElementById('cancelBtn'),
  itemForm: document.getElementById('itemForm'),
  itemId: document.getElementById('itemId'),
  nameInput: document.getElementById('nameInput'),
  categoryInput: document.getElementById('categoryInput'),
  locationInput: document.getElementById('locationInput'),
  notesInput: document.getElementById('notesInput'),
  imageInput: document.getElementById('imageInput'),
  imageData: document.getElementById('imageData'),
  imagePreviewWrapper: document.getElementById('imagePreviewWrapper'),
  imagePreview: document.getElementById('imagePreview'),
  clearImageBtn: document.getElementById('clearImageBtn'),
  tokenBtn: document.getElementById('tokenBtn'),
  syncBadge: document.getElementById('syncBadge')
};

init();

async function init() {
  bindEvents();
  await loadFromGitHub();
  populateCategoryFilter();
  await updatePermissionMode();
  applyFilter();
}

function bindEvents() {
  el.addBtn.addEventListener('click', function () {
    if (!state.canEdit) return;
    openModal();
  });

  el.closeModalBtn.addEventListener('click', closeModal);
  el.cancelBtn.addEventListener('click', closeModal);

  el.searchInput.addEventListener('input', function (event) {
    state.query = event.target.value.trim().toLowerCase();
    applyFilter();
  });

  if (el.categoryFilter) {
    el.categoryFilter.addEventListener('input', function () {
      applyFilter();
      updateCategoryClearVisibility();
    });
  }

  if (el.categoryClear) {
    el.categoryClear.addEventListener('click', function () {
      if (!el.categoryFilter) return;
      el.categoryFilter.value = '';
      applyFilter();
      updateCategoryClearVisibility();
    });
  }

  if (el.sortSelect) {
    el.sortSelect.addEventListener('change', function () {
      applyFilter();
    });
  }

  if (el.imageInput) {
    el.imageInput.addEventListener('change', function (event) {
      const file = event.target.files && event.target.files[0];
      if (!file) {
        clearImagePreview();
        return;
      }

      const reader = new FileReader();
      reader.onload = function () {
        el.imageData.value = reader.result || '';
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    });
  }

  if (el.clearImageBtn) {
    el.clearImageBtn.addEventListener('click', function () {
      clearImagePreview();
      if (el.imageInput) el.imageInput.value = '';
    });
  }

  el.itemForm.addEventListener('submit', async function (event) {
    event.preventDefault();
    if (!state.canEdit) return;
    await saveFromForm();
  });

  el.modal.addEventListener('click', function (event) {
    if (event.target && event.target.dataset.close === 'true') {
      closeModal();
    }
  });

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && !el.modal.classList.contains('hidden')) {
      closeModal();
    }
  });

  el.tokenBtn.addEventListener('click', async function () {
    const current = state.token || '';
    const entered = window.prompt(
      'Pega aqui el token de GitHub con permisos de escritura.\n\nSi lo vacías, la app vuelve a modo solo lectura.',
      current
    );

    if (entered === null) return;

    state.token = entered.trim();

    if (state.token) {
      localStorage.setItem(TOKEN_STORAGE_KEY, state.token);
    } else {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    }

    await updatePermissionMode();
    applyFilter();
  });

  updateCategoryClearVisibility();
}

function updateCategoryClearVisibility() {
  if (!el.categoryFilter || !el.categoryClear) return;
  const hasValue = !!el.categoryFilter.value && el.categoryFilter.value.trim() !== '';
  el.categoryClear.classList.toggle('hidden', !hasValue);
}

function updateBodyPermissionClass() {
  document.body.classList.toggle('can-edit', !!state.canEdit);
  document.body.classList.toggle('read-only', !state.canEdit);
}

function populateCategoryFilter() {
  if (!el.categoryFilter || !el.categoryList) return;
  const categories = Array.from(new Set(state.items.map(i => (i.category || '').trim()).filter(Boolean))).sort();
  el.categoryList.innerHTML = '';
  categories.forEach(function (cat) {
    const opt = document.createElement('option');
    opt.value = cat;
    el.categoryList.appendChild(opt);
  });
}

async function loadFromGitHub() {
  try {
    const response = await fetch(apiUrl(), {
      headers: githubHeaders(false)
    });

    if (!response.ok) throw new Error('No se pudo leer inventario.json');

    const data = await response.json();
    state.sha = data.sha;
    const decoded = decodeBase64Utf8(data.content || '');
    state.items = JSON.parse(decoded || '[]');
  } catch (error) {
    console.error('Error al cargar inventario:', error);
    state.items = [];
  }
}

async function updatePermissionMode() {
  state.canEdit = false;

  if (!state.token) {
    setReadOnlyUI(true);
    updateBodyPermissionClass();
    return;
  }

  try {
    const response = await fetch(apiUrl(), {
      headers: githubHeaders(true)
    });
    state.canEdit = response.ok;
  } catch (error) {
    console.error('No se pudo validar el token:', error);
    state.canEdit = false;
  }

  setReadOnlyUI(!state.canEdit);
  updateBodyPermissionClass();
}

function setReadOnlyUI(readOnly) {
  el.syncBadge.classList.remove('hidden');
  el.syncBadge.textContent = readOnly ? 'Solo lectura' : 'Edición activada';
  el.addBtn.classList.toggle('hidden', readOnly);
}

function applyFilter() {
  const query = state.query || '';
  state.filteredItems = state.items.slice();

  if (query) {
    state.filteredItems = state.filteredItems.filter(function (item) {
      return (item.name || '').toLowerCase().includes(query);
    });
  }

  if (el.categoryFilter && el.categoryFilter.value && el.categoryFilter.value.trim() !== '') {
    const catQuery = el.categoryFilter.value.trim().toLowerCase();
    state.filteredItems = state.filteredItems.filter(function (item) {
      return (item.category || '').toLowerCase().includes(catQuery);
    });
  }

  const sortVal = el.sortSelect ? el.sortSelect.value : 'newest';
  if (sortVal === 'name-asc') {
    state.filteredItems.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  } else if (sortVal === 'name-desc') {
    state.filteredItems.sort((a, b) => (b.name || '').localeCompare(a.name || ''));
  } else if (sortVal === 'category-asc') {
    state.filteredItems.sort((a, b) => (a.category || '').localeCompare(b.category || ''));
  } else if (sortVal === 'category-desc') {
    state.filteredItems.sort((a, b) => (b.category || '').localeCompare(a.category || ''));
  } else if (sortVal === 'location-asc') {
    state.filteredItems.sort((a, b) => (a.location || '').localeCompare(b.location || ''));
  }

  renderItems();
}

function renderItems() {
  el.cardsContainer.innerHTML = '';
  el.statsText.textContent = state.filteredItems.length + ' objeto' + (state.filteredItems.length === 1 ? '' : 's');
  el.emptyState.classList.toggle('hidden', state.filteredItems.length !== 0);

  state.filteredItems.forEach(function (item) {
    const article = document.createElement('article');
    article.className = 'item-card';

    const imageHtml = item.imageData ? '<div class="item-image-container"><img class="item-image" src="' + item.imageData + '" alt="Imagen de ' + escapeHtml(item.name || 'objeto') + '" /></div>' : '';

    article.innerHTML =
      imageHtml +
      '<div class="item-content">' +
        '<div class="item-header">' +
          '<div>' +
            '<h3 class="item-title"></h3>' +
            '<span class="item-category"></span>' +
          '</div>' +
        '</div>' +
        '<p class="item-location"></p>' +
        '<p class="item-notes"></p>' +
        '<div class="item-actions"></div>' +
      '</div>';

    article.querySelector('.item-title').textContent = item.name || '';
    article.querySelector('.item-category').textContent = item.category || '';
    article.querySelector('.item-location').textContent = item.location || 'Sin ubicación';
    article.querySelector('.item-notes').textContent = item.notes || 'Sin notas';

    const actions = article.querySelector('.item-actions');

    if (state.canEdit) {
      const editBtn = document.createElement('button');
      editBtn.className = 'mini-btn';
      editBtn.textContent = 'Editar';
      editBtn.addEventListener('click', function () {
        openModal(item);
      });

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'mini-btn danger';
      deleteBtn.textContent = 'Eliminar';
      deleteBtn.addEventListener('click', function () {
        deleteItem(item.id);
      });

      actions.appendChild(editBtn);
      actions.appendChild(deleteBtn);
    } else {
      const info = document.createElement('span');
      info.className = 'badge';
      info.textContent = 'Lectura pública';
      actions.appendChild(info);
    }

    el.cardsContainer.appendChild(article);
  });
}

function openModal(item) {
  el.itemForm.reset();

  if (item) {
    el.modalTitle.textContent = 'Editar objeto';
    el.itemId.value = item.id || '';
    el.nameInput.value = item.name || '';
    el.categoryInput.value = item.category || '';
    el.locationInput.value = item.location || '';
    el.notesInput.value = item.notes || '';
    if (item.imageData) {
      el.imageData.value = item.imageData;
      setImagePreview(item.imageData);
    } else {
      clearImagePreview();
    }
    if (el.imageInput) el.imageInput.value = '';
  } else {
    el.modalTitle.textContent = 'Añadir objeto';
    el.itemId.value = '';
    el.nameInput.value = '';
    el.categoryInput.value = '';
    el.locationInput.value = '';
    el.notesInput.value = '';
    el.imageData.value = '';
    clearImagePreview();
    if (el.imageInput) el.imageInput.value = '';
  }

  el.modal.classList.remove('hidden');
  document.body.classList.add('modal-open');
  setTimeout(function () {
    el.nameInput.focus();
  }, 20);
}

function closeModal() {
  el.modal.classList.add('hidden');
  document.body.classList.remove('modal-open');
}

async function saveFromForm() {
  const item = {
    id: el.itemId.value || createId(),
    name: el.nameInput.value.trim(),
    category: el.categoryInput.value.trim(),
    location: el.locationInput.value.trim(),
    notes: el.notesInput.value.trim(),
    imageData: el.imageData ? el.imageData.value.trim() : ''
  };

  try {
    await refreshLatestRemoteState();
  } catch (error) {
    console.error('No se pudo refrescar el inventario antes de guardar:', error);
  }

  const existingIndex = state.items.findIndex(function (entry) {
    return entry.id === item.id;
  });

  if (existingIndex >= 0) {
    state.items[existingIndex] = item;
  } else {
    state.items.unshift(item);
  }

  const ok = await pushToGitHub('Actualizar inventario');

  if (ok) {
    populateCategoryFilter();
    applyFilter();
    closeModal();
  } else {
    await loadFromGitHub();
    applyFilter();
  }
}

async function deleteItem(id) {
  const confirmed = window.confirm('¿Seguro que quieres eliminar este objeto?');
  if (!confirmed) return;

  try {
    await refreshLatestRemoteState();
  } catch (error) {
    console.error('No se pudo refrescar el inventario antes de eliminar:', error);
  }

  state.items = state.items.filter(function (item) {
    return item.id !== id;
  });

  const ok = await pushToGitHub('Eliminar objeto del inventario');

  if (ok) {
    populateCategoryFilter();
    applyFilter();
  } else {
    await loadFromGitHub();
    applyFilter();
  }
}

async function refreshLatestRemoteState() {
  const response = await fetch(apiUrl(), {
    headers: githubHeaders(false)
  });

  if (!response.ok) {
    throw new Error('No se pudo leer inventario.json antes de la actualización.');
  }

  const data = await response.json();
  const remoteSha = data.sha;
  const decoded = decodeBase64Utf8(data.content || '');
  const remoteItems = JSON.parse(decoded || '[]');

  if (remoteSha !== state.sha) {
    state.items = remoteItems;
    state.sha = remoteSha;
  }

  return {
    remoteItems,
    remoteSha
  };
}

async function pushToGitHub(message) {
  try {
    const body = {
      message: message,
      branch: BRANCH,
      sha: state.sha,
      content: encodeBase64Utf8(JSON.stringify(state.items, null, 2))
    };

    let response = await fetch(apiUrl(), {
      method: 'PUT',
      headers: githubHeaders(true),
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      if (response.status === 409) {
        await refreshLatestRemoteState();
        const retryBody = {
          message: message + ' (reintento)',
          branch: BRANCH,
          sha: state.sha,
          content: encodeBase64Utf8(JSON.stringify(state.items, null, 2))
        };

        response = await fetch(apiUrl(), {
          method: 'PUT',
          headers: githubHeaders(true),
          body: JSON.stringify(retryBody)
        });
      }
    }

    if (!response.ok) {
      const details = await response.text();
      throw new Error(details || 'No se pudo guardar en GitHub');
    }

    const result = await response.json();
    state.sha = result.content.sha;
    return true;
  } catch (error) {
    console.error('Error al guardar en GitHub:', error);
    window.alert('No se pudo guardar en GitHub. Revisa el token y los datos del repositorio.');
    return false;
  }
}

function setImagePreview(src) {
  if (!el.imagePreviewWrapper || !el.imagePreview) return;
  if (!src) {
    clearImagePreview();
    return;
  }
  el.imagePreview.src = src;
  el.imagePreviewWrapper.classList.remove('hidden');
}

function clearImagePreview() {
  if (!el.imagePreviewWrapper || !el.imagePreview || !el.imageData) return;
  el.imagePreview.src = '';
  el.imageData.value = '';
  el.imagePreviewWrapper.classList.add('hidden');
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function apiUrl() {
  return 'https://api.github.com/repos/' + OWNER + '/' + REPO + '/contents/' + PATH + '?ref=' + encodeURIComponent(BRANCH);
}

function githubHeaders(withAuth) {
  const headers = {
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28'
  };
  if (withAuth && state.token) {
    headers.Authorization = 'Bearer ' + state.token;
  }
  return headers;
}

function createId() {
  return 'item-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9);
}

function encodeBase64Utf8(text) {
  return btoa(unescape(encodeURIComponent(text)));
}

function decodeBase64Utf8(base64Text) {
  return decodeURIComponent(escape(atob(base64Text.replace(/\n/g, ''))));
}
