/**
 * FacePicker.js
 * Tabbed UI panel for selecting facial features:
 *   Tab 1 — Eyes    (shape grid + iris colour palette)
 *   Tab 2 — Nose    (shape grid)
 *   Tab 3 — Ears    (shape grid)
 *   Tab 4 — Mouth   (shape grid + lip colour palette)
 *
 * Connects directly to a FaceBuilder instance.
 */

import { EYE_LIBRARY, EYE_COLORS }     from '../assets/eyes/EyeAssets.js';
import { NOSE_LIBRARY }                 from '../assets/nose/NoseAssets.js';
import { EAR_LIBRARY }                  from '../assets/ears/EarAssets.js';
import { MOUTH_LIBRARY, LIP_COLORS }    from '../assets/mouths/MouthAssets.js';

export class FacePicker {
  /**
   * @param {HTMLElement}  container
   * @param {FaceBuilder}  faceBuilder
   */
  constructor(container, faceBuilder) {
    this.container    = container;
    this.faceBuilder  = faceBuilder;
    this._activeTab   = 'eyes';
    this._render();
  }

  // ─── Main render ──────────────────────────────────────────────────────────

  _render() {
    this.container.innerHTML = '';

    const panel = document.createElement('div');
    panel.className = 'avl-face-picker';

    // Tab bar
    const tabBar = document.createElement('div');
    tabBar.className = 'avl-tab-bar';

    const tabs = [
      { id: 'eyes',  label: '👁 Eyes'  },
      { id: 'nose',  label: '👃 Nose'  },
      { id: 'ears',  label: '👂 Ears'  },
      { id: 'mouth', label: '👄 Mouth' },
    ];

    tabs.forEach(tab => {
      const btn = document.createElement('button');
      btn.className = 'avl-tab-btn' + (tab.id === this._activeTab ? ' avl-tab-btn--active' : '');
      btn.textContent = tab.label;
      btn.dataset.tab = tab.id;
      btn.addEventListener('click', () => {
        this._activeTab = tab.id;
        tabBar.querySelectorAll('.avl-tab-btn').forEach(b => b.classList.remove('avl-tab-btn--active'));
        btn.classList.add('avl-tab-btn--active');
        content.innerHTML = '';
        this._renderTabContent(content, tab.id);
      });
      tabBar.appendChild(btn);
    });

    panel.appendChild(tabBar);

    // Tab content area
    const content = document.createElement('div');
    content.className = 'avl-tab-content';
    this._renderTabContent(content, this._activeTab);
    panel.appendChild(content);

    this.container.appendChild(panel);
  }

  // ─── Tab content ──────────────────────────────────────────────────────────

  _renderTabContent(container, tab) {
    switch (tab) {
      case 'eyes':  return this._renderEyesTab(container);
      case 'nose':  return this._renderNoseTab(container);
      case 'ears':  return this._renderEarsTab(container);
      case 'mouth': return this._renderMouthTab(container);
    }
  }

  // ── Eyes tab ──────────────────────────────────────────────────────────────

  _renderEyesTab(container) {
    const state = this.faceBuilder.getState();

    // Eye shape grid
    container.appendChild(this._sectionTitle('Eye Shape'));
    container.appendChild(this._featureGrid(
      EYE_LIBRARY,
      state.eyeId,
      (id) => this.faceBuilder.setEyes(id)
    ));

    // Iris colour
    container.appendChild(this._sectionTitle('Iris Colour'));
    container.appendChild(this._colorPalette(
      EYE_COLORS,
      state.irisColor,
      (hex) => this.faceBuilder.setIrisColor(hex),
      true  // show custom picker
    ));
  }

  // ── Nose tab ──────────────────────────────────────────────────────────────

  _renderNoseTab(container) {
    const state = this.faceBuilder.getState();
    container.appendChild(this._sectionTitle('Nose Shape'));
    container.appendChild(this._featureGrid(
      NOSE_LIBRARY,
      state.noseId,
      (id) => this.faceBuilder.setNose(id)
    ));
  }

  // ── Ears tab ──────────────────────────────────────────────────────────────

  _renderEarsTab(container) {
    const state = this.faceBuilder.getState();
    container.appendChild(this._sectionTitle('Ear Shape'));
    container.appendChild(this._featureGrid(
      EAR_LIBRARY,
      state.earId,
      (id) => this.faceBuilder.setEars(id)
    ));
  }

  // ── Mouth tab ─────────────────────────────────────────────────────────────

