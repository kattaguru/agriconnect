import { createClient } from '@supabase/supabase-js';

const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL ||
  import.meta.env.NEXT_PUBLIC_SUPABASE_URL ||
  'https://gpvdskwksuwmoaptlpef.supabase.co';

const supabaseKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  'sb_publishable_5iFc-sAm2HXbag5iaBFjqw_jaCNdDvH';

export const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Uploads a crop leaf image to the Supabase 'crop-scans' storage bucket.
 * Returns public URL if successful.
 */
export async function uploadCropScanImage(file: File): Promise<string | null> {
  try {
    const fileExt = file.name.split('.').pop() || 'jpg';
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
    const filePath = `scans/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('crop-scans')
      .upload(filePath, file, { cacheControl: '3600', upsert: false });

    if (uploadError) {
      console.warn('Supabase storage upload error:', uploadError.message);
      return null;
    }

    const { data } = supabase.storage.from('crop-scans').getPublicUrl(filePath);
    return data.publicUrl;
  } catch (err) {
    console.error('Error in uploadCropScanImage:', err);
    return null;
  }
}

/**
 * Check if Supabase connection is reachable.
 */
export async function checkSupabaseConnection(): Promise<boolean> {
  try {
    const { error } = await supabase.from('users').select('id').limit(1);
    // If table doesn't exist yet, it's a 404 or Postgres error, but connection works
    return !error || error.code === 'PGRST116' || error.code === '42P01';
  } catch {
    return false;
  }
}
