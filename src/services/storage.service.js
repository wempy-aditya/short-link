const crypto = require('crypto');
const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const config = require('../config');

function isConfigured() {
  const s = config.storage;
  return Boolean(s.endpoint && s.bucket && s.accessKeyId && s.secretAccessKey);
}

function getClient() {
  if (!isConfigured()) throw new Error('S3 storage belum dikonfigurasi');
  return new S3Client({
    endpoint: config.storage.endpoint,
    region: config.storage.region,
    forcePathStyle: config.storage.forcePathStyle,
    credentials: {
      accessKeyId: config.storage.accessKeyId,
      secretAccessKey: config.storage.secretAccessKey,
    },
  });
}

function safeObjectName(name) {
  const clean = String(name || 'file').normalize('NFKC').replace(/[^\p{L}\p{N}._-]+/gu, '-').replace(/-+/g, '-').replace(/^[-.]+|[-.]+$/g, '').slice(0, 180);
  return clean || 'file';
}

function createObjectKey(userId, originalName) {
  return `users/${userId}/${crypto.randomUUID()}-${safeObjectName(originalName)}`;
}

function createShareToken() {
  const token = crypto.randomBytes(32).toString('base64url');
  return { token, hash: crypto.createHash('sha256').update(token).digest('hex') };
}

async function uploadObject({ key, body, contentType }) {
  await getClient().send(new PutObjectCommand({
    Bucket: config.storage.bucket,
    Key: key,
    Body: body,
    ContentType: contentType || 'application/octet-stream',
  }));
}

async function createPreviewUrl(key, contentType, originalName) {
  const command = new GetObjectCommand({
    Bucket: config.storage.bucket,
    Key: key,
    ResponseContentType: contentType || 'application/octet-stream',
    ResponseContentDisposition: `inline; filename="${safeObjectName(originalName)}"`,
  });
  return getSignedUrl(getClient(), command, { expiresIn: config.storage.presignedTtlSeconds });
}

async function deleteObject(key) {
  await getClient().send(new DeleteObjectCommand({ Bucket: config.storage.bucket, Key: key }));
}

async function headObject(key) {
  return getClient().send(new HeadObjectCommand({ Bucket: config.storage.bucket, Key: key }));
}

module.exports = {
  isConfigured,
  createObjectKey,
  createShareToken,
  uploadObject,
  createPreviewUrl,
  deleteObject,
  headObject,
};