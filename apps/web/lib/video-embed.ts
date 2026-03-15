/**
 * Video embed utilities for safe iframe rendering.
 * Supports Bunny Stream, YouTube, and Vimeo.
 */

/** Allowed video embed hostnames (no protocol, lowercase) */
const ALLOWED_DOMAINS = [
  'player.mediadelivery.net',
  'iframe.mediadelivery.net',
  'www.youtube.com',
  'youtube.com',
  'youtu.be',
  'player.vimeo.com',
  'vimeo.com',
] as const;

function isAllowedHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^www\./, '');
  return ALLOWED_DOMAINS.some((d) => h === d || h.endsWith('.' + d));
}

/**
 * Extract src URL from iframe embed code.
 * Returns null if not found or invalid.
 */
function extractSrcFromIframe(html: string): string | null {
  const trimmed = html.trim();
  if (!trimmed) return null;

  // Match src="..." or src='...'
  const match = trimmed.match(/<iframe[^>]*\ssrc\s*=\s*["']([^"']+)["']/i);
  if (!match) return null;

  try {
    const url = new URL(match[1].trim());
    return url.href;
  } catch {
    return null;
  }
}

/**
 * Convert YouTube/Vimeo watch URLs to embed URLs.
 */
function toEmbedUrl(url: string): string {
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtube.com') && u.searchParams.has('v')) {
      return `https://www.youtube.com/embed/${u.searchParams.get('v')}`;
    }
    if (u.hostname === 'youtu.be') {
      return `https://www.youtube.com/embed${u.pathname}`;
    }
    if (u.hostname.includes('vimeo.com')) {
      const id = u.pathname.replace(/^\//, '').split('/')[0];
      return `https://player.vimeo.com/video/${id}`;
    }
    return url;
  } catch {
    return url;
  }
}

/**
 * Result of parsing video input.
 */
export type ParseVideoResult =
  | { ok: true; url: string }
  | { ok: false; error: 'empty' | 'invalid_format' | 'unsupported_domain' };

/**
 * Parse video input (URL or iframe embed code) and return a validated embed URL.
 * Returns null if invalid or from a disallowed domain.
 */
export function parseVideoInput(input: string | null | undefined): string | null {
  if (!input || typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  let url: string | null = null;

  if (/<iframe/i.test(trimmed)) {
    url = extractSrcFromIframe(trimmed);
  } else if (/^https?:\/\//i.test(trimmed)) {
    url = trimmed;
  }

  if (!url) return null;

  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) return null;
    if (!isAllowedHost(parsed.hostname)) return null;

    const embedUrl = toEmbedUrl(url);
    return embedUrl;
  } catch {
    return null;
  }
}

/**
 * Parse video input with detailed error for UI feedback.
 */
export function parseVideoInputWithStatus(
  input: string | null | undefined
): ParseVideoResult {
  if (!input || typeof input !== 'string') {
    return { ok: false, error: 'empty' };
  }
  const trimmed = input.trim();
  if (!trimmed) {
    return { ok: false, error: 'empty' };
  }

  let url: string | null = null;
  if (/<iframe/i.test(trimmed)) {
    url = extractSrcFromIframe(trimmed);
  } else if (/^https?:\/\//i.test(trimmed)) {
    url = trimmed;
  } else {
    return { ok: false, error: 'invalid_format' };
  }

  if (!url) {
    return { ok: false, error: 'invalid_format' };
  }

  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { ok: false, error: 'unsupported_domain' };
    }
    if (!isAllowedHost(parsed.hostname)) {
      return { ok: false, error: 'unsupported_domain' };
    }
    return { ok: true, url: toEmbedUrl(url) };
  } catch {
    return { ok: false, error: 'unsupported_domain' };
  }
}

/**
 * Get a safe embed URL from lesson video fields.
 * Prefers videoUrl; falls back to parsing videoEmbed.
 */
export function getValidEmbedUrl(
  videoUrl: string | null | undefined,
  videoEmbed: string | null | undefined
): string | null {
  const fromUrl = parseVideoInput(videoUrl);
  if (fromUrl) return fromUrl;
  return parseVideoInput(videoEmbed);
}
