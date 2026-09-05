const express = require('express');
const config = require('./config');

// Routes
const publicRoutes = require('./routes/public.routes');
const authRoutes = require('./routes/auth.routes');
const linkRoutes = require('./routes/link.routes');
const folderRoutes = require('./routes/folder.routes');
const bookmarkRoutes = require('./routes/bookmark.routes');
const bookmarkTreeRoutes = require('./routes/bookmarkTree.routes');
const noteRoutes = require('./routes/note.routes');
const markdownRoutes = require('./routes/markdown.routes');

function createApp() {
  const app = express();

  // Middleware global
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(express.static(config.publicDir));

  // Routes
  // NOTE: public.routes punya catch-all GET /:shortCode, jadi di-mount
  // SEBELUM route admin agar redirect tetap prioritas untuk 1-segmen,
  // dan route admin tetap kebagian request /admin/* & /api/admin/*.
  app.use(publicRoutes);
  app.use(authRoutes);

  // API admin
  app.use('/api/admin', bookmarkTreeRoutes); // /api/admin/bookmarks-tree (dash, path asli)
  app.use('/api/admin/links', linkRoutes);
  app.use('/api/admin/folders', folderRoutes);
  app.use('/api/admin/bookmarks', bookmarkRoutes);
  app.use('/api/admin/notes', noteRoutes);
  app.use('/api/admin/markdown', markdownRoutes);

  // Error handler global
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    console.error('[error]', err);
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  });

  return app;
}

module.exports = { createApp };