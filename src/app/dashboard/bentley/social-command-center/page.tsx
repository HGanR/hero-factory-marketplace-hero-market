import { BentleySocialCommandCenterClient } from "@/components/revenue-os/bentley-command-center/BentleySocialCommandCenterClient";

export const metadata = {
  title: "Bentley Social Command Center",
  description:
    "Planner, intelligence, lead inbox, approvals, reports, and connector execution — Bentley-native social operations.",
};

export default function BentleySocialCommandCenterPage() {
  return <BentleySocialCommandCenterClient />;
}
