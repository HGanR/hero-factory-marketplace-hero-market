"use client";

import { useEffect, useRef } from "react";

const GOLD_LIGHT = "rgba(245, 197, 24, 0.9)"; // #F5C518
const GOLD = "rgba(212, 175, 55, 0.85)"; // #D4AF37
const GOLD_DARK = "rgba(184, 134, 11, 0.8)"; // #B8860B
const PARTICLE_COUNT = 90;

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  baseSize: number;
  phase: number;
  hueOffset: number; // 0 = light, 1 = mid, 2 = dark
};

export function GoldParticleBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const rafRef = useRef<number>(0);
  const timeRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const goldColors = [GOLD_LIGHT, GOLD, GOLD_DARK];

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      if (particlesRef.current.length === 0) {
        particlesRef.current = Array.from({ length: PARTICLE_COUNT }, () => ({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          vx: (Math.random() - 0.5) * 0.5,
          vy: (Math.random() - 0.5) * 0.5,
          size: 1.5 + Math.random() * 3,
          baseSize: 1.5 + Math.random() * 3,
          phase: Math.random() * Math.PI * 2,
          hueOffset: Math.floor(Math.random() * 3),
        }));
      }
    };

    resize();
    window.addEventListener("resize", resize);

    const animate = () => {
      const t = timeRef.current;
      timeRef.current += 0.016;
      const w = canvas.width;
      const h = canvas.height;

      ctx.clearRect(0, 0, w, h);

      for (const p of particlesRef.current) {
        // Gentle drift with subtle wave motion
        p.vx += Math.sin(t * 0.8 + p.phase) * 0.003;
        p.vy += Math.cos(t * 0.6 + p.phase * 1.2) * 0.003;
        p.vx *= 0.995;
        p.vy *= 0.995;
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0 || p.x > w) p.vx *= -0.7;
        if (p.y < 0 || p.y > h) p.vy *= -0.7;
        p.x = Math.max(0, Math.min(w, p.x));
        p.y = Math.max(0, Math.min(h, p.y));

        // Glitter: pulse opacity and size over time
        const glitter = 0.25 + Math.sin(t * 2.5 + p.phase) * 0.15 + Math.sin(t * 1.3 + p.phase * 2) * 0.1;
        const alpha = Math.max(0.15, Math.min(0.95, glitter));
        const sizeMult = 0.8 + Math.sin(t + p.phase * 3) * 0.3;
        const r = p.baseSize * sizeMult;

        const color = goldColors[p.hueOffset];
        const fillColor = color.replace(/[\d.]+\)$/, `${alpha})`);

        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fillStyle = fillColor;
        ctx.fill();

        // Glow / sparkle
        ctx.shadowColor = GOLD_LIGHT;
        ctx.shadowBlur = 4 + Math.sin(t * 3 + p.phase) * 3;
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      rafRef.current = requestAnimationFrame(animate);
    };

    animate();
    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0"
      aria-hidden
    />
  );
}
