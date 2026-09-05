// ===== Tab: Notes — WYSIWYG (Quill) + CRUD =====
// Menggunakan window.App.state / apiRequest / showMessage

(function () {
  const { state, apiRequest, showMessage } = window.App;

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

  async function loadNotes() {
    try {
      notesLoading.classList.remove('hidden');
      notesList.innerHTML = '';
      notesEmpty.classList.add('hidden');

      state.notesData = await apiRequest('/api/admin/notes');
      renderNotes();
    } catch (error) {
      showMessage(error.message, 'error');
    } finally {
      notesLoading.classList.add('hidden');
    }
  }

  function renderNotes() {
    if (!state.notesData || state.notesData.length === 0) {
      notesList.innerHTML = '';
      notesEmpty.classList.remove('hidden');
      return;
    }

    notesEmpty.classList.add('hidden');
    notesList.innerHTML = state.notesData
      .map((note) => `
        <div class="border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow">
            <div class="flex items-start justify-between">
                <div class="flex-1">
                    <h3 class="font-semibold text-gray-900 mb-1">${window.App.esc(note.title)}</h3>
                    <div class="text-sm text-gray-700 max-h-16 overflow-hidden">${note.content_html || ''}</div>
                    <p class="text-xs text-gray-500 mt-2">
                        Diperbarui: ${new Date(note.updated_at).toLocaleDateString('id-ID')}
                    </p>
                </div>
                <div class="flex space-x-2 ml-4">
                    <button class="text-blue-500 hover:text-blue-700 edit-note" data-note-id="${note.id}">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="text-red-500 hover:text-red-700 delete-note" data-note-id="${note.id}">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        </div>
      `).join('');
  }

  function openNoteModal(note = null) {
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
      const note = state.notesData.find((item) => item.id === id);
      if (note) openNoteModal(note);
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