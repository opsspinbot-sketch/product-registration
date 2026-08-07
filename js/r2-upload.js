/**
 * SpinBot — Cloudflare R2 Upload Service (Frontend Module)
 */
import { R2_WORKER_URL, R2_API_SECRET } from './firebase-config.js?v=16.0.0';

/**
 * @param {File} file           - The file to upload
 * @param {Function} onProgress - Optional callback(percent: 0-100)
 * @returns {Promise<string>}   - Public HTTP URL of the uploaded file on Cloudflare R2
 */
export async function uploadToR2(file, onProgress = null) {
  if (!file) return '';

  if (onProgress) onProgress(20);

  // Validate file type
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
  if (!allowed.includes(file.type)) {
    console.warn('Unsupported file type for remote upload, using local preview fallback.');
    if (onProgress) onProgress(100);
    return await readFilePreview(file);
  }

  try {
    if (onProgress) onProgress(40);
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${R2_WORKER_URL}/upload`, {
      method: 'POST',
      headers: {
        'X-Api-Secret': R2_API_SECRET
      },
      body: formData
    });

    if (onProgress) onProgress(80);
    const result = await response.json();
    if (response.ok && result.ok && result.url) {
      if (onProgress) onProgress(100);
      console.log('Cloudflare R2 Upload Successful. Public URL:', result.url);
      return result.url;
    } else {
      console.warn('R2 Worker returned error:', result.error);
    }
  } catch (err) {
    console.warn('Worker upload error, falling back to Base64:', err);
  }

  if (onProgress) onProgress(100);
  return await readFilePreview(file);
}

/**
 * Helper: read file as a data URL for preview & local storage fallback
 * @param {File} file
 * @returns {Promise<string>} data URL
 */
export function readFilePreview(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result || '');
    reader.onerror = () => resolve('');
    reader.readAsDataURL(file);
  });
}
