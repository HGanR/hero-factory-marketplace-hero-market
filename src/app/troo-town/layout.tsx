import type { Metadata } from 'next';
import type { ReactNode } from 'react';

const title = 'Troo Town × Trust Vault';
const description = 'Explore a world of places, assets and community in Troo Town.';
const image = '/social/troo-town-trust-vault-v1.jpg';

/** Server-rendered sharing metadata for the public town, independent of its 3D client. */
export const metadata: Metadata = {
  title: 'Troo Town',
  description,
  alternates: { canonical: 'https://troothhurtz.app/troo-town' },
  openGraph: {
    type: 'website',
    url: 'https://troothhurtz.app/troo-town',
    siteName: 'TroothHurtz',
    title,
    description,
    images: [{
      url: image,
      width: 1734,
      height: 907,
      type: 'image/jpeg',
      alt: 'Troo Town and Trust Vault: a playful 3D town with a glowing vault, stadium, airport, bus and avatar visitors.',
    }],
  },
  twitter: {
    card: 'summary_large_image',
    title,
    description,
    images: [image],
  },
};

export default function TrooTownLayout({ children }: { children: ReactNode }) {
  return children;
}
