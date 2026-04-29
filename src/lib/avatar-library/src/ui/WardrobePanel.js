/**
 * WardrobePanel.js
 * Full wardrobe UI — tabbed panel covering all wearable slots:
 *   Hair | Hats | Glasses | Jewelry | Tops | Footwear
 *
 * Each tab shows a grid of asset cards with thumbnail, label,
 * category filter, and a colour picker where applicable.
 */

import { AssetRegistry, SLOTS } from '../assets/AssetRegistry.js';
import { HAIR_COLORS }           from '../assets/hair/HairAssets.js';

// ─── Tab groups ───────────────────────────────────────────────────────────────

const TAB_GROUPS = [
  { id: 'hair',     label: '💇 Hair',     slots: ['hair'] },
  { id: 'hats',     label: '🧢 Hats',     slots: ['hat'] },
  { id: 'glasses',  label: '👓 Eyewear',  slots: ['glasses', 'sunglasses'] },
  { id: 'jewelry',  label: '💎 Jewelry',  slots: ['necklace', 'earringL', 'braceletL', 'ring'] },
  { id: 'tops',     label: '👕 Tops',     slots: ['shirt', 'jacket'] },
  { id: 'footwear', label: '👟 Footwear', slots: ['sneakers', 'shoes', 'boots'] },
];

export class WardrobePanel {
  /**
   * @param {HTMLElement}  container
   * @param {AvatarEngine} engine
   */
  constructor(container, engine) {
    this.container  = container;
    this.engine     = engine;
    this._activeTab = 'hair';
    this._hairColor = '#0A0A0A';
    this._render();
  }

  // ─── Main render ──────────────────────────────────────────────────────────

  _render() {
    this.container.innerHTML = '';

    const panel = document.createElement('div');
    panel.className = 'avl-wardrobe-panel';

    // Tab bar
    const tabBar = document.createElement('div');
    tabBar.className = 'avl-tab-bar';

    const content = document.createElement('div');
    content.className = 'avl-tab-content';

    TAB_GROUPS.forEach(tab => {
      const btn = document.createElement('button');
      btn.className = 'avl-tab-btn' + (tab.id === this._activeTab ? ' avl-tab-btn--active' : '');
      btn.textContent = tab.label;
      btn.addEventListener('click', () => {
        this._activeTab = tab.id;
        tabBar.querySelectorAll('.avl-tab-btn').forEach(b => b.classList.remove('avl-tab-btn--active'));
        btn.classList.add('avl-tab-btn--active');
        content.innerHTML = '';
        this._renderTabContent(content, tab);
      });
      tabBar.appendChild(btn);
    });

    panel.appendChild(tabBar);
    this._renderTabContent(content, TAB_GROUPS.find(t => t.id === this._activeTab));
    panel.appendChild(content);
    this.container.appendChild(panel);
  }

  // ─── Tab content ──────────────────────────────────────────────────────────

  _renderTabContent(container, tab) {
    if (!tab) return;

    if (tab.id === 'hair') {
      this._renderHairTab(container);
    } else {
      tab.slots.forEach(slot => {
        const assets = AssetRegistry.getBySlot(slot);
        if (!assets.length) return;

        const slotDef = SLOTS[slot];
        const heading = document.createElement('h3');
        heading.className = 'avl-control-title';
        heading.textContent = `${slotDef?.icon || ''} ${slotDef?.label || slot}`;
        container.appendChild(heading);

        container.appendChild(this._assetGrid(assets, slot));

        // Remove button
        const removeBtn = document.createElement('button');
        removeBtn.className = 'avl-remove-btn';
        removeBtn.textContent = `Remove ${slotDef?.label || slot}`;
        removeBtn.addEventListener('click', () => {
          this.engine.remove(slot);
          container.querySelectorAll(`.avl-asset-card[data-slot="${slot}"]`).forEach(c => c.classList.remove('avl-asset-card--active'));
        });
        container.appendChild(removeBtn);
      });
    }
  }

  // ─── Hair tab (with colour picker) ───────────────────────────────────────

