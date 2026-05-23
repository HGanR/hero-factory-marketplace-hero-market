"use client";

type Props = {
  opacity: number;
  durationSec: number;
};

export function ExecutiveSignalSweep({ opacity, durationSec }: Props) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]"
      style={{ opacity }}
    >
      <div
        className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-[rgba(var(--atmo-glow-rgb),0.85)] to-transparent"
        style={{
          animation: `executive-signal-sweep ${durationSec}s linear infinite`,
          top: "-2px",
        }}
      />
      <div
        className="absolute bottom-0 left-0 top-0 w-24 bg-gradient-to-r from-[rgba(var(--atmo-glow-rgb),0.12)] to-transparent"
        style={{
          animation: `executive-parallax-sweep ${durationSec * 1.4}s ease-in-out infinite alternate`,
        }}
      />
      <style jsx>{`
        @keyframes executive-signal-sweep {
          0% {
            transform: translateY(-10%);
            opacity: 0;
          }
          8% {
            opacity: 1;
          }
          92% {
            opacity: 1;
          }
          100% {
            transform: translateY(110%);
            opacity: 0;
          }
        }
        @keyframes executive-parallax-sweep {
          from {
            transform: translateX(-8%);
            opacity: 0.35;
          }
          to {
            transform: translateX(12%);
            opacity: 0.75;
          }
        }
      `}</style>
    </div>
  );
}
