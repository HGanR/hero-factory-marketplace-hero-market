/**
 * Modeling layout — full-viewport container matching office-building-3d Home.tsx.
 * Ensures the 3D world fills the screen with no chrome; admin panel overlays when Edit Mode is on.
 */
export default function ModelingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
        background: "#0a1020",
      }}
    >
      {children}
    </div>
  );
}
