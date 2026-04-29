/**
 * SkinTonePicker.js
 * Renders a skin tone palette with a full spectrum of human skin tones
 * and an optional custom colour picker.
 *
 * Usage:
 *   const picker = new SkinTonePicker(containerEl, engine);
 */

export const SKIN_TONES = [
  // Fitzpatrick Type I – Very Fair
  { id: 'ft1-a', label: 'Porcelain',    hex: '#FDDBB4' },
  { id: 'ft1-b', label: 'Ivory',        hex: '#F5CBA7' },
  // Fitzpatrick Type II – Fair
  { id: 'ft2-a', label: 'Cream',        hex: '#F0C27F' },
  { id: 'ft2-b', label: 'Peach',        hex: '#E8B88A' },
  // Fitzpatrick Type III – Medium
  { id: 'ft3-a', label: 'Sand',         hex: '#D4956A' },
  { id: 'ft3-b', label: 'Beige',        hex: '#C68642' },
  // Fitzpatrick Type IV – Olive
  { id: 'ft4-a', label: 'Caramel',      hex: '#B5713A' },
  { id: 'ft4-b', label: 'Tawny',        hex: '#A0522D' },
  // Fitzpatrick Type V – Brown
  { id: 'ft5-a', label: 'Chestnut',     hex: '#8B4513' },
  { id: 'ft5-b', label: 'Sienna',       hex: '#7B3F00' },
  // Fitzpatrick Type VI – Deep
  { id: 'ft6-a', label: 'Espresso',     hex: '#5C3317' },
  { id: 'ft6-b', label: 'Ebony',        hex: '#3B1F0A' },
  // Fantasy / special
  { id: 'fx-a',  label: 'Ash',          hex: '#C0C0C0' },
  { id: 'fx-b',  label: 'Jade',         hex: '#4CAF7D' },
  { id: 'fx-c',  label: 'Sapphire',     hex: '#4A90D9' },
  { id: 'fx-d',  label: 'Amethyst',     hex: '#9B59B6' },
];

export class SkinTonePicker {
  /**
   * @param {HTMLElement} container
   * @param {AvatarEngine} engine
   * @param {object} options
   */
  constructor(container, engine, options = {}) {
    this.container = container;
    this.engine = engine;
    this.options = Object.assign({ showCustom: true, columns: 4 }, options);
    this._selected = SKIN_TONES[5].hex;
    this._render();
  }

  _render() {
    this.container.innerHTML = '';

    const wrapper = document.createElement('div');
    wrapper.className = 'avl-skin-picker';

    // Title
    const title = document.createElement('h3');
    title.className = 'avl-control-title';
    title.textContent = 'Skin Tone';
    wrapper.appendChild(title);

    // Swatch grid
    const grid = document.createElement('div');
    grid.className = 'avl-swatch-grid';
    grid.style.gridTemplateColumns = `repeat(${this.options.columns}, 1fr)`;

    SKIN_TONES.forEach(tone => {
      const swatch = document.createElement('button');
      swatch.className = 'avl-swatch';
      swatch.style.backgroundColor = tone.hex;
      swatch.title = tone.label;
      swatch.setAttribute('aria-label', tone.label);
      swatch.dataset.hex = tone.hex;

      if (tone.hex === this._selected) swatch.classList.add('avl-swatch--active');

      swatch.addEventListener('click', () => {
        this._selectTone(tone.hex);
        grid.querySelectorAll('.avl-swatch').forEach(s => s.classList.remove('avl-swatch--active'));
        swatch.classList.add('avl-swatch--active');
      });

      grid.appendChild(swatch);
    });

    wrapper.appendChild(grid);

    // Custom colour input
    if (this.options.showCustom) {
      const customRow = document.createElement('div');
      customRow.className = 'avl-custom-color-row';

      const label = document.createElement('label');
      label.textContent = 'Custom:';
      label.className = 'avl-label';

      const input = document.createElement('input');
      input.type = 'color';
      input.className = 'avl-color-input';
      input.value = this._selected;
      input.addEventListener('input', (e) => {
        this._selectTone(e.target.value);
        grid.querySelectorAll('.avl-swatch').forEach(s => s.classList.remove('avl-swatch--active'));
      });

      customRow.appendChild(label);
      customRow.appendChild(input);
      wrapper.appendChild(customRow);
      this._customInput = input;
    }

    this.container.appendChild(wrapper);
  }

  _selectTone(hex) {
    this._selected = hex;
    if (this._customInput) this._customInput.value = hex;
    this.engine.setSkinTone(hex);
  }

  /** Programmatically set the selected tone */
  setValue(hex) {
    this._selected = hex;
    this._render();
  }

  getValue() {
    return this._selected;
  }
}
