// ===== App init: tab navigasi, logout, autentikasi awal =====
// Dimuat paling akhir setelah modul fitur (api, links, bookmarks, notes, markdown).

(function () {
  const { apiRequest, showMessage } = window.App;

  // Logout
  document.getElementById('logoutBtn').addEventListener('click', () => {
    localStorage.removeItem('adminToken');
    window.location.href = '/admin/login';
  });

  // Tab navigation
  const tabButtons = document.querySelectorAll('.tab-button');
  const tabContents = document.querySelectorAll('.tab-content');

  tabButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const targetTab = button.getAttribute('data-tab');

      tabButtons.forEach((btn) => {
        btn.classList.remove('border-blue-500', 'text-blue-600');
        btn.classList.add('border-transparent', 'text-gray-500');
      });
      button.classList.remove('border-transparent', 'text-gray-500');
      button.classList.add('border-blue-500', 'text-blue-600');

      tabContents.forEach((content) => content.classList.add('hidden'));
      document.getElementById(targetTab).classList.remove('hidden');

      // Load data sesuai tab
      if (targetTab === 'links-tab') {
        window.App.links.loadLinks();
      } else if (targetTab === 'bookmarks-tab') {
        window.App.bookmarks.loadBookmarksTree();
      } else if (targetTab === 'notes-tab') {
        window.App.notes.loadNotes();
      } else if (targetTab === 'markdown-tab') {
        window.App.markdown.loadMarkdownDocs();
      }
    });
  });

  // Inisialisasi pertama: tab links (aktif default)
  window.App.links.loadLinks();
})();