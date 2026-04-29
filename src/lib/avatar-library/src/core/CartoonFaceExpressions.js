/**
 * CartoonFaceExpressions.js — 10 facial expression presets
 *
 * Since Three.js morph targets require a single merged geometry with pre-baked
 * blend shapes (which would need a DCC tool), we simulate expressions by
 * repositioning and rescaling the individual face part meshes that CartoonHead
 * already created. This gives convincing cartoon expression changes at runtime.
 *
 * Expressions: neutral, happy, surprised, angry, sad, wink, smirk, scared, disgusted, laughing
 */

const EXPRESSIONS = {

  neutral: {
    // Default — no overrides
    browL:       { ry: 0 },
    browR:       { ry: 0 },
    upperLip_L:  { sy: 1.0, py: 0 },
    upperLip_R:  { sy: 1.0, py: 0 },
    lowerLip:    { sy: 1.0, py: 0 },
    lipLine:     { rx: Math.PI, py: 0 },
    eyeIris_L:   { py: 0 },
    eyeIris_R:   { py: 0 },
    eyePupil_L:  { py: 0 },
    eyePupil_R:  { py: 0 },
    upperLid_L:  { py: 0, sy: 1.0 },
    upperLid_R:  { py: 0, sy: 1.0 },
  },

  happy: {
    browL:       { ry: 0, pyDelta: +0.008 },
    browR:       { ry: 0, pyDelta: +0.008 },
    upperLip_L:  { sy: 1.0, pyDelta: -0.004 },
    upperLip_R:  { sy: 1.0, pyDelta: -0.004 },
    lowerLip:    { sy: 1.2, pyDelta: -0.006 },
    lipLine:     { rx: 0, pyDelta: -0.008 },   // smile — flip torus
    eyeIris_L:   { pyDelta: +0.004 },
    eyeIris_R:   { pyDelta: +0.004 },
    eyePupil_L:  { pyDelta: +0.004 },
    eyePupil_R:  { pyDelta: +0.004 },
    upperLid_L:  { sy: 0.85, pyDelta: -0.004 },
    upperLid_R:  { sy: 0.85, pyDelta: -0.004 },
  },

  surprised: {
    browL:       { pyDelta: +0.022 },
    browR:       { pyDelta: +0.022 },
    upperLip_L:  { sy: 0.8 },
    upperLip_R:  { sy: 0.8 },
    lowerLip:    { sy: 1.3, pyDelta: -0.014 },
    lipLine:     { rx: Math.PI, pyDelta: -0.014 },
    eyeIris_L:   { sy: 1.15 },
    eyeIris_R:   { sy: 1.15 },
    eyePupil_L:  { sy: 1.15 },
    eyePupil_R:  { sy: 1.15 },
    upperLid_L:  { sy: 1.25, pyDelta: +0.010 },
    upperLid_R:  { sy: 1.25, pyDelta: +0.010 },
  },

  angry: {
    browL:       { rz: -0.35, pyDelta: -0.010 },
    browR:       { rz:  0.35, pyDelta: -0.010 },
    upperLip_L:  { sy: 1.1 },
    upperLip_R:  { sy: 1.1 },
    lowerLip:    { sy: 0.9 },
    lipLine:     { rx: Math.PI + 0.3, pyDelta: +0.004 }, // slight frown
    eyeIris_L:   { pyDelta: -0.004 },
    eyeIris_R:   { pyDelta: -0.004 },
    eyePupil_L:  { pyDelta: -0.004 },
    eyePupil_R:  { pyDelta: -0.004 },
    upperLid_L:  { sy: 1.1, rz: -0.25, pyDelta: -0.006 },
    upperLid_R:  { sy: 1.1, rz:  0.25, pyDelta: -0.006 },
  },

  sad: {
    browL:       { rz:  0.28, pyDelta: -0.008 },
    browR:       { rz: -0.28, pyDelta: -0.008 },
    upperLip_L:  { sy: 0.9 },
    upperLip_R:  { sy: 0.9 },
    lowerLip:    { sy: 0.85, pyDelta: +0.006 },
    lipLine:     { rx: Math.PI + 0.4, pyDelta: +0.008 }, // frown
    eyeIris_L:   { pyDelta: -0.006 },
    eyeIris_R:   { pyDelta: -0.006 },
    eyePupil_L:  { pyDelta: -0.006 },
    eyePupil_R:  { pyDelta: -0.006 },
    upperLid_L:  { sy: 0.90, pyDelta: -0.008 },
    upperLid_R:  { sy: 0.90, pyDelta: -0.008 },
  },

  wink: {
    browL:       { pyDelta: +0.006 },
    browR:       { pyDelta: -0.004 },
    upperLip_L:  { sy: 1.0 },
    upperLip_R:  { sy: 1.0 },
    lowerLip:    { sy: 1.1, pyDelta: -0.004 },
    lipLine:     { rx: 0.1, pyDelta: -0.004 },
    eyeIris_L:   { pyDelta: +0.002 },
    eyeIris_R:   { sy: 0.0 },   // closed eye
    eyePupil_L:  { pyDelta: +0.002 },
    eyePupil_R:  { sy: 0.0 },
    upperLid_L:  { sy: 0.90 },
    upperLid_R:  { sy: 2.2, pyDelta: -0.018 }, // closed lid
  },

  smirk: {
    browL:       { pyDelta: +0.010 },
    browR:       { pyDelta: -0.002 },
    upperLip_L:  { sy: 1.2, pyDelta: -0.006 },
    upperLip_R:  { sy: 0.8 },
    lowerLip:    { sy: 1.0 },
    lipLine:     { rx: Math.PI - 0.3, pyDelta: -0.004 },
    eyeIris_L:   { pyDelta: +0.002 },
    eyeIris_R:   { pyDelta: +0.002 },
    eyePupil_L:  { pyDelta: +0.002 },
    eyePupil_R:  { pyDelta: +0.002 },
    upperLid_L:  { sy: 0.88 },
    upperLid_R:  { sy: 1.05 },
  },

  scared: {
    browL:       { pyDelta: +0.018, rz:  0.20 },
    browR:       { pyDelta: +0.018, rz: -0.20 },
    upperLip_L:  { sy: 0.75 },
    upperLip_R:  { sy: 0.75 },
    lowerLip:    { sy: 1.4, pyDelta: -0.018 },
    lipLine:     { rx: Math.PI, pyDelta: -0.018 },
    eyeIris_L:   { sy: 1.20 },
    eyeIris_R:   { sy: 1.20 },
    eyePupil_L:  { sy: 0.70 }, // constricted pupils
    eyePupil_R:  { sy: 0.70 },
    upperLid_L:  { sy: 1.30, pyDelta: +0.014 },
    upperLid_R:  { sy: 1.30, pyDelta: +0.014 },
  },

  disgusted: {
    browL:       { pyDelta: -0.006, rz: -0.15 },
    browR:       { pyDelta: -0.006, rz:  0.15 },
    upperLip_L:  { sy: 1.3, pyDelta: +0.006 },
    upperLip_R:  { sy: 0.7 },
    lowerLip:    { sy: 0.8, pyDelta: +0.004 },
    lipLine:     { rx: Math.PI + 0.25, pyDelta: +0.006 },
    eyeIris_L:   { pyDelta: -0.002 },
    eyeIris_R:   { pyDelta: -0.002 },
    eyePupil_L:  { pyDelta: -0.002 },
    eyePupil_R:  { pyDelta: -0.002 },
    upperLid_L:  { sy: 1.05, pyDelta: -0.004 },
    upperLid_R:  { sy: 1.05, pyDelta: -0.004 },
  },

  laughing: {
    browL:       { pyDelta: +0.016 },
    browR:       { pyDelta: +0.016 },
    upperLip_L:  { sy: 1.4, pyDelta: -0.010 },
    upperLip_R:  { sy: 1.4, pyDelta: -0.010 },
    lowerLip:    { sy: 1.6, pyDelta: -0.016 },
    lipLine:     { rx: -0.1, pyDelta: -0.016 },
    eyeIris_L:   { sy: 0.0 }, // squinted shut
    eyeIris_R:   { sy: 0.0 },
    eyePupil_L:  { sy: 0.0 },
    eyePupil_R:  { sy: 0.0 },
    upperLid_L:  { sy: 2.0, pyDelta: -0.020 },
    upperLid_R:  { sy: 2.0, pyDelta: -0.020 },
  },
};

