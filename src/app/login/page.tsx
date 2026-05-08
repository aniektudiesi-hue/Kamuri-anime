import { AppShell } from "@/components/app-shell";
import { AuthForm } from "@/components/auth-form";

export default function LoginPage() {
  return (
    <AppShell>
      <AuthForm mode="login" />
    </AppShell>
  );
}
