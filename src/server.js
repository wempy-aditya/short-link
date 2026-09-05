const { createApp } = require('./app');
const { initializeDatabase } = require('./db/init');
const config = require('./config');

async function start() {
  try {
    await initializeDatabase();
    const app = createApp();
    app.listen(config.port, () => {
      console.log(`Server berjalan di http://localhost:${config.port}`);
      console.log('Database berhasil diinisialisasi');
    });
  } catch (err) {
    console.error('Gagal menginisialisasi database:', err);
    process.exit(1);
  }
}

start();