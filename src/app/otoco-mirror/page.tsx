import { redirect } from "next/navigation";

export default function LiftOffRedirectPage() {
  // Backwards-compatible route; Star Fleet is the current branding.
  redirect("/lift-off");
}
