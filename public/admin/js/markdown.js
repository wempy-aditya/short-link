// ===== Tab: Markdown — CRUD dokumen + upload .md + drag & drop =====
// List: server-side pagination/search/sort (ringan, tanpa konten).
// Edit/Read: fetch detail via GET /api/admin/markdown/:id (lazy load).
// Menggunakan window.App.state / apiRequest / showMessage / esc / createPager

(function () {
  const { state, apiRequest, showMessage, esc } = window.App;

  const markdownLoading = document.getElementById('markdownLoading');
  const markdownList = document.getElementById('markdownList');
  const markdownEmpty = document.getElementById('markdownEmpty');
  const addMarkdownBtn = document.getElementById('addMarkdownBtn');
  const mdFileUpload = document.getElementById('mdFileUpload');
  const mdDropZone = document.getElementById('mdDropZone');
  const markdownModal = document.getElementById('markdownModal');
  const markdownForm = document.getElementById('markdownForm');
  const markdownTitle = document.getElementById('markdownTitle');
  const markdownContent = document.getElementById('markdownContent');
  const markdownDocId = document.getElementById('markdownDocId');
  const markdownPreview = document.getElementById('markdownPreview');
  const mdEditMode = document.getElementById('mdEditMode');
  const mdPreviewMode = document.getElementById('mdPreviewMode');
  const mdEditorArea = document.getElementById('mdEditorArea');
  const mdPreviewArea = document.getElementById('mdPreviewArea');
  const markdownModalTitle = document.getElementById('markdownModalTitle');
  const closeMarkdownModal = document.getElementById('closeMarkdownModal');
  const cancelMarkdown = document.getElementById('cancelMarkdown');

  // Render list utk satu halaman (dari { rows } server — preview dibentuk dari konten scrub)
  function renderMarkdownDocs(rows) {
    if (!rows || rows.length === 0) {
      markdownList.innerHTML = '';
      markdownEmpty.classList.remove('hidden');
      document.getElementById('mdPager').classList.add('hidden');
      return;
    }

    markdownEmpty.classList.add('hidden');
    document.getElementById('mdPager').classList.remove('hidden');

    markdownList.innerHTML = rows.map((doc) => `
      <div class="border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow cursor-pointer md-doc-view"
           data-doc-id="${doc.id}">
          <div class="flex items-start justify-between">
              <div class="flex-1">
                  <h3 class="font-semibold text-gray-900 mb-1">
                      <i class="fas fa-file-alt text-green-600 mr-2"></i>${esc(doc.title)}
                  </h3>
                  <p class="text-xs text-gray-400 mt-1">
                      Diperbarui: ${new Date(doc.updated_at).toLocaleString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
              </div>
              <div class="flex space-x-2 ml-4">
                  <button class="text-blue-500 hover:text-blue-700 edit-md-doc" data-doc-id="${doc.id}" title="Edit">
                      <i class="fas fa-edit"></i>
                  </button>
                  <button class="text-green-600 hover:text-green-800 read-md-doc" data-doc-id="${doc.id}" title="Baca">
                      <i class="fas fa-book-open"></i>
                  </button>
                  <button class="text-red-500 hover:text-red-700 delete-md-doc" data-doc-id="${doc.id}" title="Hapus">
                      <i class="fas fa-trash"></i>
                  </button>
              </div>
          </div>
      </div>
    `).join('');
  }

  // Pager utk dokumen
  const pager = window.App.createPager({
    searchInput: document.getElementById('mdSearch'),
    sortSelect: document.getElementById('mdSort'),
    infoEl: document.getElementById('mdInfo'),
    prevBtn: document.getElementById('mdPrev'),
    nextBtn: document.getElementById('mdNext'),
    pageLabel: document.getElementById('mdPageLabel'),
    pageSize: 10,
    defaultSort: 'updated_at',
    defaultOrder: 'desc',
    fetchPage: (query) => apiRequest(`/api/admin/markdown?${query}`),
    render: renderMarkdownDocs,
    onLoading: (loading) => {
      markdownLoading.classList.toggle('hidden', !loading);
    },
    onError: (err) => showMessage(err.message, 'error'),
  });

  // Load dokumen halaman 1 (dipanggil app.js saat tab dibuka)
  function loadMarkdownDocs() {
    pager.reload();
  }

  // Klik card / tombol di daftar dokumen
  markdownList.addEventListener('click', (e) => {
    if (e.target.closest('.md-doc-view') && !e.target.closest('button')) {
      const docId = parseInt(e.target.closest('.md-doc-view').dataset.docId, 10);
      viewMarkdownDoc(docId);
    } else if (e.target.closest('.edit-md-doc')) {
      const docId = parseInt(e.target.closest('.edit-md-doc').dataset.docId, 10);
      editMarkdownDoc(docId);
    } else if (e.target.closest('.read-md-doc')) {
      const docId = parseInt(e.target.closest('.read-md-doc').dataset.docId, 10);
      viewMarkdownDoc(docId);
    } else if (e.target.closest('.delete-md-doc')) {
      const docId = parseInt(e.target.closest('.delete-md-doc').dataset.docId, 10);
      deleteMarkdownDoc(docId);
    }
  });

  // ===== Modal & mode edit/preview =====

  async function getMarkdownDetail(id) {
    // Kalau sudah punya konten lengkap (baru dibuat/upload), pakai langsung
    const existing = state.markdownDocs ? state.markdownDocs.find((d) => d.id === id) : null;
    if (existing && existing.content_md !== undefined) return existing;
    return apiRequest(`/api/admin/markdown/${id}`);
  }

  async function viewMarkdownDoc(docId) {
    try {
      const doc = await getMarkdownDetail(docId);
      openMarkdownModal(doc);
      switchToPreview();
      if (doc.content_md) {
        markdownPreview.innerHTML = marked.parse(doc.content_md);
      } else {
        markdownPreview.innerHTML = '<p class="text-gray-400 italic">Dokumen kosong</p>';
      }
    } catch (error) {
      showMessage(error.message, 'error');
    }
  }

  // Edit: fetch detail lengkap dulu (list tidak bawa konten), lalu buka modal edit
  async function editMarkdownDoc(docId) {
    try {
      const doc = await getMarkdownDetail(docId);
      openMarkdownModal(doc);
      switchToEdit();
    } catch (error) {
      showMessage(error.message, 'error');
    }
  }

  function openMarkdownModal(doc = null) {
    state.editingMarkdownDoc = doc;
    markdownModalTitle.textContent = doc ? (doc.title || 'Edit Dokumen') : 'Tulis Markdown';
    markdownTitle.value = doc ? (doc.title || '') : '';
    markdownContent.value = doc ? (doc.content_md || '') : '';
    markdownDocId.value = doc ? (doc.id || '') : '';

    switchToEdit();
    markdownModal.classList.remove('hidden');
    setTimeout(() => markdownContent.focus(), 100);
  }

  function switchToEdit() {
    mdEditorArea.classList.remove('hidden');
    mdPreviewArea.classList.add('hidden');
    mdEditMode.classList.add('bg-green-600', 'text-white');
    mdEditMode.classList.remove('bg-gray-300', 'text-gray-700');
    mdPreviewMode.classList.add('bg-gray-300', 'text-gray-700');
    mdPreviewMode.classList.remove('bg-green-600', 'text-white');
  }

  function switchToPreview() {
    const md = markdownContent.value;
    try {
      markdownPreview.innerHTML = marked.parse(md || '');
    } catch (err) {
      markdownPreview.innerHTML = '<p class="text-red-500">Error merender markdown</p>';
    }
    mdEditorArea.classList.add('hidden');
    mdPreviewArea.classList.remove('hidden');
    mdPreviewMode.classList.add('bg-green-600', 'text-white');
    mdPreviewMode.classList.remove('bg-gray-300', 'text-gray-700');
    mdEditMode.classList.add('bg-gray-300', 'text-gray-700');
    mdEditMode.classList.remove('bg-green-600', 'text-white');
  }

  mdEditMode.addEventListener('click', switchToEdit);
  mdPreviewMode.addEventListener('click', switchToPreview);

  // Live preview saat mengetik (hanya kalau preview sedang tampil)
  markdownContent.addEventListener('input', () => {
    if (!mdPreviewArea.classList.contains('hidden')) {
      try {
        markdownPreview.innerHTML = marked.parse(markdownContent.value || '');
      } catch (err) {
        markdownPreview.innerHTML = '<p class="text-red-500">Error merender markdown</p>';
      }
    }
  });

  addMarkdownBtn.addEventListener('click', () => openMarkdownModal());

  markdownForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      title: markdownTitle.value.trim(),
      content_md: markdownContent.value,
      content_html: (() => {
        try {
          return marked.parse(markdownContent.value || '');
        } catch (err) {
          return '';
        }
      })(),
    };

    try {
      if (state.editingMarkdownDoc && state.editingMarkdownDoc.id) {
        await apiRequest(`/api/admin/markdown/${state.editingMarkdownDoc.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        showMessage('Dokumen berhasil diperbarui');
      } else {
        await apiRequest('/api/admin/markdown', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        showMessage('Dokumen berhasil ditambahkan');
      }
      markdownModal.classList.add('hidden');
      loadMarkdownDocs();
    } catch (error) {
      showMessage(error.message, 'error');
    }
  });

  async function deleteMarkdownDoc(docId) {
    if (!confirm('Apakah Anda yakin ingin menghapus dokumen ini?')) return;
    try {
      await apiRequest(`/api/admin/markdown/${docId}`, { method: 'DELETE' });
      showMessage('Dokumen berhasil dihapus');
      loadMarkdownDocs();
    } catch (error) {
      showMessage(error.message, 'error');
    }
  }

  // ===== Upload file .md =====

  mdFileUpload.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    readMarkdownFile(file);
    mdFileUpload.value = '';
  });

  mdDropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
    mdDropZone.classList.add('border-green-400', 'bg-green-50');
  });

  mdDropZone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    e.stopPropagation();
    mdDropZone.classList.remove('border-green-400', 'bg-green-50');
  });

  mdDropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    mdDropZone.classList.remove('border-green-400', 'bg-green-50');
    const file = e.dataTransfer.files[0];
    if (file) readMarkdownFile(file);
  });

  function readMarkdownFile(file) {
    const validExts = ['.md', '.markdown', '.txt'];
    const ext = '.' + file.name.split('.').pop().toLowerCase();
    if (!validExts.includes(ext)) {
      showMessage('Hanya file .md, .markdown, atau .txt yang diterima', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target.result;
      const title = file.name.replace(/\.(md|markdown|txt)$/i, '');
      openMarkdownModal({ id: null, title, content_md: content });
    };
    reader.onerror = () => showMessage('Gagal membaca file', 'error');
    reader.readAsText(file);
  }

  closeMarkdownModal.addEventListener('click', () => markdownModal.classList.add('hidden'));
  cancelMarkdown.addEventListener('click', () => markdownModal.classList.add('hidden'));

  markdownModal.addEventListener('click', (e) => {
    if (e.target === markdownModal) markdownModal.classList.add('hidden');
  });

  window.App.markdown = { loadMarkdownDocs };
})();