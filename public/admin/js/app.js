// ===== App init: tab navigasi, logout, autentikasi awal, statistik global =====
// Dimuat paling akhir setelah modul fitur (api, links, bookmarks, notes, markdown).

(function () {
  const { apiRequest, showMessage } = window.App;

  // ===== Statistik global (kartu di atas, lintas semua tab) =====
  // Endpoint /api/admin/stats — ringan (COUNT per tabel), sekali saat load.
  async function loadGlobalStats() {
    try {
      const stats = await apiRequest('/api/admin/stats');
      const set = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
      };
      set('statTotalLinks', stats.totalLinks);
      set('statTotalClicks', stats.totalClicks);
      set('statAvgClicks', stats.avgClicks);
      set('statTotalNotes', stats.totalNotes);
      set('statTotalMarkdown', stats.totalMarkdown);
      set('statTotalBookmarks', stats.totalBookmarks);
    } catch (error) {
      showMessage(error.message, 'error');
    }
  }

  // Logout
  document.getElementById('logoutBtn').addEventListener('click', () => {
    localStorage.removeItem('adminToken');
    window.location.href = '/admin/login';
  });

  // ===== Tab navigation + persistence =====
  // - Tab aktif disimpan ke localStorage ('activeTab') DAN ke URL hash (#xxx).
  // - Saat load: prioritas URL hash > localStorage > default 'links-tab'.
  //   (hash berguna untuk bookmark/link langsung & refresh tetap di tab yang sama)
  const STORAGE_KEY = 'activeTab';
  const VALID_TABS = ['links-tab', 'bookmarks-tab', 'notes-tab', 'markdown-tab'];
  const DEFAULT_TAB = 'links-tab';

  const tabButtons = document.querySelectorAll('.tab-button');
  const tabContents = document.querySelectorAll('.tab-content');

  // Peta fungsi loader per tab
  const loaders = {
    'links-tab': () => window.App.links.loadLinks(),
    'bookmarks-tab': () => window.App.bookmarks.loadBookmarksTree(),
    'notes-tab': () => window.App.notes.loadNotes(),
    'markdown-tab': () => window.App.markdown.loadMarkdownDocs(),
  };

  // Tab yang sudah pernah di-load (lazy load SEKALI saja) — state pager
  // (halaman/search/sort) tetap dipertahankan saat pindah-pindah tab.
  const loadedTabs = new Set();

  // Tampilkan tab tertentu + set state tombol
  function activateTab(tabId) {
    if (!VALID_TABS.includes(tabId)) tabId = DEFAULT_TAB;

    tabButtons.forEach((btn) => {
      const isActive = btn.getAttribute('data-tab') === tabId;
      btn.classList.toggle('border-blue-500', isActive);
      btn.classList.toggle('text-blue-600', isActive);
      btn.classList.toggle('border-transparent', !isActive);
      btn.classList.toggle('text-gray-500', !isActive);
    });

    tabContents.forEach((content) => {
      content.classList.toggle('hidden', content.id !== tabId);
    });

    // Muat data hanya saat tab pertama kali dibuka
    if (!loadedTabs.has(tabId)) {
      loadedTabs.add(tabId);
      const load = loaders[tabId];
      if (load) load();
    }
  }

  // Klik tab -> aktifkan + simpan (localStorage + URL hash tanpa reload)
  tabButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const tabId = button.getAttribute('data-tab');
      activateTab(tabId);
      localStorage.setItem(STORAGE_KEY, tabId);
      history.replaceState(null, '', `#${tabId}`);
    });
  });

  // Inisialisasi: hash > localStorage > default
  const initialTab = (window.location.hash || '').replace('#', '') ||
    localStorage.getItem(STORAGE_KEY) ||
    DEFAULT_TAB;
  activateTab(initialTab);

  // Muat statistik global kartu (di atas tab) — tidak tergantung tab aktif
  loadGlobalStats();
})();