  _renderMouthTab(container) {
    const state = this.faceBuilder.getState();

    container.appendChild(this._sectionTitle('Mouth Shape'));
    container.appendChild(this._featureGrid(
      MOUTH_LIBRARY,
      state.mouthId,
      (id) => this.faceBuilder.setMouth(id)
    ));

    container.appendChild(this._sectionTitle('Lip Colour'));
    container.appendChild(this._colorPalette(
      LIP_COLORS,
      state.lipColor,
      (hex) => this.faceBuilder.setLipColor(hex),
      true
    ));
  }

  // ─── Shared widgets ───────────────────────────────────────────────────────

  _sectionTitle(text) {
    const h = document.createElement('h3');
    h.className = 'avl-control-title';
    h.textContent = text;
    return h;
  }

  /**
   * Renders a grid of feature cards.
   * @param {Array}    library      array of { id, label, category, description }
   * @param {string}   selectedId
   * @param {Function} onSelect     called with (id)
   */
  _featureGrid(library, selectedId, onSelect) {
    const grid = document.createElement('div');
    grid.className = 'avl-feature-grid';

    // Group by category
    const categories = [...new Set(library.map(f => f.category))];

    categories.forEach(cat => {
      const catItems = library.filter(f => f.category === cat);

      const catLabel = document.createElement('div');
      catLabel.className = 'avl-category-label';
      catLabel.textContent = cat.charAt(0).toUpperCase() + cat.slice(1);
      grid.appendChild(catLabel);

      const row = document.createElement('div');
      row.className = 'avl-feature-row';

      catItems.forEach(feature => {
        const card = document.createElement('button');
        card.className = 'avl-feature-card' + (feature.id === selectedId ? ' avl-feature-card--active' : '');
        card.title = feature.description;
        card.dataset.id = feature.id;

        const icon = document.createElement('span');
        icon.className = 'avl-feature-icon';
        icon.textContent = feature.thumbnail || '◉';

        const lbl = document.createElement('span');
        lbl.className = 'avl-feature-label';
        lbl.textContent = feature.label;

        card.appendChild(icon);
        card.appendChild(lbl);

        card.addEventListener('click', () => {
          grid.querySelectorAll('.avl-feature-card').forEach(c => c.classList.remove('avl-feature-card--active'));
          card.classList.add('avl-feature-card--active');
          onSelect(feature.id);
        });

        row.appendChild(card);
      });

      grid.appendChild(row);
    });

    return grid;
  }

  /**
   * Renders a colour swatch palette.
   * @param {Array}    colors       array of { id, label, hex }
   * @param {string}   selectedHex
   * @param {Function} onSelect     called with (hex)
   * @param {boolean}  showCustom
   */
  _colorPalette(colors, selectedHex, onSelect, showCustom = false) {
    const wrap = document.createElement('div');
    wrap.className = 'avl-color-palette';

    const swatchRow = document.createElement('div');
    swatchRow.className = 'avl-swatch-grid';

    colors.forEach(c => {
      const btn = document.createElement('button');
      btn.className = 'avl-swatch' + (c.hex.toLowerCase() === selectedHex?.toLowerCase() ? ' avl-swatch--active' : '');
      btn.style.backgroundColor = c.hex;
      btn.title = c.label;
      btn.dataset.hex = c.hex;
      btn.addEventListener('click', () => {
        swatchRow.querySelectorAll('.avl-swatch').forEach(s => s.classList.remove('avl-swatch--active'));
        btn.classList.add('avl-swatch--active');
        onSelect(c.hex);
      });
      swatchRow.appendChild(btn);
    });

    wrap.appendChild(swatchRow);

    if (showCustom) {
      const row = document.createElement('div');
      row.className = 'avl-custom-color-row';
      const lbl = document.createElement('label');
      lbl.textContent = 'Custom:';
      lbl.className = 'avl-label';
      const input = document.createElement('input');
      input.type = 'color';
      input.className = 'avl-color-input';
      input.value = selectedHex || '#ffffff';
      input.addEventListener('input', e => {
        swatchRow.querySelectorAll('.avl-swatch').forEach(s => s.classList.remove('avl-swatch--active'));
        onSelect(e.target.value);
      });
      row.appendChild(lbl);
      row.appendChild(input);
      wrap.appendChild(row);
    }

    return wrap;
  }

  /** Refresh the panel (e.g. after loading a saved state) */
  refresh() {
    this._render();
  }
}
