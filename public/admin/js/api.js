// ===== API helper + shared state =====
// Dimuat pertama. Menyediakan:
//   - window.App.token / App.apiRequest / App.showMessage / App.state
// Semua modul fitur (links.js, bookmarks.js, notes.js, markdown.js) memakainya.

(function () {
  // Shared state antar modul
  const state = {
    token: localStorage.getItem('adminToken'),
    currentFolderId: null,     // bookmark folder yang sedang dipilih
    bookmarksData: null,       // data tree dari /api/admin/bookmarks-tree
    notesData: [],
    markdownDocs: [],
    editingFolder: null,
    editingBookmark: null,
    editingNote: null,
    editingMarkdownDoc: null,
  };

  // Redirect ke login kalau tidak ada token
  if (!state.token) {
    window.location.href = '/admin/login';
    return;
  }

  // Parse JWT payload utk username (gagal -> logout)
  try {
    const payload = JSON.parse(atob(state.token.split('.')[1]));
    document.getElementById('adminUsername').textContent = payload.username;
  } catch (e) {
    console.error('Invalid token');
    localStorage.removeItem('adminToken');
    window.location.href = '/admin/login';
    return;
  }

  // API request helper — auto logout kalau 401/403
  async function apiRequest(url, options = {}) {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${state.token}`,
        ...options.headers,
      },
    });

    if (response.status === 401 || response.status === 403) {
      localStorage.removeItem('adminToken');
      window.location.href = '/admin/login';
      throw new Error('Sesi berakhir, silakan login ulang');
    }

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Terjadi kesalahan');
    }

    return data;
  }

  // Toast message (sukses/error) — elemen #message di dashboard.html
  let messageTimeout = null;
  function showMessage(text, type = 'success') {
    const container = document.getElementById('message');
    const content = document.getElementById('messageContent');
    const icon = document.getElementById('messageIcon');
    const textEl = document.getElementById('messageText');

    if (!container) return;

    textEl.textContent = text;

    if (type === 'success') {
      content.className = 'rounded-lg p-4 shadow-lg bg-green-50 border border-green-200';
      icon.className = 'mr-3 text-xl fas fa-check-circle text-green-500';
    } else {
      content.className = 'rounded-lg p-4 shadow-lg bg-red-50 border border-red-200';
      icon.className = 'mr-3 text-xl fas fa-exclamation-triangle text-red-500';
    }

    container.classList.remove('hidden');

    if (messageTimeout) clearTimeout(messageTimeout);
    messageTimeout = setTimeout(() => container.classList.add('hidden'), 5000);
  }

  // Escape HTML supaya aman saat dimasukkan lewat template string
  function esc(str) {
    return String(str == null ? '' : str)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  window.App = {
    state,
    token: state.token,
    apiRequest,
    showMessage,
    esc,
  };
})();
