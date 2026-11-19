import { redirect } from "next/navigation";
import { AuthForm } from "@/components/AuthForm";
import { AuthShell } from "@/components/AuthShell";
import { isGoogleEnabled } from "@/lib/auth";
import { getSession } from "@/lib/session";

export const metadata = { title: "Accedi – Menu Engine" };

export default async function LoginPage() {
  if (await getSession()) redirect("/app");
  return (
    <AuthShell>
      <AuthForm mode="login" googleEnabled={isGoogleEnabled} />
    </AuthShell>
  );
}
