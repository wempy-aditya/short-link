const express = require('express');

const { all } = require('../db/queries');
const { authenticateToken } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

// Endpoint tree — path asli /api/admin/bookmarks-tree (dash),
// dipanggil frontend dashboard.html. JANGAN pindahkan di bawah /bookmarks.
router.get('/bookmarks-tree', authenticateToken, asyncHandler(async (req, res) => {
  const folders = await all(
    'SELECT id, name, parent_id, created_at FROM folders WHERE user_id = ? ORDER BY name ASC',
    [req.user.id]
  );
  const bookmarks = await all(
    'SELECT id, title, original_url, folder_id, created_at FROM bookmarks WHERE user_id = ? ORDER BY title ASC',
    [req.user.id]
  );

  // Bangun tree secara rekursif
  function buildTree(parentId = null) {
    const tree = [];
    const childFolders = folders.filter((f) => f.parent_id === parentId);
    for (const folder of childFolders) {
      tree.push({
        id: folder.id,
        name: folder.name,
        type: 'folder',
        parent_id: folder.parent_id,
        created_at: folder.created_at,
        children: buildTree(folder.id),
        bookmarks: bookmarks.filter((b) => b.folder_id === folder.id),
      });
    }
    return tree;
  }

  const tree = buildTree();
  const orphanedBookmarks = bookmarks.filter((b) => !folders.some((f) => f.id === b.folder_id));

  res.json({
    tree,
    orphaned_bookmarks: orphanedBookmarks,
    total_folders: folders.length,
    total_bookmarks: bookmarks.length,
  });
}));

module.exports = router;