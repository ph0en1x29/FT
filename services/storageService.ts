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
 * Upload file to Supabase Storage and return public URL
 * @param bucket - Storage bucket name ('signatures' or 'job-photos')
 * @param fileName - Unique file name
 * @param dataURL - Base64 data URL
 * @returns Public URL of uploaded file
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
      console.error(`[Storage] Upload to ${bucket} failed:`, error.message);
      // Fallback to base64 if storage fails
      return dataURL;
    }
    
    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from(bucket)
      .getPublicUrl(fileName);
    
    logDebug(`[Storage] Uploaded to ${bucket}:`, fileName);
    return publicUrl;
  } catch (e) {
    console.error('[Storage] Upload error:', e);
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
      console.error(`[Storage] Delete from ${bucket} failed:`, error.message);
      return false;
    }
    
    logDebug(`[Storage] Deleted from ${bucket}:`, filePath);
    return true;
  } catch (e) {
    console.error('[Storage] Delete error:', e);
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
      console.error(`[Storage] Signed URL failed:`, error.message);
      return null;
    }
    
    return data.signedUrl;
  } catch (e) {
    console.error('[Storage] Signed URL error:', e);
    return null;
  }
};
