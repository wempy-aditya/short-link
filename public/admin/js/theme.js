// ===== Dark mode toggle =====
// Dipakai di dashboard (tombol #themeToggle) & login (otomatis mengikuti).
// Preferensi disimpan di localStorage 'theme' ('dark' | 'light' | null=sistem).
// Setiap halaman punya bootstrap inline di <head> yang menerapkan class 'dark'
// SEBELUM render (anti-flash). File ini hanya mengelola toggle & ikon.

(function () {
  const STORAGE_KEY = 'theme';

  function systemPrefersDark() {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  function currentTheme() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'dark' || saved === 'light') return saved;
    return systemPrefersDark() ? 'dark' : 'light';
  }

  // Update ikon (matahari = aktif dark, bulan = aktif light) — selalu terang
  // di header gradient biru.
  function updateIcon(theme) {
    const icon = document.querySelector('#themeToggle i');
    if (!icon) return;
    if (theme === 'dark') {
      icon.className = 'fas fa-sun text-yellow-300';
    } else {
      icon.className = 'fas fa-moon text-white';
    }
  }

  function applyTheme(theme) {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    updateIcon(theme);
  }

  // Inisialisasi tombol toggle (hanya ada di dashboard)
  const toggleBtn = document.getElementById('themeToggle');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      const next = currentTheme() === 'dark' ? 'light' : 'dark';
      localStorage.setItem(STORAGE_KEY, next);
      applyTheme(next);
    });
  }

  // Dengarkan perubahan preferensi sistem (kalau user tidak set manual)
  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      if (!localStorage.getItem(STORAGE_KEY)) {
        applyTheme(e.matches ? 'dark' : 'light');
      }
    });
  }

  // Terapkan saat load (untuk halaman login/publik yang tidak ada bootstrap)
  applyTheme(currentTheme());

  window.AppTheme = {
    currentTheme,
    applyTheme,
  };
})();
