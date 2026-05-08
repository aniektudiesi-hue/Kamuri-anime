import { AppShell } from "@/components/app-shell";
import { AuthForm } from "@/components/auth-form";

export default function RegisterPage() {
  return (
    <AppShell>
      <AuthForm mode="register" />
    </AppShell>
  );
}
