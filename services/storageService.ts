import { supabase, logDebug } from './supabaseClient';

// ===================
// STORAGE HELPERS
// ===================

/**
 * Convert base64 data URL to Blob
 */
export const dataURLtoBlob = (dataURL: string): Blob => {
  const arr = dataURL.split(',');
  const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/png';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
};

/**
 * Upload file to Supabase Storage and return file path
 * 
 * SECURITY: Returns path only, NOT public URL. Callers should use
 * getSignedUrl() to generate time-limited access URLs.
 * 
 * @param bucket - Storage bucket name ('signatures' or 'job-photos')
 * @param fileName - Unique file name / path within bucket
 * @param dataURL - Base64 data URL
 * @returns File path of uploaded file (use getSignedUrl for URL)
 */
export const uploadToStorage = async (
  bucket: string,
  fileName: string,
  dataURL: string
): Promise<string> => {
  try {
    const blob = dataURLtoBlob(dataURL);
    
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(fileName, blob, {
        contentType: blob.type,
        upsert: true, // Overwrite if exists
      });
    
    if (error) {
      // Fallback to base64 if storage fails
      return dataURL;
    }
    
    logDebug(`[Storage] Uploaded to ${bucket}:`, fileName);
    // Return path, not public URL - caller uses getSignedUrl when needed
    return data.path;
  } catch (e) {
    // Fallback to base64 if storage fails
    return dataURL;
  }
};

/**
 * Delete file from Supabase Storage
 * @param bucket - Storage bucket name
 * @param filePath - Path to file within bucket
 */
export const deleteFromStorage = async (
  bucket: string,
  filePath: string
): Promise<boolean> => {
  try {
    const { error } = await supabase.storage
      .from(bucket)
      .remove([filePath]);
    
    if (error) {
      return false;
    }
    
    logDebug(`[Storage] Deleted from ${bucket}:`, filePath);
    return true;
  } catch (e) {
    return false;
  }
};

/**
 * Get signed URL for private file access
 * @param bucket - Storage bucket name
 * @param filePath - Path to file within bucket
 * @param expiresIn - Seconds until URL expires (default 3600)
 */
export const getSignedUrl = async (
  bucket: string,
  filePath: string,
  expiresIn: number = 3600
): Promise<string | null> => {
  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(filePath, expiresIn);
    
    if (error) {
      return null;
    }
    
    return data.signedUrl;
  } catch (e) {
    return null;
  }
};
