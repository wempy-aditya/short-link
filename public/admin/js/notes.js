// ===== Tab: Notes — WYSIWYG (Quill) + CRUD =====
// List: server-side pagination/search/sort (tanpa content_html — ringan).
// Edit: fetch detail via GET /api/admin/notes/:id (lazy load konten).
// Menggunakan window.App.state / apiRequest / showMessage / esc / createPager

(function () {
  const { state, apiRequest, showMessage, esc } = window.App;

  const notesLoading = document.getElementById('notesLoading');
  const notesList = document.getElementById('notesList');
  const notesEmpty = document.getElementById('notesEmpty');
  const addNoteBtn = document.getElementById('addNoteBtn');
  const noteModal = document.getElementById('noteModal');
  const noteForm = document.getElementById('noteForm');
  const noteTitle = document.getElementById('noteTitle');
  const noteId = document.getElementById('noteId');
  const noteModalTitle = document.getElementById('noteModalTitle');
  const closeNoteModal = document.getElementById('closeNoteModal');
  const cancelNote = document.getElementById('cancelNote');

  // Inisialisasi Quill editor (elemen #noteEditor di modal)
  const noteEditor = new Quill('#noteEditor', {
    theme: 'snow',
    placeholder: 'Tulis catatan di sini...',
  });

  // Render list utk satu halaman (data ringan: tanpa konten)
  function renderNotes(rows) {
    if (!rows || rows.length === 0) {
      notesList.innerHTML = '';
      notesEmpty.classList.remove('hidden');
      document.getElementById('notesPager').classList.add('hidden');
      return;
    }

    notesEmpty.classList.add('hidden');
    document.getElementById('notesPager').classList.remove('hidden');

    notesList.innerHTML = rows.map((note) => `
      <div class="border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow">
          <div class="flex items-start justify-between">
              <div class="flex-1">
                  <h3 class="font-semibold text-gray-900 mb-1">${esc(note.title)}</h3>
                  <p class="text-xs text-gray-500">
                      Diperbarui: ${new Date(note.updated_at).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
              </div>
              <div class="flex space-x-2 ml-4">
                  <button class="text-blue-500 hover:text-blue-700 edit-note" data-note-id="${note.id}" title="Edit">
                      <i class="fas fa-edit"></i>
                  </button>
                  <button class="text-red-500 hover:text-red-700 delete-note" data-note-id="${note.id}" title="Hapus">
                      <i class="fas fa-trash"></i>
                  </button>
              </div>
          </div>
      </div>
    `).join('');
  }

  // Pager utk catatan
  const pager = window.App.createPager({
    searchInput: document.getElementById('noteSearch'),
    sortSelect: document.getElementById('noteSort'),
    infoEl: document.getElementById('noteInfo'),
    prevBtn: document.getElementById('notePrev'),
    nextBtn: document.getElementById('noteNext'),
    pageLabel: document.getElementById('notePageLabel'),
    pageSize: 10,
    defaultSort: 'updated_at',
    defaultOrder: 'desc',
    fetchPage: (query) => apiRequest(`/api/admin/notes?${query}`),
    render: renderNotes,
    onLoading: (loading) => {
      notesLoading.classList.toggle('hidden', !loading);
    },
    onError: (err) => showMessage(err.message, 'error'),
  });

  // Load catatan halaman 1 (dipanggil app.js saat tab dibuka)
  function loadNotes() {
    pager.reload();
  }

  // Buka modal edit — fetch detail dulu (lazy load konten, list tidak bawa konten)
  async function openNoteModal(note = null) {
    if (note && !note.content_html) {
      // Dari list ringan: ambil konten lengkap dari server
      try {
        note = await apiRequest(`/api/admin/notes/${note.id}`);
      } catch (error) {
        showMessage(error.message, 'error');
        return;
      }
    }
    state.editingNote = note;
    noteModalTitle.textContent = note ? 'Edit Catatan' : 'Tambah Catatan';
    noteTitle.value = note ? note.title : '';
    noteId.value = note ? note.id : '';
    noteEditor.root.innerHTML = note ? note.content_html || '' : '';
    noteModal.classList.remove('hidden');
  }

  addNoteBtn.addEventListener('click', () => openNoteModal());

  notesList.addEventListener('click', (e) => {
    if (e.target.closest('.edit-note')) {
      const id = parseInt(e.target.closest('.edit-note').dataset.noteId, 10);
      // List hanya bawa ringan (tanpa konten) — ambil detail dari server saat edit
      openNoteModal({ id });
    } else if (e.target.closest('.delete-note')) {
      const id = parseInt(e.target.closest('.delete-note').dataset.noteId, 10);
      deleteNote(id);
    }
  });

  noteForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      title: noteTitle.value.trim(),
      content_html: noteEditor.root.innerHTML,
    };

    try {
      if (state.editingNote) {
        await apiRequest(`/api/admin/notes/${state.editingNote.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        showMessage('Catatan berhasil diperbarui');
      } else {
        await apiRequest('/api/admin/notes', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        showMessage('Catatan berhasil ditambahkan');
      }
      noteModal.classList.add('hidden');
      loadNotes();
    } catch (error) {
      showMessage(error.message, 'error');
    }
  });

  async function deleteNote(noteIdValue) {
    if (!confirm('Apakah Anda yakin ingin menghapus catatan ini?')) return;
    try {
      await apiRequest(`/api/admin/notes/${noteIdValue}`, { method: 'DELETE' });
      showMessage('Catatan berhasil dihapus');
      loadNotes();
    } catch (error) {
      showMessage(error.message, 'error');
    }
  }

  closeNoteModal.addEventListener('click', () => noteModal.classList.add('hidden'));
  cancelNote.addEventListener('click', () => noteModal.classList.add('hidden'));

  noteModal.addEventListener('click', (e) => {
    if (e.target === noteModal) noteModal.classList.add('hidden');
  });

  window.App.notes = { loadNotes };
})();
