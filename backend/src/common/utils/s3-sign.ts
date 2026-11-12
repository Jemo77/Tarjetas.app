import { createHmac, createHash } from 'node:crypto';

export interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  publicUrl: string;
}

const rfc3986 = (s: string) =>
  encodeURIComponent(s).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);

const hmac = (key: Buffer | string, data: string) => createHmac('sha256', key).update(data).digest();
const sha256 = (data: string) => createHash('sha256').update(data).digest('hex');

/**
 * URL firmada (SigV4) para subir un objeto con PUT directo a Cloudflare R2
 * (compatible con S3). La URL vence en `expiresSeconds` y solo permite el PUT.
 */
export function presignPutUrl(
  cfg: R2Config,
  key: string,
  _contentType: string,
  expiresSeconds = 600,
): string {
  const host = `${cfg.bucket}.${cfg.accountId}.r2.cloudflarestorage.com`;
  const region = 'auto';
  const service = 's3';
  const now = new Date();
  const amzDate = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const dateStamp = amzDate.slice(0, 8);
  const credential = `${cfg.accessKeyId}/${dateStamp}/${region}/${service}/aws4_request`;

  const qParams = [
    'X-Amz-Algorithm=AWS4-HMAC-SHA256',
    `X-Amz-Credential=${rfc3986(credential)}`,
    `X-Amz-Date=${amzDate}`,
    `X-Amz-Expires=${expiresSeconds}`,
    'X-Amz-SignedHeaders=host',
  ];
  const canonicalQuery = qParams.sort().join('&');

  const canonicalRequest = [
    'PUT',
    rfc3986(`/${key}`),
    canonicalQuery,
    `host:${host}`,
    '',
    'host',
    'UNSIGNED-PAYLOAD',
  ].join('\n');

  const scope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256(canonicalRequest)].join('\n');

  const kDate = hmac(`AWS4${cfg.secretAccessKey}`, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  const kSigning = hmac(kService, 'aws4_request');
  const signature = createHmac('sha256', kSigning)
    .update(stringToSign)
    .digest('hex');

  return `https://${host}/${rfc3986(key)}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}