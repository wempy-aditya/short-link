(function () {
  const { apiRequest, showMessage, esc } = window.App;
  const $ = (id) => document.getElementById(id);
  let links = [];
  let editingId = null;

  function render() {
    const list = $('linktreeLinksList');
    if (!links.length) { list.innerHTML = '<p class="text-sm text-gray-500 py-6 text-center">Belum ada link. Tambahkan link pertama.</p>'; return; }
    list.innerHTML = links.map((link, index) => `<div class="flex items-center gap-3 border border-gray-100 rounded-xl p-3 ${link.visible ? 'bg-white' : 'bg-gray-50 opacity-60'}">
      <span class="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center"><i class="fas ${esc(link.icon || 'fa-link')}"></i></span>
      <div class="min-w-0 flex-1"><p class="font-semibold text-gray-900 truncate">${esc(link.title)}</p><p class="text-xs text-gray-500 truncate">${esc(link.url)}</p></div>
      <button class="text-xs text-blue-600" data-action="edit" data-id="${link.id}">Edit</button><button class="text-xs text-gray-600" data-action="toggle" data-id="${link.id}">${link.visible ? 'Hide' : 'Show'}</button>
      <button class="text-gray-500 disabled:opacity-30" data-action="up" data-id="${link.id}" ${index === 0 ? 'disabled' : ''} aria-label="Move up"><i class="fas fa-arrow-up"></i></button>
      <button class="text-gray-500 disabled:opacity-30" data-action="down" data-id="${link.id}" ${index === links.length - 1 ? 'disabled' : ''} aria-label="Move down"><i class="fas fa-arrow-down"></i></button>
      <button class="text-red-500" data-action="delete" data-id="${link.id}" aria-label="Delete"><i class="fas fa-trash"></i></button>
    </div>`).join('');
  }

  async function load() {
    const result = await apiRequest('/api/admin/linktree'); links = result.links; const profile = result.profile;
    $('linktreeDisplayName').value = profile.display_name || ''; $('linktreeBio').value = profile.bio || ''; $('linktreeAvatarUrl').value = profile.avatar_url || ''; $('linktreeTheme').value = profile.theme || 'ocean'; render();
  }

  $('linktreeProfileForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    try { await apiRequest('/api/admin/linktree/profile', { method: 'PUT', body: JSON.stringify({ displayName: $('linktreeDisplayName').value, bio: $('linktreeBio').value, avatarUrl: $('linktreeAvatarUrl').value, theme: $('linktreeTheme').value }) }); showMessage('Profile Linktree tersimpan', 'success'); } catch (error) { showMessage(error.message, 'error'); }
  });

  $('linktreeLinkForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      const payload = { title: $('linktreeLinkTitle').value, url: $('linktreeLinkUrl').value };
      await apiRequest(editingId ? `/api/admin/linktree/links/${editingId}` : '/api/admin/linktree/links', { method: editingId ? 'PUT' : 'POST', body: JSON.stringify(payload) });
      editingId = null; event.target.reset(); $('linktreeLinkSubmit').textContent = 'Add'; $('linktreeLinkCancel').classList.add('hidden'); await load(); showMessage('Link tersimpan', 'success');
    } catch (error) { showMessage(error.message, 'error'); }
  });

  $('linktreeLinkCancel').addEventListener('click', () => { editingId = null; $('linktreeLinkForm').reset(); $('linktreeLinkSubmit').textContent = 'Add'; $('linktreeLinkCancel').classList.add('hidden'); });
  $('linktreeLinksList').addEventListener('click', async (event) => {
    const button = event.target.closest('button'); if (!button) return;
    const id = button.dataset.id; const link = links.find((item) => String(item.id) === String(id)); if (!link) return;
    try {
      if (button.dataset.action === 'edit') { editingId = link.id; $('linktreeLinkTitle').value = link.title; $('linktreeLinkUrl').value = link.url; $('linktreeLinkSubmit').textContent = 'Save'; $('linktreeLinkCancel').classList.remove('hidden'); $('linktreeLinkTitle').focus(); return; }
      if (button.dataset.action === 'toggle') await apiRequest(`/api/admin/linktree/links/${id}/visibility`, { method: 'PATCH', body: JSON.stringify({ visible: !link.visible }) });
      if (button.dataset.action === 'up' || button.dataset.action === 'down') await apiRequest(`/api/admin/linktree/links/${id}/order`, { method: 'PATCH', body: JSON.stringify({ direction: button.dataset.action }) });
      if (button.dataset.action === 'delete') { if (!window.confirm('Hapus link ini?')) return; await apiRequest(`/api/admin/linktree/links/${id}`, { method: 'DELETE' }); }
      await load();
    } catch (error) { showMessage(error.message, 'error'); }
  });
  window.App.linktree = { load };
})();
