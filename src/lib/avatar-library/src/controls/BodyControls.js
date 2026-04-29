/**
 * BodyControls.js
 * Provides:
 *  - Body shape chooser (slim / average / athletic / heavy)
 *  - Muscle tone slider (0 → 1)
 *  - Height slider (1.4m → 2.2m)
 *  - Gender blend selector (neutral / masculine / feminine)
 */

export const BODY_SHAPES = [
  { id: 'slim',     label: 'Slim',     icon: '🧍', description: 'Lean and slender build' },
  { id: 'average',  label: 'Average',  icon: '🚶', description: 'Standard proportions' },
  { id: 'athletic', label: 'Athletic', icon: '🏃', description: 'Toned, sporty physique' },
  { id: 'heavy',    label: 'Heavy',    icon: '🏋️', description: 'Broader, heavier build' },
];

export const GENDER_OPTIONS = [
  { id: 'neutral',   label: 'Neutral'   },
  { id: 'masculine', label: 'Masculine' },
  { id: 'feminine',  label: 'Feminine'  },
];

export class BodyControls {
  /**
   * @param {HTMLElement} container
   * @param {AvatarEngine} engine
   */
  constructor(container, engine) {
    this.container = container;
    this.engine = engine;
    this._state = {
      bodyShape: 'average',
      muscleTone: 0.5,
      height: 1.75,
      gender: 'neutral',
    };
    this._render();
  }

  _render() {
    this.container.innerHTML = '';

    // ── Body Shape ──────────────────────────────────────────────────────────
    const shapeSection = this._section('Body Shape');
    const shapeGrid = document.createElement('div');
    shapeGrid.className = 'avl-shape-grid';

    BODY_SHAPES.forEach(shape => {
      const btn = document.createElement('button');
      btn.className = 'avl-shape-btn';
      btn.dataset.shape = shape.id;
      btn.title = shape.description;
      if (shape.id === this._state.bodyShape) btn.classList.add('avl-shape-btn--active');

      btn.innerHTML = `<span class="avl-shape-icon">${shape.icon}</span><span class="avl-shape-label">${shape.label}</span>`;
      btn.addEventListener('click', () => {
        shapeGrid.querySelectorAll('.avl-shape-btn').forEach(b => b.classList.remove('avl-shape-btn--active'));
        btn.classList.add('avl-shape-btn--active');
        this._state.bodyShape = shape.id;
        this.engine.setBodyShape(shape.id);
      });

      shapeGrid.appendChild(btn);
    });

    shapeSection.appendChild(shapeGrid);
    this.container.appendChild(shapeSection);

    // ── Gender Blend ────────────────────────────────────────────────────────
    const genderSection = this._section('Gender Blend');
    const genderRow = document.createElement('div');
    genderRow.className = 'avl-gender-row';

    GENDER_OPTIONS.forEach(opt => {
      const btn = document.createElement('button');
      btn.className = 'avl-gender-btn';
      btn.textContent = opt.label;
      if (opt.id === this._state.gender) btn.classList.add('avl-gender-btn--active');
      btn.addEventListener('click', () => {
        genderRow.querySelectorAll('.avl-gender-btn').forEach(b => b.classList.remove('avl-gender-btn--active'));
        btn.classList.add('avl-gender-btn--active');
        this._state.gender = opt.id;
        this.engine.setGender(opt.id);
      });
      genderRow.appendChild(btn);
    });

    genderSection.appendChild(genderRow);
    this.container.appendChild(genderSection);

    // ── Muscle Tone ─────────────────────────────────────────────────────────
    const muscleSection = this._section('Muscle Tone');
    muscleSection.appendChild(this._slider({
      id: 'muscle-tone',
      min: 0, max: 1, step: 0.01,
      value: this._state.muscleTone,
      leftLabel: 'Soft',
      rightLabel: 'Ripped',
      onChange: (v) => {
        this._state.muscleTone = v;
        this.engine.setMuscleTone(v);
      },
    }));
    this.container.appendChild(muscleSection);

    // ── Height ──────────────────────────────────────────────────────────────
    const heightSection = this._section('Height');
    heightSection.appendChild(this._slider({
      id: 'height',
      min: 1.4, max: 2.2, step: 0.01,
      value: this._state.height,
      leftLabel: "4'7\"",
      rightLabel: "7'3\"",
      format: v => `${v.toFixed(2)} m`,
      onChange: (v) => {
        this._state.height = v;
        this.engine.setHeight(v);
      },
    }));
    this.container.appendChild(heightSection);
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  _section(title) {
    const sec = document.createElement('div');
    sec.className = 'avl-control-section';
    const h = document.createElement('h3');
    h.className = 'avl-control-title';
    h.textContent = title;
    sec.appendChild(h);
    return sec;
  }

  _slider({ id, min, max, step, value, leftLabel, rightLabel, format, onChange }) {
    const wrap = document.createElement('div');
    wrap.className = 'avl-slider-wrap';

    const row = document.createElement('div');
    row.className = 'avl-slider-row';

    const leftLbl = document.createElement('span');
    leftLbl.className = 'avl-slider-label avl-slider-label--left';
    leftLbl.textContent = leftLabel;

    const input = document.createElement('input');
    input.type = 'range';
    input.id = id;
    input.className = 'avl-slider';
    input.min = min;
    input.max = max;
    input.step = step;
    input.value = value;

    const rightLbl = document.createElement('span');
    rightLbl.className = 'avl-slider-label avl-slider-label--right';
    rightLbl.textContent = rightLabel;

    row.appendChild(leftLbl);
    row.appendChild(input);
    row.appendChild(rightLbl);

    const valueLbl = document.createElement('div');
    valueLbl.className = 'avl-slider-value';
    valueLbl.textContent = format ? format(value) : Math.round(value * 100) + '%';

    input.addEventListener('input', (e) => {
      const v = parseFloat(e.target.value);
      valueLbl.textContent = format ? format(v) : Math.round(v * 100) + '%';
      onChange(v);
    });

    wrap.appendChild(row);
    wrap.appendChild(valueLbl);
    return wrap;
  }

  /** Restore state from saved avatar config */
  loadState(state) {
    this._state = {
      bodyShape: state.bodyShape || 'average',
      muscleTone: state.muscleTone ?? 0.5,
      height: state.height || 1.75,
      gender: state.gender || 'neutral',
    };
    this._render();
  }

  getState() {
    return { ...this._state };
  }
}
