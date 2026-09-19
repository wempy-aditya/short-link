// ===== Settings: account security + SQLite backup/restore =====
(function () {
  const { state, apiRequest, showMessage } = window.App;

  function el(id) { return document.getElementById(id); }

  async function loadStagedRestore() {
    const result = await apiRequest('/api/admin/settings/restore/staged');
    const info = el('stagedRestoreInfo');
    const activate = el('activateRestoreBtn');
    if (!result.restore) {
      info.classList.add('hidden');
      activate.classList.add('hidden');
      return;
    }
    const restore = result.restore;
    info.textContent = `Staged: ${restore.originalName || restore.stagedName} — ${restore.size || 0} bytes. File tervalidasi dan siap diaktifkan.`;
    info.classList.remove('hidden');
    activate.classList.remove('hidden');
    activate.dataset.stagedName = restore.stagedName;
  }

  async function exportDatabase() {
    const response = await fetch('/api/admin/settings/backup', {
      headers: { Authorization: `Bearer ${state.token}` },
    });
    if (response.status === 401 || response.status === 403) {
      localStorage.removeItem('adminToken');
      window.location.href = '/admin/login';
      return;
    }
    if (!response.ok) throw new Error('Gagal membuat backup');
    const blob = await response.blob();
    const disposition = response.headers.get('Content-Disposition') || '';
    const match = disposition.match(/filename="?([^";]+)"?/i);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = match ? match[1] : 'shortlink-backup.db';
    link.click();
    URL.revokeObjectURL(url);
    showMessage('Database berhasil diexport', 'success');
  }

  async function stageRestore() {
    const file = el('restoreFile').files[0];
    if (!file) throw new Error('Pilih file .db terlebih dahulu');
    if (file.size > 100 * 1024 * 1024) throw new Error('Ukuran file maksimal 100 MB');
    const response = await fetch('/api/admin/settings/restore/stage', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${state.token}`,
        'Content-Type': 'application/octet-stream',
        'X-Backup-Filename': file.name,
      },
      body: file,
    });
    const data = await response.json();
    if (response.status === 401 || response.status === 403) {
      localStorage.removeItem('adminToken');
      window.location.href = '/admin/login';
      return;
    }
    if (!response.ok) throw new Error(data.error || 'Backup gagal divalidasi');
    showMessage('Backup valid dan sudah di-stage', 'success');
    await loadStagedRestore();
  }

  async function activateRestore() {
    const stagedName = el('activateRestoreBtn').dataset.stagedName;
    if (!stagedName) throw new Error('Tidak ada restore yang siap diaktifkan');
    const confirmed = window.confirm('Restore akan mengganti seluruh database aktif. Backup otomatis dibuat sebelum replace. Lanjutkan?');
    if (!confirmed) return;
    await apiRequest('/api/admin/settings/restore/activate', {
      method: 'POST',
      body: JSON.stringify({ stagedName }),
    });
    localStorage.removeItem('adminToken');
    window.alert('Restore aktif. Silakan login ulang.');
    window.location.href = '/admin/login';
  }

  el('passwordForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      await apiRequest('/api/admin/account/password', {
        method: 'PUT',
        body: JSON.stringify({
          currentPassword: el('currentPassword').value,
          newPassword: el('newPassword').value,
          confirmPassword: el('confirmPassword').value,
        }),
      });
      localStorage.removeItem('adminToken');
      window.alert('Password berhasil diubah. Silakan login ulang.');
      window.location.href = '/admin/login';
    } catch (error) {
      showMessage(error.message, 'error');
    }
  });

  el('exportDbBtn').addEventListener('click', () => exportDatabase().catch((error) => showMessage(error.message, 'error')));
  el('stageRestoreBtn').addEventListener('click', () => stageRestore().catch((error) => showMessage(error.message, 'error')));
  el('activateRestoreBtn').addEventListener('click', () => activateRestore().catch((error) => showMessage(error.message, 'error')));

  window.App.settings = { loadStagedRestore };
})();