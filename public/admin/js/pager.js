// ===== Pager helper: search + sort + pagination untuk tab list =====
// Dipakai oleh links.js, notes.js, markdown.js. Mengurangi duplikasi.
//
// Cara pakai:
//   const pager = window.App.createPager({
//     searchInput, sortSelect, infoEl, prevBtn, nextBtn, pageLabel,   // elemen
//     fetchPage: (params) => apiRequest(url + query),                 // async
//     render: (rows) => {...},                                        // render isi
//   });
//   pager.init();   // muat halaman pertama

(function () {
  function createPager(cfg) {
    const state = {
      page: 1,
      pageSize: cfg.pageSize || 10,
      total: 0,
      totalPages: 1,
      q: '',
      sort: cfg.defaultSort || '',
      order: cfg.defaultOrder || 'desc',
      loading: false,
    };

    let searchTimer = null;

    // Bangun query string utk fetch
    function buildQuery(extra = {}) {
      const p = new URLSearchParams();
      p.set('page', state.page);
      p.set('pageSize', state.pageSize);
      if (state.q) p.set('search', state.q);
      if (state.sort) p.set('sort', state.sort);
      p.set('order', state.order);
      if (cfg.extraParams) {
        for (const [k, v] of Object.entries(cfg.extraParams())) {
          if (v !== null && v !== undefined && v !== '') p.set(k, v);
        }
      }
      for (const [k, v] of Object.entries(extra)) {
        if (v !== null && v !== undefined && v !== '') p.set(k, v);
      }
      return p.toString();
    }

    async function load() {
      if (state.loading) return;
      state.loading = true;
      if (cfg.onLoading) cfg.onLoading(true);
      try {
        const data = await cfg.fetchPage(buildQuery());
        // Response bisa { rows, total, ... } (pagination) atau array (fallback)
        const rows = Array.isArray(data) ? data : (data.rows || []);
        const total = Array.isArray(data) ? rows.length : (data.total ?? rows.length);
        state.total = total;
        state.totalPages = Array.isArray(data)
          ? Math.max(Math.ceil(total / state.pageSize), 1)
          : (data.totalPages || 1);
        cfg.render(rows);
        renderPagerInfo();
        renderNav();
      } catch (err) {
        if (cfg.onError) cfg.onError(err);
      } finally {
        state.loading = false;
        if (cfg.onLoading) cfg.onLoading(false);
      }
    }

    function renderPagerInfo() {
      if (!cfg.infoEl) return;
      const start = state.total === 0 ? 0 : (state.page - 1) * state.pageSize + 1;
      const end = Math.min(state.page * state.pageSize, state.total);
      cfg.infoEl.textContent = state.total === 0
        ? 'Tidak ada data'
        : `${start}–${end} dari ${state.total}`;
    }

    function renderNav() {
      if (!cfg.prevBtn || !cfg.nextBtn) return;
      cfg.prevBtn.disabled = state.page <= 1;
      cfg.nextBtn.disabled = state.page >= state.totalPages;
      if (cfg.pageLabel) cfg.pageLabel.textContent = `Hal ${state.page} / ${state.totalPages}`;
    }

    // Event
    function bind() {
      if (cfg.searchInput) {
        cfg.searchInput.addEventListener('input', () => {
          clearTimeout(searchTimer);
          searchTimer = setTimeout(() => {
            state.q = cfg.searchInput.value.trim();
            state.page = 1;
            load();
          }, cfg.debounceMs || 350);
        });
      }
      if (cfg.sortSelect) {
        cfg.sortSelect.addEventListener('change', () => {
          const val = cfg.sortSelect.value; // format: "kolom|asc|desc" atau "kolom"
          const parts = val.split('|');
          state.sort = parts[0] || '';
          state.order = parts[1] || 'desc';
          state.page = 1;
          load();
        });
      }
      if (cfg.prevBtn) {
        cfg.prevBtn.addEventListener('click', () => {
          if (state.page > 1) { state.page--; load(); }
        });
      }
      if (cfg.nextBtn) {
        cfg.nextBtn.addEventListener('click', () => {
          if (state.page < state.totalPages) { state.page++; load(); }
        });
      }
    }

    function init() {
      bind();
      load();
    }

    // Bind listener saat pertama dibuat — agar tombol/search langsung aktif
    // meski modul tidak memanggil init() eksplisit.
    bind();

    // Muat ulang (setelah tambah/edit/hapus) — kembali ke halaman 1 biar konsisten
    function reload() {
      state.page = 1;
      load();
    }

    // Set tambahan utk extraParams dinamis (mis. folder terpilih di bookmarks)
    function refresh() {
      load();
    }

    return { init, reload, refresh, load, getState: () => ({ ...state }) };
  }

  window.App = window.App || {};
  window.App.createPager = createPager;
})();
