// Async handler wrapper — Express 5 sudah support promise rejection otomatis,
// tapi wrapper ini menjaga kompatibilitas & memberi stack trace yang lebih jelas.
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;