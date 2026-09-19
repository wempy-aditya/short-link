(function () {
  const { state, apiRequest, showMessage, esc } = window.App;
  const $ = (id) => document.getElementById(id);
  const status = $('storageStatus');

  function formatBytes(bytes) {
    if (!bytes) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    return `${(bytes / 1024 ** i).toFixed(i ? 1 : 0)} ${units[i]}`;
  }

  function render(files) {
    const body = $('storageTableBody');
    $('storageEmpty').classList.toggle('hidden', files.length > 0);
    body.innerHTML = files.map((file) => `<tr>
      <td class="px-6 py-4"><div class="font-medium text-gray-800">${esc(file.originalName)}</div><div class="text-xs text-gray-500">${formatBytes(file.sizeBytes)}</div></td>
      <td class="px-6 py-4 text-sm text-gray-600">${esc(file.mimeType)}</td>
      <td class="px-6 py-4"><select class="storage-visibility border border-gray-300 rounded px-2 py-1 text-sm" data-id="${file.id}"><option value="private" ${file.visibility === 'private' ? 'selected' : ''}>Private</option><option value="public" ${file.visibility === 'public' ? 'selected' : ''}>Public</option></select></td>
      <td class="px-6 py-4"><div class="flex flex-wrap gap-2"><button class="storage-preview text-blue-600 text-sm" data-id="${file.id}">Preview</button><button class="storage-share text-green-600 text-sm" data-id="${file.id}">Share</button><button class="storage-delete text-red-600 text-sm" data-id="${file.id}">Delete</button></div></td>
    </tr>`).join('');
  }

  async function load() {
    try {
      const result = await apiRequest('/api/admin/storage');
      render(result.files);
      status.textContent = `${result.files.length} file`;
    } catch (error) {
      status.textContent = error.message;
    }
  }

  $('storageUploadForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const file = $('storageFile').files[0];
    if (!file) return;
    const data = new FormData();
    data.append('file', file);
    data.append('visibility', $('storageVisibility').value);
    try {
      const response = await fetch('/api/admin/storage/upload', { method: 'POST', headers: { Authorization: `Bearer ${state.token}` }, body: data });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Upload gagal');
      $('storageUploadForm').reset();
      showMessage('File berhasil diupload', 'success');
      load();
    } catch (error) { showMessage(error.message, 'error'); }
  });

  $('storageTableBody').addEventListener('change', async (event) => {
    if (!event.target.matches('.storage-visibility')) return;
    try {
      await apiRequest(`/api/admin/storage/${event.target.dataset.id}/visibility`, { method: 'PATCH', body: JSON.stringify({ visibility: event.target.value }) });
      showMessage('Access file berhasil diubah', 'success');
    } catch (error) { showMessage(error.message, 'error'); load(); }
  });

  $('storageTableBody').addEventListener('click', async (event) => {
    const id = event.target.dataset.id;
    try {
      if (event.target.matches('.storage-preview')) {
        const result = await apiRequest(`/api/admin/storage/${id}/preview`);
        window.open(result.previewUrl, '_blank', 'noopener,noreferrer');
      } else if (event.target.matches('.storage-share')) {
        const result = await apiRequest(`/api/admin/storage/${id}/share`, { method: 'POST' });
        await navigator.clipboard.writeText(result.shareUrl);
        showMessage('Share link disalin', 'success');
      } else if (event.target.matches('.storage-delete') && window.confirm('Hapus file ini dari storage?')) {
        await apiRequest(`/api/admin/storage/${id}`, { method: 'DELETE' });
        showMessage('File dihapus', 'success');
        load();
      }
    } catch (error) { showMessage(error.message, 'error'); }
  });

  window.App.storage = { load };
})();