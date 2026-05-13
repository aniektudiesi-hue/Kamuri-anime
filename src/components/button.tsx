import Link from "next/link";
import { cn } from "@/lib/utils";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "panel";
};

export function Button({ className, variant = "primary", ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex h-10 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-50",
        variant === "primary" && "bg-[#cf2442] text-white shadow-lg shadow-[#cf2442]/18 hover:bg-[#dc2d4b]",
        variant === "ghost" && "text-foreground hover:bg-white/10",
        variant === "panel" && "border border-white/[0.075] bg-panel-strong text-foreground hover:bg-[#222637]",
        className,
      )}
      {...props}
    />
  );
}

export function ButtonLink({
  className,
  variant = "primary",
  ...props
}: React.ComponentProps<typeof Link> & { variant?: "primary" | "ghost" | "panel" }) {
  return (
    <Link
      className={cn(
        "inline-flex h-10 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-black transition",
        variant === "primary" && "bg-[#cf2442] text-white shadow-lg shadow-[#cf2442]/18 hover:bg-[#dc2d4b]",
        variant === "ghost" && "text-foreground hover:bg-white/10",
        variant === "panel" && "border border-white/[0.075] bg-panel-strong text-foreground hover:bg-[#222637]",
        className,
      )}
      {...props}
    />
  );
}
