import { redirect } from "next/navigation";

export default function XrplPage() {
  // XRPL docs are admin-only; keep this route as a safe redirect.
  redirect("/admin/xrpl");
}


