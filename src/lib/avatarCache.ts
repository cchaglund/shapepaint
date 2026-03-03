import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Fetches a Google profile image and uploads it to Supabase Storage.
 * Returns the permanent public URL, or null if anything fails.
 * Idempotent — uses upsert:true so safe to call multiple times.
 */
export async function cacheGoogleAvatar(
  supabase: SupabaseClient,
  userId: string,
  googleAvatarUrl: string,
): Promise<string | null> {
  try {
    const response = await fetch(googleAvatarUrl);
    if (!response.ok) return null;
    const blob = await response.blob();

    const { error } = await supabase.storage
      .from('avatars')
      .upload(`${userId}/avatar`, blob, {
        contentType: blob.type || 'image/jpeg',
        upsert: true,
        cacheControl: '31536000', // 1 year
      });
    if (error) return null;

    const { data } = supabase.storage.from('avatars').getPublicUrl(`${userId}/avatar`);
    return data.publicUrl;
  } catch {
    return null;
  }
}
