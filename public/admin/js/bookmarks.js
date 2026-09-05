// ===== Tab: Bookmarks — folder tree + CRUD folder & bookmark =====
// Menggunakan window.App.state / apiRequest / showMessage / esc

(function () {
  const { state, apiRequest, showMessage, esc } = window.App;

  // Elemen DOM
  const folderTree = document.getElementById('folderTree');
  const bookmarksList = document.getElementById('bookmarkList');
  const selectedFolderInfo = document.getElementById('selectedFolderInfo');
  const addBookmarkBtn = document.getElementById('addBookmarkBtn');
  const addFolderBtn = document.getElementById('addFolderBtn');
  const folderModal = document.getElementById('folderModal');
  const bookmarkModal = document.getElementById('bookmarkModal');
  const folderForm = document.getElementById('folderForm');
  const bookmarkForm = document.getElementById('bookmarkForm');

  // ===== Tree =====

  // Load tree dari API lalu render
  async function loadBookmarksTree() {
    try {
      state.bookmarksData = await apiRequest('/api/admin/bookmarks-tree');
      renderFolderTree();

      // Reset panel kanan
      bookmarksList.innerHTML =
        '<div class="text-center text-gray-500 py-8"><i class="fas fa-folder-open text-4xl mb-3"></i><p>Pilih folder untuk melihat bookmark</p></div>';
      selectedFolderInfo.innerHTML = '<p class="text-gray-500">Pilih folder untuk melihat informasi</p>';
      addBookmarkBtn.disabled = true;
      addBookmarkBtn.classList.add('opacity-50', 'cursor-not-allowed');
      state.currentFolderId = null;
    } catch (error) {
      showMessage(error.message, 'error');
    }
  }

  function renderFolderTree() {
    const data = state.bookmarksData;
    if (!data || !data.tree || data.tree.length === 0) {
      folderTree.innerHTML = '<p class="text-gray-500 text-center py-4">Belum ada folder</p>';
      return;
    }
    folderTree.innerHTML = renderFolderNodes(data.tree);
  }

  function renderFolderNodes(folders) {
    return folders
      .map((folder) => {
        const hasChildren = folder.children && folder.children.length > 0;
        return `
          <div class="folder-node">
              <div class="flex items-center p-2 hover:bg-gray-100 cursor-pointer rounded folder-item"
                   data-folder-id="${folder.id}" data-folder-name="${esc(folder.name)}">
                  ${hasChildren
                    ? '<i class="fas fa-chevron-right mr-2 text-xs text-gray-400 folder-toggle"></i>'
                    : '<span class="ml-4"></span>'}
                  <i class="fas fa-folder mr-2 text-yellow-500"></i>
                  <span class="flex-1">${esc(folder.name)}</span>
                  <div class="folder-actions opacity-0 group-hover:opacity-100">
                      <button class="text-blue-500 hover:text-blue-700 mr-2 edit-folder" data-folder-id="${folder.id}">
                          <i class="fas fa-edit text-xs"></i>
                      </button>
                      <button class="text-red-500 hover:text-red-700 delete-folder" data-folder-id="${folder.id}">
                          <i class="fas fa-trash text-xs"></i>
                      </button>
                  </div>
              </div>
              ${hasChildren ? `<div class="folder-children ml-4 hidden">${renderFolderNodes(folder.children)}</div>` : ''}
          </div>
        `;
      })
      .join('');
  }

  // Klik pada tree (toggle / pilih / edit / hapus folder)
  folderTree.addEventListener('click', (e) => {
    // Toggle expand/collapse subfolder
    if (e.target.closest('.folder-toggle')) {
      const children = e.target.closest('.folder-node').querySelector('.folder-children');
      if (children) {
        children.classList.toggle('hidden');
        const icon = e.target.closest('.folder-toggle');
        icon.classList.toggle('fa-chevron-right');
        icon.classList.toggle('fa-chevron-down');
      }
      return;
    }

    // FIX (bug pre-existing): tombol Edit/Hapus berada DI DALAM .folder-item.
    // Urutan cek harus: aksi dulu, baru fallback "pilih folder" —
    // kalau tidak, klik Edit/Hapus selalu dianggap memilih folder.

    // Edit folder
    if (e.target.closest('.edit-folder')) {
      const folderId = parseInt(e.target.closest('.edit-folder').dataset.folderId, 10);
      editFolder(folderId);
      return;
    }

    // Delete folder
    if (e.target.closest('.delete-folder')) {
      const folderId = parseInt(e.target.closest('.delete-folder').dataset.folderId, 10);
      deleteFolder(folderId);
      return;
    }

    // Pilih folder (hanya kalau klik bukan pada tombol aksi)
    if (e.target.closest('.folder-item')) {
      const item = e.target.closest('.folder-item');
      const folderId = parseInt(item.dataset.folderId, 10);
      const folderName = item.dataset.folderName;

      document.querySelectorAll('.folder-item').forEach((el) => el.classList.remove('bg-blue-100', 'border-blue-300'));
      item.classList.add('bg-blue-100', 'border-blue-300');
      loadFolderContent(folderId, folderName);
      return;
    }
  });

  // ===== Folder =====

  function loadFolderContent(folderId, folderName) {
    state.currentFolderId = folderId;
    selectedFolderInfo.innerHTML = `
      <div class="flex items-center">
          <i class="fas fa-folder mr-2 text-yellow-500"></i>
          <span class="font-medium">${esc(folderName)}</span>
      </div>
    `;
    addBookmarkBtn.disabled = false;
    addBookmarkBtn.classList.remove('opacity-50', 'cursor-not-allowed');
    loadFolderBookmarks(folderId);
  }

  async function loadFolderBookmarks(folderId) {
    try {
      const bookmarks = await apiRequest(`/api/admin/bookmarks?folder_id=${folderId}`);
      if (bookmarks.length === 0) {
        bookmarksList.innerHTML = '<p class="text-gray-500 text-center py-8">Belum ada bookmark di folder ini</p>';
        return;
      }
      bookmarksList.innerHTML = bookmarks
        .map((b) => `
          <div class="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
              <div class="flex items-start justify-between">
                  <div class="flex-1">
                      <h3 class="font-medium text-gray-900 mb-1">${esc(b.title)}</h3>
                      <a href="${esc(b.original_url)}" target="_blank"
                         class="text-blue-600 hover:text-blue-800 text-sm break-all">${esc(b.original_url)}</a>
                      <p class="text-xs text-gray-500 mt-2">
                          Ditambahkan: ${new Date(b.created_at).toLocaleDateString('id-ID')}
                      </p>
                  </div>
                  <div class="flex space-x-2 ml-4">
                      <button class="text-blue-500 hover:text-blue-700 edit-bookmark" data-bookmark-id="${b.id}">
                          <i class="fas fa-edit"></i>
                      </button>
                      <button class="text-green-600 hover:text-green-800 qr-bookmark" data-bookmark-url="${esc(b.original_url)}">
                          <i class="fas fa-qrcode"></i>
                      </button>
                      <button class="text-red-500 hover:text-red-700 delete-bookmark" data-bookmark-id="${b.id}">
                          <i class="fas fa-trash"></i>
                      </button>
                  </div>
              </div>
          </div>
        `).join('');
    } catch (error) {
      showMessage(error.message, 'error');
    }
  }

  // Klik pada daftar bookmark
  bookmarksList.addEventListener('click', (e) => {
    if (e.target.closest('.edit-bookmark')) {
      const id = parseInt(e.target.closest('.edit-bookmark').dataset.bookmarkId, 10);
      editBookmark(id);
    } else if (e.target.closest('.qr-bookmark')) {
      const url = e.target.closest('.qr-bookmark').dataset.bookmarkUrl;
      window.App.links.showQrModal(url);
    } else if (e.target.closest('.delete-bookmark')) {
      const id = parseInt(e.target.closest('.delete-bookmark').dataset.bookmarkId, 10);
      deleteBookmark(id);
    }
  });

  addFolderBtn.addEventListener('click', () => {
    state.editingFolder = null;
    document.getElementById('folderModalTitle').textContent = 'Tambah Folder';
    document.getElementById('folderName').value = '';
    loadParentFolderOptions();
    folderModal.classList.remove('hidden');
  });

  addBookmarkBtn.addEventListener('click', () => {
    state.editingBookmark = null;
    document.getElementById('bookmarkModalTitle').textContent = 'Tambah Bookmark';
    document.getElementById('bookmarkTitle').value = '';
    document.getElementById('bookmarkUrl').value = '';
    bookmarkModal.classList.remove('hidden');
  });

  // Isi dropdown parent folder (flatten tree)
  function loadParentFolderOptions() {
    const select = document.getElementById('parentFolder');
    select.innerHTML = '<option value="">-- Root Folder --</option>';
    const data = state.bookmarksData;
    if (data && data.tree) {
      const allFolders = [];
      (function flatten(nodes) {
        nodes.forEach((node) => {
          allFolders.push(node);
          if (node.children && node.children.length > 0) flatten(node.children);
        });
      })(data.tree);

      allFolders.forEach((folder) => {
        if (!state.editingFolder || folder.id !== state.editingFolder.id) {
          select.innerHTML += `<option value="${folder.id}">${esc(folder.name)}</option>`;
        }
      });
    }
  }

  // FIX (bug pre-existing): original pakai `bookmarksData.folders` yang tidak pernah ada
  // (response tree hanya punya `tree`). Sekarang cari folder di seluruh tree.
  function findFolderInTree(folderId, nodes) {
    for (const node of nodes) {
      if (node.id === folderId) return node;
      if (node.children && node.children.length > 0) {
        const found = findFolderInTree(folderId, node.children);
        if (found) return found;
      }
    }
    return null;
  }

  async function editFolder(folderId) {
    const data = state.bookmarksData;
    if (!data || !data.tree) return;
    const folder = findFolderInTree(folderId, data.tree);
    if (!folder) return;

    state.editingFolder = folder;
    document.getElementById('folderModalTitle').textContent = 'Edit Folder';
    document.getElementById('folderName').value = folder.name;
    loadParentFolderOptions();

    // Preselect parent (kalau punya) setelah opsi dimuat
    if (folder.parent_id) {
      document.getElementById('parentFolder').value = folder.parent_id;
    }
    folderModal.classList.remove('hidden');
  }

  // Cari bookmark yang sedang diedit dari data folder aktif
  async function editBookmark(bookmarkId) {
    if (!state.currentFolderId) return;
    try {
      const bookmarks = await apiRequest(`/api/admin/bookmarks?folder_id=${state.currentFolderId}`);
      const bookmark = bookmarks.find((b) => b.id === bookmarkId);
      if (!bookmark) return;

      state.editingBookmark = bookmark;
      document.getElementById('bookmarkModalTitle').textContent = 'Edit Bookmark';
      document.getElementById('bookmarkTitle').value = bookmark.title;
      document.getElementById('bookmarkUrl').value = bookmark.original_url;
      bookmarkModal.classList.remove('hidden');
    } catch (error) {
      showMessage(error.message, 'error');
    }
  }

  // Submit folder
  folderForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(folderForm);
    const folderData = {
      name: formData.get('name'),
      parent_id: formData.get('parent_id') || null,
    };

    try {
      if (state.editingFolder) {
        await apiRequest(`/api/admin/folders/${state.editingFolder.id}`, {
          method: 'PUT',
          body: JSON.stringify(folderData),
        });
        showMessage('Folder berhasil diperbarui');
      } else {
        await apiRequest('/api/admin/folders', {
          method: 'POST',
          body: JSON.stringify(folderData),
        });
        showMessage('Folder berhasil ditambahkan');
      }
      folderModal.classList.add('hidden');
      loadBookmarksTree();
    } catch (error) {
      showMessage(error.message, 'error');
    }
  });

  // Submit bookmark
  bookmarkForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(bookmarkForm);
    const bookmarkData = {
      title: formData.get('title'),
      original_url: formData.get('url'),
      folder_id: state.currentFolderId,
    };

    try {
      if (state.editingBookmark) {
        await apiRequest(`/api/admin/bookmarks/${state.editingBookmark.id}`, {
          method: 'PUT',
          body: JSON.stringify(bookmarkData),
        });
        showMessage('Bookmark berhasil diperbarui');
      } else {
        await apiRequest('/api/admin/bookmarks', {
          method: 'POST',
          body: JSON.stringify(bookmarkData),
        });
        showMessage('Bookmark berhasil ditambahkan');
      }
      bookmarkModal.classList.add('hidden');
      loadFolderBookmarks(state.currentFolderId);
    } catch (error) {
      showMessage(error.message, 'error');
    }
  });

  // Hapus folder (CASCADE subfolder + bookmark)
  async function deleteFolder(folderId) {
    if (!confirm('Apakah Anda yakin ingin menghapus folder ini? Semua subfolder dan bookmark di dalamnya akan ikut terhapus.')) return;
    try {
      await apiRequest(`/api/admin/folders/${folderId}`, { method: 'DELETE' });
      showMessage('Folder berhasil dihapus');
      loadBookmarksTree();
    } catch (error) {
      showMessage(error.message, 'error');
    }
  }

  async function deleteBookmark(bookmarkId) {
    if (!confirm('Apakah Anda yakin ingin menghapus bookmark ini?')) return;
    try {
      await apiRequest(`/api/admin/bookmarks/${bookmarkId}`, { method: 'DELETE' });
      showMessage('Bookmark berhasil dihapus');
      loadFolderBookmarks(state.currentFolderId);
    } catch (error) {
      showMessage(error.message, 'error');
    }
  }

  // Batal folder/bookmark
  document.getElementById('cancelFolder').addEventListener('click', () => folderModal.classList.add('hidden'));
  document.getElementById('cancelBookmark').addEventListener('click', () => bookmarkModal.classList.add('hidden'));

  // Klik luar modal
  [folderModal, bookmarkModal].forEach((modal) => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.add('hidden');
    });
  });

  // Export
  window.App.bookmarks = { loadBookmarksTree, loadFolderContent };
})();