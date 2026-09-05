const express = require('express');

const { all } = require('../db/queries');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// ===== GET /api/admin/stats — ringkasan global semua resource =====
// Dipakai kartu statistik dashboard (total lintas tab).
// Satu endpoint murah (COUNT per tabel) — tidak muat semua row.
router.get('/', authenticateToken, async (req, res, next) => {
  try {
    const [[linkRow], [noteRow], [folderRow], [bookmarkRow], [markdownRow]] = await Promise.all([
      all('SELECT COUNT(*) AS total, COALESCE(SUM(click_count), 0) AS clicks FROM links'),
      all('SELECT COUNT(*) AS total FROM notes'),
      all('SELECT COUNT(*) AS total FROM folders'),
      all('SELECT COUNT(*) AS total FROM bookmarks'),
      all('SELECT COUNT(*) AS total FROM markdown_docs'),
    ]);

    const totalLinks = linkRow.total || 0;
    const totalClicks = linkRow.clicks || 0;

    res.json({
      totalLinks,
      totalClicks,
      avgClicks: totalLinks > 0 ? Math.round((totalClicks / totalLinks) * 10) / 10 : 0,
      totalNotes: noteRow.total || 0,
      totalFolders: folderRow.total || 0,
      totalBookmarks: bookmarkRow.total || 0,
      totalMarkdown: markdownRow.total || 0,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
