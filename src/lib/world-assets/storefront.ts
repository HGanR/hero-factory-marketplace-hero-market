import level2 from './level2-store.json';
export const STOREFRONT = {
  id: 'ca2b381c-369e-4db2-a83f-768b6ee2d903',
  key: 'storefront-v2', slug: 'storefront-v2', name: 'Level 1 Office Bldg',
  modelUrl: '/models/world-assets/storefront-v2/storefront_v2.glb',
  previewImageUrl: '/models/world-assets/storefront-v2/storefront_v2_preview.webp',
  manifestUrl: '/models/world-assets/storefront-v2/storefront_v2_slots.json',
  tokenPrice: 5,
} as const;

export const LEVEL2_STORE=level2;
export const STOREFRONTS=[STOREFRONT,LEVEL2_STORE] as const;
export const storefrontForModel=(modelUrl:string)=>STOREFRONTS.find(a=>a.modelUrl===modelUrl.split(/[?#]/)[0]);
