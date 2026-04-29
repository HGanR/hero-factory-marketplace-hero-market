"use client";

import { useEffect, useRef } from "react";

const ELECTRIC_BLUE = "rgba(0, 209, 255, 0.5)";
const PARTICLE_COUNT = 80;

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  phase: number;
};

export function LandingParticleBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const rafRef = useRef<number>(0);
  const timeRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      if (particlesRef.current.length === 0) {
        particlesRef.current = Array.from({ length: PARTICLE_COUNT }, () => ({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          vx: (Math.random() - 0.5) * 0.6,
          vy: (Math.random() - 0.5) * 0.6,
          size: 1 + Math.random() * 2,
          phase: Math.random() * Math.PI * 2,
        }));
      }
    };

    resize();
    window.addEventListener("resize", resize);

    const animate = () => {
      timeRef.current += 0.016;
      const t = timeRef.current;
      const w = canvas.width;
      const h = canvas.height;

      ctx.clearRect(0, 0, w, h);

      for (const p of particlesRef.current) {
        p.vx += Math.sin(t + p.phase) * 0.002;
        p.vy += Math.cos(t * 0.7 + p.phase) * 0.002;
        p.vx *= 0.998;
        p.vy *= 0.998;
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0 || p.x > w) p.vx *= -0.8;
        if (p.y < 0 || p.y > h) p.vy *= -0.8;
        p.x = Math.max(0, Math.min(w, p.x));
        p.y = Math.max(0, Math.min(h, p.y));

        const pulse = 0.3 + Math.sin(t + p.phase) * 0.15;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = ELECTRIC_BLUE.replace("0.5", String(pulse));
        ctx.fill();
        ctx.shadowColor = ELECTRIC_BLUE;
        ctx.shadowBlur = 4;
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
      className="absolute inset-0 pointer-events-none"
      aria-hidden
    />
  );
}
