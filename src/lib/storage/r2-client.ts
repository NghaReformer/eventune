/**
 * Cloudflare R2 Storage Client
 * S3-compatible storage for audio files and deliverables
 *
 * Security: Signed URLs, file type validation, size limits
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// Lazy initialization
let r2Client: S3Client | null = null;

const BUCKET_NAME = import.meta.env.R2_BUCKET_NAME || 'eventune-files';
const R2_ACCOUNT_ID = import.meta.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = import.meta.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = import.meta.env.R2_SECRET_ACCESS_KEY;

// File configuration
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB
const ALLOWED_AUDIO_TYPES = ['audio/mpeg', 'audio/wav', 'audio/flac', 'audio/aac', 'audio/mp4'];
const ALLOWED_EXTENSIONS = ['.mp3', '.wav', '.flac', '.aac', '.m4a'];

/**
 * Get R2 client (lazy init)
 */
function getClient(): S3Client {
  if (!r2Client) {
    if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
      throw new Error('R2 credentials not configured');
    }

    r2Client = new S3Client({
      region: 'auto',
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
      },
    });
  }
  return r2Client;
}

/**
 * File upload result
 */
export interface UploadResult {
  success: boolean;
  key?: string;
  url?: string;
  size?: number;
  error?: string;
}

/**
 * Signed URL result
 */
export interface SignedUrlResult {
  success: boolean;
  url?: string;
  expiresAt?: Date;
  error?: string;
}

/**
 * Validate file type and extension
 */
export function validateAudioFile(
  filename: string,
  mimeType?: string,
  size?: number
): { valid: boolean; error?: string } {
  // Check file extension
  const ext = filename.toLowerCase().slice(filename.lastIndexOf('.'));
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return {
      valid: false,
      error: `Invalid file type. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`,
    };
  }

  // Check MIME type if provided
  if (mimeType && !ALLOWED_AUDIO_TYPES.includes(mimeType)) {
    return {
      valid: false,
      error: 'Invalid audio format',
    };
  }

  // Check file size
  if (size && size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File too large. Maximum size: ${MAX_FILE_SIZE / (1024 * 1024)} MB`,
    };
  }

  return { valid: true };
}

/**
 * Generate storage key for order deliverables
 * Format: orders/{order_id}/deliverables/{filename}
 */
export function generateDeliverableKey(orderId: string, filename: string): string {
  const sanitizedFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  const timestamp = Date.now();
  return `orders/${orderId}/deliverables/${timestamp}-${sanitizedFilename}`;
}

/**
 * Upload file to R2
 */
export async function uploadFile(
  key: string,
  body: Buffer | Uint8Array | Blob,
  contentType: string,
  metadata?: Record<string, string>
): Promise<UploadResult> {
  try {
    const client = getClient();

    // Convert Blob to ArrayBuffer if needed
    let fileBody: Buffer | Uint8Array;
    if (body instanceof Blob) {
      const arrayBuffer = await body.arrayBuffer();
      fileBody = new Uint8Array(arrayBuffer);
    } else {
      fileBody = body;
    }

    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: fileBody,
      ContentType: contentType,
      Metadata: metadata,
    });

    await client.send(command);

    return {
      success: true,
      key,
      size: fileBody.length,
    };
  } catch (error) {
    console.error('[R2] Upload error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Upload failed',
    };
  }
}

/**
 * Generate a signed URL for downloading a file
 * Default expiration: 1 hour
 */
export async function getSignedDownloadUrl(
  key: string,
  expiresInSeconds: number = 3600,
  downloadFilename?: string
): Promise<SignedUrlResult> {
  try {
    const client = getClient();

    // First check if file exists
    const headCommand = new HeadObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });

    try {
      await client.send(headCommand);
    } catch {
      return {
        success: false,
        error: 'File not found',
      };
    }

    // Generate signed URL
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      ResponseContentDisposition: downloadFilename
        ? `attachment; filename="${downloadFilename}"`
        : undefined,
    });

    const url = await getSignedUrl(client, command, { expiresIn: expiresInSeconds });
    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);

    return {
      success: true,
      url,
      expiresAt,
    };
  } catch (error) {
    console.error('[R2] Signed URL error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate download URL',
    };
  }
}

/**
 * Generate a signed URL for uploading a file
 */
export async function getSignedUploadUrl(
  key: string,
  contentType: string,
  expiresInSeconds: number = 3600
): Promise<SignedUrlResult> {
  try {
    const client = getClient();

    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      ContentType: contentType,
    });

    const url = await getSignedUrl(client, command, { expiresIn: expiresInSeconds });
    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);

    return {
      success: true,
      url,
      expiresAt,
    };
  } catch (error) {
    console.error('[R2] Upload URL error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate upload URL',
    };
  }
}

/**
 * Delete a file from R2
 */
export async function deleteFile(key: string): Promise<{ success: boolean; error?: string }> {
  try {
    const client = getClient();

    const command = new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });

    await client.send(command);

    return { success: true };
  } catch (error) {
    console.error('[R2] Delete error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Delete failed',
    };
  }
}

/**
 * Check if a file exists
 */
export async function fileExists(key: string): Promise<boolean> {
  try {
    const client = getClient();

    const command = new HeadObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });

    await client.send(command);
    return true;
  } catch {
    return false;
  }
}