  _renderHairTab(container) {
    const hairAssets = AssetRegistry.getBySlot('hair');

    const heading = document.createElement('h3');
    heading.className = 'avl-control-title';
    heading.textContent = '💇 Hairstyle';
    container.appendChild(heading);

    container.appendChild(this._assetGrid(hairAssets, 'hair', true));

    // Hair colour palette
    const colorHeading = document.createElement('h3');
    colorHeading.className = 'avl-control-title';
    colorHeading.textContent = '🎨 Hair Colour';
    container.appendChild(colorHeading);

    const swatchGrid = document.createElement('div');
    swatchGrid.className = 'avl-swatch-grid';

    HAIR_COLORS.forEach(c => {
      const btn = document.createElement('button');
      btn.className = 'avl-swatch' + (c.hex === this._hairColor ? ' avl-swatch--active' : '');
      btn.style.backgroundColor = c.hex;
      btn.title = c.label;
      btn.addEventListener('click', () => {
        this._hairColor = c.hex;
        swatchGrid.querySelectorAll('.avl-swatch').forEach(s => s.classList.remove('avl-swatch--active'));
        btn.classList.add('avl-swatch--active');
        const currentHair = this.engine.getState().attachments.hair;
        if (currentHair) this.engine.wear('hair', currentHair);
      });
      swatchGrid.appendChild(btn);
    });

    container.appendChild(swatchGrid);

    // Custom colour
    const customRow = document.createElement('div');
    customRow.className = 'avl-custom-color-row';
    const lbl = document.createElement('label');
    lbl.textContent = 'Custom:'; lbl.className = 'avl-label';
    const input = document.createElement('input');
    input.type = 'color'; input.className = 'avl-color-input'; input.value = this._hairColor;
    input.addEventListener('input', e => {
      this._hairColor = e.target.value;
      swatchGrid.querySelectorAll('.avl-swatch').forEach(s => s.classList.remove('avl-swatch--active'));
      const currentHair = this.engine.getState().attachments.hair;
      if (currentHair) this.engine.wear('hair', currentHair);
    });
    customRow.appendChild(lbl); customRow.appendChild(input);
    container.appendChild(customRow);

    // Remove button
    const removeBtn = document.createElement('button');
    removeBtn.className = 'avl-remove-btn';
    removeBtn.textContent = 'Remove Hair';
    removeBtn.addEventListener('click', () => {
      this.engine.remove('hair');
      container.querySelectorAll('.avl-asset-card[data-slot="hair"]').forEach(c => c.classList.remove('avl-asset-card--active'));
    });
    container.appendChild(removeBtn);
  }

  // ─── Asset grid ───────────────────────────────────────────────────────────

  _assetGrid(assets, slot, isHair = false) {
    const grid = document.createElement('div');
    grid.className = 'avl-asset-grid';

    // Group by category
    const categories = [...new Set(assets.map(a => a.category))];
    const state = this.engine.getState();

    categories.forEach(cat => {
      const catItems = assets.filter(a => a.category === cat);

      const catLabel = document.createElement('div');
      catLabel.className = 'avl-category-label';
      catLabel.textContent = cat.charAt(0).toUpperCase() + cat.slice(1);
      grid.appendChild(catLabel);

      const row = document.createElement('div');
      row.className = 'avl-asset-row';

      catItems.forEach(asset => {
        const isActive = state.attachments[slot] === asset.id;
        const card = document.createElement('button');
        card.className = 'avl-asset-card' + (isActive ? ' avl-asset-card--active' : '');
        card.dataset.slot = slot;
        card.dataset.id = asset.id;
        card.title = asset.description || asset.label;

        const icon = document.createElement('span');
        icon.className = 'avl-asset-icon';
        icon.textContent = asset.thumbnail || '◉';

        const lbl = document.createElement('span');
        lbl.className = 'avl-asset-label';
        lbl.textContent = asset.label;

        card.appendChild(icon);
        card.appendChild(lbl);

        card.addEventListener('click', () => {
          grid.querySelectorAll(`.avl-asset-card[data-slot="${slot}"]`).forEach(c => c.classList.remove('avl-asset-card--active'));
          card.classList.add('avl-asset-card--active');
          this.engine.wear(slot, asset.id);
        });

        row.appendChild(card);
      });

      grid.appendChild(row);
    });

    return grid;
  }

  /** Refresh the panel (e.g. after loading a saved state) */
  refresh() {
    this._render();
  }
}
