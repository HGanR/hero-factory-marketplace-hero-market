"use client";

import { useEffect, useRef } from "react";

const CYAN = "rgba(0, 209, 255, 0.5)";
const VIOLET = "rgba(139, 92, 246, 0.4)";
const PARTICLE_COUNT = 80;

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  phase: number;
};

export function DashboardParticleBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: 0.5, y: 0.5 });
  const particlesRef = useRef<Particle[]>([]);
  const rafRef = useRef<number>(0);
  /** Skip heavy canvas work while tab is hidden — reduces main-thread contention with React/UI. */
  const pageHiddenRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const syncVisibility = () => {
      pageHiddenRef.current = typeof document !== "undefined" && document.visibilityState === "hidden";
    };
    syncVisibility();
    document.addEventListener("visibilitychange", syncVisibility);

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      if (particlesRef.current.length === 0) {
        particlesRef.current = Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          vx: (Math.random() - 0.5) * 0.4,
          vy: (Math.random() - 0.5) * 0.4,
          size: 1 + Math.random() * 1.5,
          color: i % 3 === 0 ? VIOLET : CYAN,
          phase: Math.random() * Math.PI * 2,
        }));
      }
    };

    resize();
    window.addEventListener("resize", resize);

    const onMouseMove = (e: MouseEvent) => {
      mouseRef.current.x = e.clientX / window.innerWidth;
      mouseRef.current.y = e.clientY / window.innerHeight;
    };
    window.addEventListener("mousemove", onMouseMove);

    const t0 = Date.now();
    const animate = () => {
      if (pageHiddenRef.current) {
        rafRef.current = requestAnimationFrame(animate);
        return;
      }

      const w = canvas.width;
      const h = canvas.height;
      const mx = mouseRef.current.x * w;
      const my = mouseRef.current.y * h;
      const time = (Date.now() - t0) * 0.001;

      ctx.clearRect(0, 0, w, h);

      for (const p of particlesRef.current) {
        const dx = mx - p.x;
        const dy = my - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const influence = Math.max(0, 1 - dist / 320);
        const pull = 0.008 * influence;
        p.vx += (dx / dist) * pull + Math.sin(time + p.phase) * 0.002;
        p.vy += (dy / dist) * pull + Math.cos(time + p.phase * 0.7) * 0.002;
        p.vx *= 0.99;
        p.vy *= 0.99;
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0 || p.x > w) p.vx *= -0.5;
        if (p.y < 0 || p.y > h) p.vy *= -0.5;
        p.x = Math.max(0, Math.min(w, p.x));
        p.y = Math.max(0, Math.min(h, p.y));

        const pulse = 0.6 + 0.4 * Math.sin(time * 2 + p.phase);
        const alpha = (0.15 + influence * 0.25) * pulse;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.color.replace(/[\d.]+\)$/, `${alpha})`);
        ctx.fill();

        ctx.shadowColor = p.color;
        ctx.shadowBlur = 4 + influence * 6;
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      rafRef.current = requestAnimationFrame(animate);
    };

    animate();
    return () => {
      document.removeEventListener("visibilitychange", syncVisibility);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMouseMove);
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
