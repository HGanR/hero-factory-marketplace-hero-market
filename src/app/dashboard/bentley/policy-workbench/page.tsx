import { BentleyPolicyWorkbenchClient } from "@/components/revenue-os/bentley-command-center/BentleyPolicyWorkbenchClient";

export const metadata = {
  title: "Bentley Policy Workbench",
  description: "Dry-run policy simulations, save scenarios, and compare outcomes before applying changes.",
};

export default function BentleyPolicyWorkbenchPage() {
  return <BentleyPolicyWorkbenchClient />;
}
