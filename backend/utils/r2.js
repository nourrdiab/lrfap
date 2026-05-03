const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const crypto = require('crypto');

const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

const BUCKET = process.env.R2_BUCKET_NAME;

const uploadToR2 = async ({ buffer, mimeType, folder = 'documents', originalName }) => {
  const ext = originalName.split('.').pop();
  const key = `${folder}/${crypto.randomUUID()}.${ext}`;

  await r2Client.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: buffer,
      ContentType: mimeType,
      Metadata: { originalName },
    })
  );

  return { key, originalName, mimeType, size: buffer.length };
};

const getDownloadUrl = async (key, expiresInSeconds = 3600, options = {}) => {
  const params = { Bucket: BUCKET, Key: key };
  if (options.disposition === 'attachment') {
    const safeName = (options.filename || 'download').replace(/"/g, '');
    params.ResponseContentDisposition = `attachment; filename="${safeName}"`;
  } else if (options.disposition === 'inline') {
    params.ResponseContentDisposition = 'inline';
  }
  const command = new GetObjectCommand(params);
  return getSignedUrl(r2Client, command, { expiresIn: expiresInSeconds });
};

const deleteFromR2 = async (key) => {
  await r2Client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
};

module.exports = { uploadToR2, getDownloadUrl, deleteFromR2 };