/**
 * Apply an expression to a CartoonHead instance.
 * @param {CartoonHead} head - The CartoonHead instance
 * @param {string} expressionName - Key from EXPRESSIONS
 * @param {number} blend - 0=neutral, 1=full expression
 */
export function applyExpression(head, expressionName, blend = 1.0) {
  const expr = EXPRESSIONS[expressionName];
  if (!expr) return;

  const neutral = EXPRESSIONS.neutral;

  // Store base positions on first call
  if (!head._baseParts) {
    head._baseParts = {};
    Object.keys(neutral).forEach(key => {
      const part = head.parts[key];
      if (part) {
        head._baseParts[key] = {
          py: part.position.y,
          sy: part.scale.y,
          rx: part.rotation.x,
          rz: part.rotation.z,
        };
      }
    });
  }

  Object.keys(neutral).forEach(key => {
    const part = head.parts[key];
    if (!part) return;
    const base = head._baseParts[key];
    if (!base) return;

    const target = expr[key] || neutral[key];

    // Position Y delta
    if (target.pyDelta !== undefined) {
      part.position.y = base.py + target.pyDelta * blend;
    }

    // Scale Y
    if (target.sy !== undefined) {
      part.scale.y = 1.0 + (target.sy - 1.0) * blend;
    }

    // Rotation X
    if (target.rx !== undefined) {
      const baseRx = base.rx !== undefined ? base.rx : 0;
      part.rotation.x = baseRx + (target.rx - baseRx) * blend;
    }

    // Rotation Z
    if (target.rz !== undefined) {
      const baseRz = base.rz !== undefined ? base.rz : 0;
      part.rotation.z = baseRz + (target.rz - baseRz) * blend;
    }
  });
}

export const EXPRESSION_NAMES = Object.keys(EXPRESSIONS);
