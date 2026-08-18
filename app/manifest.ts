import type { MetadataRoute } from 'next';
export const dynamic = 'force-static';

export default function manifest(): MetadataRoute.Manifest {
  let basePath = '';
  if (process.env.GITHUB_ACTIONS && process.env.GITHUB_REPOSITORY) {
    basePath = `/${process.env.GITHUB_REPOSITORY.split('/')[1]}`;
  }

  return {
    name: '輕鬆記 (FinTrack)',
    short_name: 'FinTrack',
    description: '簡單、無壓力的個人記帳與發票存摺應用程式',
    start_url: basePath || '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#ffffff',
    icons: [
      {
        src: 'icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable'
      },
      {
        src: 'icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable'
      }
    ]
  };
}
