/**
 * AssetRegistry.js
 * Central registry for all avatar wearable assets.
 * Aggregates every asset library and provides fast lookup by ID.
 */

import { HAIR_LIBRARY }       from './hair/HairAssets.js';
import { HAT_LIBRARY }        from './hats/HatAssets.js';
import { GLASSES_LIBRARY, SUNGLASSES_LIBRARY } from './glasses/GlassesAssets.js';
import { JEWELRY_LIBRARY }    from './jewelry/JewelryAssets.js';
import { SHIRT_LIBRARY, JACKET_LIBRARY } from './shirts/ShirtAssets.js';
import { SNEAKER_LIBRARY, SHOES_LIBRARY, BOOTS_LIBRARY } from './shoes/ShoeAssets.js';

// ─── Slot definitions ─────────────────────────────────────────────────────────

export const SLOTS = {
  hair:       { label: 'Hair',        icon: '💇', multiple: false },
  hat:        { label: 'Hat',         icon: '🧢', multiple: false },
  glasses:    { label: 'Glasses',     icon: '👓', multiple: false },
  sunglasses: { label: 'Sunglasses',  icon: '🕶️', multiple: false },
  necklace:   { label: 'Necklace',    icon: '📿', multiple: false },
  earringL:   { label: 'Earrings',    icon: '💎', multiple: false },
  braceletL:  { label: 'Bracelet',    icon: '🔱', multiple: false },
  ring:       { label: 'Ring',        icon: '💍', multiple: false },
  shirt:      { label: 'Shirt',       icon: '👕', multiple: false },
  jacket:     { label: 'Jacket',      icon: '🧥', multiple: false },
  pants:      { label: 'Pants',       icon: '👖', multiple: false },
  shoes:      { label: 'Shoes',       icon: '👞', multiple: false },
  sneakers:   { label: 'Sneakers',    icon: '👟', multiple: false },
  boots:      { label: 'Boots',       icon: '🥾', multiple: false },
};

// ─── Tag every asset with its slot ───────────────────────────────────────────

const tagSlot = (assets, slot) => assets.map(a => ({ ...a, slot: a.slot || slot }));

const ALL_ASSETS = [
  ...tagSlot(HAIR_LIBRARY,        'hair'),
  ...tagSlot(HAT_LIBRARY,         'hat'),
  ...tagSlot(GLASSES_LIBRARY,     'glasses'),
  ...tagSlot(SUNGLASSES_LIBRARY,  'sunglasses'),
  ...tagSlot(JEWELRY_LIBRARY,     null),   // jewelry has its own slot field
  ...tagSlot(SHIRT_LIBRARY,       'shirt'),
  ...tagSlot(JACKET_LIBRARY,      'jacket'),
  ...tagSlot(SNEAKER_LIBRARY,     'sneakers'),
  ...tagSlot(SHOES_LIBRARY,       'shoes'),
  ...tagSlot(BOOTS_LIBRARY,       'boots'),
];

// ─── Build lookup map ─────────────────────────────────────────────────────────

const _registry = new Map();
ALL_ASSETS.forEach(asset => _registry.set(asset.id, asset));

// ─── Public API ───────────────────────────────────────────────────────────────

export const AssetRegistry = {
  /** Get asset by ID */
  get(id) {
    return _registry.get(id) || null;
  },

  /** Get all assets for a given slot */
  getBySlot(slot) {
    return ALL_ASSETS.filter(a => a.slot === slot);
  },

  /** Get all assets for a given category */
  getByCategory(category) {
    return ALL_ASSETS.filter(a => a.category === category);
  },

  /** Get all asset IDs */
  getAllIds() {
    return [..._registry.keys()];
  },

  /** Get all assets */
  getAll() {
    return [...ALL_ASSETS];
  },

  /** Search assets by label */
  search(query) {
    const q = query.toLowerCase();
    return ALL_ASSETS.filter(a =>
      a.label.toLowerCase().includes(q) ||
      a.description?.toLowerCase().includes(q) ||
      a.category?.toLowerCase().includes(q)
    );
  },

  /** Total asset count */
  get count() {
    return _registry.size;
  },
};
