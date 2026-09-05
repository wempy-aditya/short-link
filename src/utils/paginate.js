// ===== Helper pagination + search + sort untuk list admin =====
// Dipakai oleh route links/notes/markdown. Mengembalikan object query
// siap dipakai dengan db.all(), plus total count via db.get().
//
// Format response konsisten:
//   { rows: [...], total: N, page: P, pageSize: S, totalPages: T }
//
// Catatan: kalau tidak ada query param sama sekali (bukan halaman 1),
// route boleh memilih tetap mengembalikan ARRAY penuh (mode lama)
// agar kontrak API lama tidak berubah — lihat pemakaian di route.

/**
 * Bangun klausa WHERE untuk pencarian.
 * @param {string[]} columns kolom yang boleh dicari (mis. ['title', 'content'])
 * @param {string} q kata kunci
 * @returns {{ whereSql: string, params: any[] }}
 */
function buildSearch(columns, q) {
  if (!q || !columns.length) return { whereSql: '', params: [] };
  const escaped = q.replace(/'/g, "''"); // escape SQL injection via LIKE
  const like = `%${escaped}%`;
  const clause = columns.map((c) => `${c} LIKE ?`).join(' OR ');
  return {
    whereSql: ` WHERE (${clause})`,
    params: Array(columns.length).fill(like),
  };
}

/**
 * Peta kolom sort yang diizinkan — cegah SQL injection via ORDER BY.
 * Route menyerahkan whitelist-nya sendiri (nama kolom SQL valid).
 * @param {string} sort nama kolom yang diminta klien
 * @param {string} order 'asc' | 'desc'
 * @param {Object<string,string>} allowedMap whitelist: key publik -> kolom SQL
 * @param {string} defaultSort kolom default (harus ada di allowedMap)
 * @returns {{ orderSql: string }}
 */
function buildSort(sort, order, allowedMap, defaultSort) {
  const col = allowedMap[sort] || allowedMap[defaultSort];
  const dir = String(order || '').toLowerCase() === 'asc' ? 'ASC' : 'DESC';
  return { orderSql: ` ORDER BY ${col} ${dir}` };
}

/**
 * Parse halaman & ukuran halaman dari query string.
 * @returns {{ page: number, pageSize: number, offset: number, hasPaging: boolean }}
 */
function parsePaging(query) {
  const hasPaging = query.page !== undefined || query.pageSize !== undefined;
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const pageSize = Math.min(Math.max(parseInt(query.pageSize, 10) || 10, 1), 100);
  return { page, pageSize, offset: (page - 1) * pageSize, hasPaging };
}

/**
 * Ambil satu halaman data + total.
 * @param {object} db instance (harus punya all & get yg resolve row/rows langsung)
 * @param {object} cfg { table, columns (select), searchCols, allowedSortMap,
 *                       defaultSort, baseWhere (mis. 'user_id = ?'), baseParams,
 *                       q, sort, order, page, pageSize }
 * @returns {Promise<{rows, total, page, pageSize, totalPages}>}
 */
async function runPaginated(db, cfg) {
  const {
    table, columns = '*', searchCols = [], allowedSortMap = {},
    defaultSort, baseWhere = '', baseParams = [],
    q = '', sort = '', order = '', page, pageSize,
  } = cfg;

  const search = buildSearch(searchCols, q);
  const orderBy = buildSort(sort, order, allowedSortMap, defaultSort);

  const whereParts = [];
  const params = [];
  if (baseWhere) { whereParts.push(baseWhere); params.push(...baseParams); }
  if (search.whereSql) { whereParts.push(search.whereSql.replace(/^ WHERE /, '')); params.push(...search.params); }
  const whereSql = whereParts.length ? ` WHERE ${whereParts.join(' AND ')}` : '';

  const rows = await db.all(
    `SELECT ${columns} FROM ${table}${whereSql}${orderBy.orderSql} LIMIT ? OFFSET ?`,
    [...params, pageSize, (page - 1) * pageSize]
  );

  const row = await db.get(
    `SELECT COUNT(*) AS total FROM ${table}${whereSql}`,
    params
  );
  const total = row ? row.total : 0;

  return {
    rows,
    total,
    page,
    pageSize,
    totalPages: Math.max(Math.ceil(total / pageSize), 1),
  };
}

module.exports = { buildSearch, buildSort, parsePaging, runPaginated };
