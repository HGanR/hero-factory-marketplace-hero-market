import { redirect } from "next/navigation";

/** Primary accounting UX lives at `/accounting/reporting` (tabs + ELEANOR). */
export default function AccountingPage() {
  redirect("/accounting/reporting");
}
