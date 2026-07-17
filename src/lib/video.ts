// Shared video URL handling — used by the studio block editor and the stage renderer.

export type VideoProvider = 'youtube' | 'vimeo' | 'loom' | 'mp4';

export function youtubeId(url: string): string | null {
  const m = url.match(
    /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,20})/,
  );
  return m ? m[1] : null;
}

export function vimeoId(url: string): string | null {
  const m = url.match(/vimeo\.com\/(?:video\/)?(\d{6,12})/);
  return m ? m[1] : null;
}

export function loomId(url: string): string | null {
  const m = url.match(/loom\.com\/(?:share|embed)\/([a-f0-9]{16,40})/i);
  return m ? m[1] : null;
}

export function detectVideoProvider(url: string): VideoProvider {
  if (youtubeId(url)) return 'youtube';
  if (vimeoId(url)) return 'vimeo';
  if (loomId(url)) return 'loom';
  return 'mp4';
}

export const providerLabel: Record<VideoProvider, string> = {
  youtube: 'YouTube',
  vimeo: 'Vimeo',
  loom: 'Loom',
  mp4: 'Video file',
};

/** Embed URL for iframe providers; null for direct files. */
export function embedUrl(provider: VideoProvider, url: string, autoplay?: boolean): string | null {
  if (provider === 'youtube') {
    const id = youtubeId(url);
    return id
      ? `https://www.youtube-nocookie.com/embed/${id}?rel=0&mute=1${autoplay ? '&autoplay=1' : ''}`
      : null;
  }
  if (provider === 'vimeo') {
    const id = vimeoId(url);
    return id
      ? `https://player.vimeo.com/video/${id}?dnt=1&muted=1${autoplay ? '&autoplay=1' : ''}`
      : null;
  }
  if (provider === 'loom') {
    const id = loomId(url);
    return id ? `https://www.loom.com/embed/${id}?hide_owner=true&hide_share=true` : null;
  }
  return null;
}
