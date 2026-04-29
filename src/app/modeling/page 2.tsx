/**
 * Modeling route — delegates to Home.tsx (landing page).
 * Mirrors office-building-3d: Route "/" → Home → WorldViewer.
 * Here: Route "/modeling" → page.tsx → Home → TrooWorldEditor.
 */
import Home from "./Home";

export default function ModelingPage() {
  return <Home />;
}
