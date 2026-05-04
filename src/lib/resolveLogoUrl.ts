// Utilitaire pour résoudre l'URL du logo
export function resolveLogoUrl(logo_url?: string | null): string {
  if (!logo_url) return '/default-logo.png';
  if (logo_url.startsWith('data:')) return logo_url;
  if (logo_url.startsWith('http')) return logo_url;
  return `${window.location.origin}${logo_url}`;
}
