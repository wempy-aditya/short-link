// ===== Tab: Links — stats, tabel, CRUD =====
// Menggunakan window.App.apiRequest / showMessage / esc dari api.js

(function () {
  const { apiRequest, showMessage, esc } = window.App;

  // Elemen DOM
  const totalLinks = document.getElementById('totalLinks');
  const totalClicks = document.getElementById('totalClicks');
  const avgClicks = document.getElementById('avgClicks');
  const tableLoading = document.getElementById('tableLoading');
  const tableContainer = document.getElementById('tableContainer');
  const emptyState = document.getElementById('emptyState');
  const linksTableBody = document.getElementById('linksTableBody');
  const addLinkForm = document.getElementById('addLinkForm');
  const editModal = document.getElementById('editModal');
  const editForm = document.getElementById('editForm');
  const cancelEdit = document.getElementById('cancelEdit');

  // Load links + update stats
  async function loadLinks() {
    try {
      const links = await apiRequest('/api/admin/links');

      // Stats
      totalLinks.textContent = links.length;
      const clicks = links.reduce((sum, link) => sum + link.click_count, 0);
      totalClicks.textContent = clicks;
      avgClicks.textContent = links.length > 0 ? Math.round(clicks / links.length) : 0;

      // Empty state
      if (links.length === 0) {
        tableLoading.classList.add('hidden');
        tableContainer.classList.add('hidden');
        emptyState.classList.remove('hidden');
        return;
      }

      // Populate table
      tableLoading.classList.add('hidden');
      emptyState.classList.add('hidden');
      tableContainer.classList.remove('hidden');

      linksTableBody.innerHTML = links.map((link) => `
          <tr>
              <td class="px-6 py-4 whitespace-nowrap">
                  <div class="text-sm text-gray-900 max-w-xs truncate" title="${esc(link.original_url)}">
                      ${esc(link.original_url)}
                  </div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                  <a href="/${esc(link.short_code)}" target="_blank" class="text-blue-600 hover:text-blue-800 font-mono">
                      ${esc(window.location.origin)}/${esc(link.short_code)}
                  </a>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                  <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      ${link.click_count} klik
                  </span>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  ${new Date(link.created_at).toLocaleDateString('id-ID')}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <button onclick="App.links.editLink(${link.id}, '${esc(link.original_url)}')" class="text-indigo-600 hover:text-indigo-900 mr-3">
                      <i class="fas fa-edit"></i> Edit
                  </button>
                  <button onclick="App.links.showQrModal('${esc(window.location.origin)}/${esc(link.short_code)}')" class="text-green-600 hover:text-green-800 mr-3">
                      <i class="fas fa-qrcode"></i> QR
                  </button>
                  <button onclick="App.links.deleteLink(${link.id})" class="text-red-600 hover:text-red-900">
                      <i class="fas fa-trash"></i> Hapus
                  </button>
              </td>
          </tr>
      `).join('');
    } catch (error) {
      showMessage(error.message, 'error');
      tableLoading.classList.add('hidden');
    }
  }

  // Tambah tautan
  addLinkForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const url = document.getElementById('newUrl').value;
    const customAlias = document.getElementById('customAlias').value;

    try {
      await apiRequest('/api/admin/links', {
        method: 'POST',
        body: JSON.stringify({ url, customAlias }),
      });
      showMessage('Tautan berhasil ditambahkan');
      addLinkForm.reset();
      loadLinks();
    } catch (error) {
      showMessage(error.message, 'error');
    }
  });

  // Edit link
  function editLink(id, originalUrl) {
    document.getElementById('editLinkId').value = id;
    document.getElementById('editUrl').value = originalUrl;
    editModal.classList.remove('hidden');
  }

  cancelEdit.addEventListener('click', () => editModal.classList.add('hidden'));

  editForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('editLinkId').value;
    const originalUrl = document.getElementById('editUrl').value;

    try {
      await apiRequest(`/api/admin/links/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ originalUrl }),
      });
      showMessage('Tautan berhasil diperbarui');
      editModal.classList.add('hidden');
      loadLinks();
    } catch (error) {
      showMessage(error.message, 'error');
    }
  });

  // Hapus link
  async function deleteLink(id) {
    if (!confirm('Apakah Anda yakin ingin menghapus tautan ini?')) return;
    try {
      await apiRequest(`/api/admin/links/${id}`, { method: 'DELETE' });
      showMessage('Tautan berhasil dihapus');
      loadLinks();
    } catch (error) {
      showMessage(error.message, 'error');
    }
  }

  // Tutup modal saat klik di luar
  editModal.addEventListener('click', (e) => {
    if (e.target === editModal) editModal.classList.add('hidden');
  });

  // QR modal (dipakai juga oleh bookmark) — disimpan di sini sebagai helper global
  const qrModal = document.getElementById('qrModal');
  const qrCodeContainer = document.getElementById('qrCodeContainer');
  const qrUrlLabel = document.getElementById('qrUrlLabel');

  function showQrModal(url) {
    qrUrlLabel.textContent = url;
    qrCodeContainer.innerHTML = '';
    new QRCode(qrCodeContainer, {
      text: url,
      width: 180,
      height: 180,
      colorDark: '#111827',
      colorLight: '#ffffff',
      correctLevel: QRCode.CorrectLevel.M,
    });
    qrModal.classList.remove('hidden');
  }

  document.getElementById('closeQrModal').addEventListener('click', () => {
    qrModal.classList.add('hidden');
  });

  // Export API publik
  window.App.links = { loadLinks, editLink, deleteLink, showQrModal };

  // Load pertama kali
  loadLinks();
})();