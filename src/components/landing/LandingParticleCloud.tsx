"use client";

import { useEffect, useRef } from "react";

const ELECTRIC_BLUE = "rgba(0, 209, 255, 0.95)";
const PARTICLE_COUNT = 380;

type Particle = {
  x: number;
  y: number;
  angle: number;
  radius: number;
  baseRadius: number;
  speed: number;
  size: number;
  phase: number;
  drift: number;
};

export function LandingParticleCloud() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: 0.5, y: 0.5 });
  const particlesRef = useRef<Particle[]>([]);
  const rafRef = useRef<number>(0);
  const timeRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const initParticles = () => {
      const w = canvas.width;
      const h = canvas.height;
      const cx = w * 0.55;
      const cy = h * 0.5;

      particlesRef.current = Array.from({ length: PARTICLE_COUNT }, (_, i) => {
        const r = 20 + Math.pow(Math.random(), 1.8) * Math.min(w, h) * 0.45;
        const a = Math.random() * Math.PI * 2;
        return {
          x: cx + Math.cos(a) * r * 0.3,
          y: cy + Math.sin(a) * r * 0.3,
          angle: a,
          radius: r * (0.3 + Math.random() * 0.7),
          baseRadius: r * (0.3 + Math.random() * 0.7),
          speed: 0.008 + Math.random() * 0.015,
          size: 1.2 + Math.random() * 2.8,
          phase: Math.random() * Math.PI * 2,
          drift: (Math.random() - 0.5) * 0.02,
        };
      });
    };

    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = canvas.offsetWidth * dpr;
      canvas.height = canvas.offsetHeight * dpr;
      ctx.scale(dpr, dpr);
      initParticles();
    };

    resize();
    window.addEventListener("resize", resize);

    const onMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current.x = (e.clientX - rect.left) / rect.width;
      mouseRef.current.y = (e.clientY - rect.top) / rect.height;
    };
    canvas.parentElement?.addEventListener("mousemove", onMouseMove);

    const animate = () => {
      timeRef.current += 0.016;
      const t = timeRef.current;
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;
      const cx = w * 0.55;
      const cy = h * 0.5;
      const mx = mouseRef.current.x * w;
      const my = mouseRef.current.y * h;

      ctx.clearRect(0, 0, w, h);

      for (const p of particlesRef.current) {
        p.angle += p.speed + Math.sin(t + p.phase) * 0.003;
        p.radius = p.baseRadius + Math.sin(t * 0.7 + p.phase * 2) * 8;
        p.drift += (Math.random() - 0.5) * 0.01;
        p.drift *= 0.98;

        const sway = Math.sin(t * 0.5 + p.phase) * 12;
        let x = cx + Math.cos(p.angle) * (p.radius + sway);
        let y = cy + Math.sin(p.angle) * (p.radius * 0.85 + sway);

        const dx = mx - x;
        const dy = my - y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const influence = Math.max(0, 1 - dist / 150) * 0.4;
        x += (dx / dist) * influence * 3 + p.drift;
        y += (dy / dist) * influence * 3 + p.drift * 0.7;

        p.x = x;
        p.y = y;

        const depth = 1 - p.radius / (Math.min(w, h) * 0.5);
        const alpha = 0.25 + depth * 0.6 + Math.sin(t + p.phase) * 0.08;
        const glow = 2 + depth * 6;

        ctx.beginPath();
        ctx.arc(x, y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = ELECTRIC_BLUE.replace("0.95", String(Math.min(1, alpha)));
        ctx.fill();
        ctx.shadowColor = ELECTRIC_BLUE;
        ctx.shadowBlur = glow;
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      rafRef.current = requestAnimationFrame(animate);
    };

    animate();
    return () => {
      window.removeEventListener("resize", resize);
      canvas.parentElement?.removeEventListener("mousemove", onMouseMove);
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full"
      style={{ width: "100%", height: "100%" }}
      aria-hidden
    />
  );
}
