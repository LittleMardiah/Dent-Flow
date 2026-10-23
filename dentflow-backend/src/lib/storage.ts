import { Client } from 'minio';
import { config } from '../config';
import { logger } from '../utils/logger';

export const BUCKET = config.minio.bucket || 'dentflow';
const PRESIGN_EXPIRY_SECONDS = 60 * 60;

interface ParsedEndpoint {
  endPoint: string;
  port: number;
  useSSL: boolean;
}

function parseEndpoint(rawEndpoint: string): ParsedEndpoint {
  let endpoint = rawEndpoint.trim();
  let useSSL = false;

  if (endpoint.startsWith('https://')) {
    useSSL = true;
    endpoint = endpoint.slice('https://'.length);
  } else if (endpoint.startsWith('http://')) {
    endpoint = endpoint.slice('http://'.length);
  }

  endpoint = endpoint.replace(/\/$/, '');

  let port = useSSL ? 443 : 80;
  const portSeparator = endpoint.lastIndexOf(':');
  if (portSeparator !== -1) {
    const parsedPort = Number.parseInt(endpoint.slice(portSeparator + 1), 10);
    if (!Number.isNaN(parsedPort)) {
      port = parsedPort;
      endpoint = endpoint.slice(0, portSeparator);
    }
  }

  return { endPoint: endpoint, port, useSSL };
}

const endpoint = parseEndpoint(config.minio.endpoint);

export const minioClient = new Client({
  endPoint: endpoint.endPoint,
  port: endpoint.port,
  useSSL: endpoint.useSSL,
  accessKey: config.minio.accessKey,
  secretKey: config.minio.secretKey,
});

let bucketReady: Promise<void> | null = null;

export async function ensureBucket(): Promise<void> {
  if (!bucketReady) {
    bucketReady = (async () => {
      const exists = await minioClient.bucketExists(BUCKET);
      if (!exists) {
        await minioClient.makeBucket(BUCKET);
        logger.info({ bucket: BUCKET }, 'Storage bucket created');
      }
    })();

    try {
      await bucketReady;
    } catch (error) {
      bucketReady = null;
      throw error;
    }
  }

  await bucketReady;
}

export async function uploadFile(
  buffer: Buffer,
  filename: string,
  mimetype: string
): Promise<{ bucket: string; filename: string }> {
  await ensureBucket();

  await minioClient.putObject(BUCKET, filename, buffer, buffer.length, {
    'Content-Type': mimetype,
  });

  return { bucket: BUCKET, filename };
}

export async function getPresignedUrl(filename: string): Promise<string> {
  return minioClient.presignedGetObject(BUCKET, filename, PRESIGN_EXPIRY_SECONDS);
}
