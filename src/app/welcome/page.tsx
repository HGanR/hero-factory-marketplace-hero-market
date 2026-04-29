// src/app/welcome/page.tsx - Redirect to home (Register/Login moved to /)
import { redirect } from "next/navigation";

export default function WelcomePage() {
  redirect("/");
}
