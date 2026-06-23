"use client";

import { useState } from "react";
import { CheckCircle2, LifeBuoy, Send } from "lucide-react";
import { AppShell } from "@/components/app-shell";

const REGIONS = [
  "India",
  "United States",
  "United Kingdom",
  "Canada",
  "Australia",
  "Germany",
  "France",
  "Brazil",
  "Japan",
  "Philippines",
  "Indonesia",
  "Pakistan",
  "Bangladesh",
  "Nigeria",
  "Other",
];

const ISSUE_TYPES = [
  "Playback / buffering issue",
  "Download not working",
  "Login / account problem",
  "Missing or wrong anime",
  "Subtitles problem",
  "App crash / bug",
  "Feature request",
  "Other",
];

export default function HelpSupportPage() {
  const [region, setRegion] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [issueType, setIssueType] = useState("");
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const valid = region && name.trim() && /\S+@\S+\.\S+/.test(email) && issueType && message.trim();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid || sending) return;
    setSending(true);
    setError("");
    try {
      const response = await fetch("/api/help", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ region, name, email, issueType, message }),
      });
      if (!response.ok) throw new Error("Request failed");
      setSent(true);
    } catch {
      setError("Could not send right now. Please try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl px-4 py-8 sm:py-12 lg:px-8">
        <div className="mb-6 flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl border border-white/[0.08] bg-[#c4182a]/15">
            <LifeBuoy size={22} className="text-[#c4182a]" />
          </span>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-white sm:text-3xl">Help &amp; Support</h1>
            <p className="text-sm text-white/55">Tell us what&apos;s wrong and we&apos;ll help you out.</p>
          </div>
        </div>

        {sent ? (
          <div className="flex flex-col items-center gap-4 rounded-3xl border border-white/[0.055] bg-[#0d1020] px-6 py-12 text-center">
            <CheckCircle2 size={56} className="text-[#4ade80]" />
            <h2 className="text-xl font-black text-white">Thanks, {name.split(" ")[0] || "there"}!</h2>
            <p className="max-w-sm text-sm text-white/60">
              Your request has been received. Our team will get back to you at{" "}
              <span className="font-semibold text-white/80">{email}</span>.
            </p>
            <button
              type="button"
              onClick={() => {
                setSent(false);
                setMessage("");
                setIssueType("");
                setError("");
              }}
              className="mt-2 rounded-xl border border-white/[0.09] bg-white/[0.055] px-4 py-2 text-xs font-bold text-white/78 transition hover:bg-white/[0.1]"
            >
              Submit another
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-5 rounded-3xl border border-white/[0.055] bg-[#0d1020] p-5 sm:p-7">
            <Field label="Region">
              <select
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                className="w-full rounded-xl border border-white/[0.09] bg-[#141828] px-3.5 py-3 text-sm text-white outline-none transition focus:border-[#c4182a]/50"
              >
                <option value="" disabled>
                  Select your region
                </option>
                {REGIONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Name">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                className="w-full rounded-xl border border-white/[0.09] bg-[#141828] px-3.5 py-3 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-[#c4182a]/50"
              />
            </Field>

            <Field label="Email">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-xl border border-white/[0.09] bg-[#141828] px-3.5 py-3 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-[#c4182a]/50"
              />
            </Field>

            <Field label="Issue">
              <select
                value={issueType}
                onChange={(e) => setIssueType(e.target.value)}
                className="w-full rounded-xl border border-white/[0.09] bg-[#141828] px-3.5 py-3 text-sm text-white outline-none transition focus:border-[#c4182a]/50"
              >
                <option value="" disabled>
                  What do you need help with?
                </option>
                {ISSUE_TYPES.map((i) => (
                  <option key={i} value={i}>
                    {i}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Details">
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={5}
                placeholder="Describe the problem..."
                className="w-full resize-none rounded-xl border border-white/[0.09] bg-[#141828] px-3.5 py-3 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-[#c4182a]/50"
              />
            </Field>

            {error ? (
              <p className="rounded-xl border border-red-400/20 bg-red-500/10 px-3.5 py-3 text-xs font-bold text-red-200">{error}</p>
            ) : null}

            <button
              type="submit"
              disabled={!valid || sending}
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#c4182a] text-sm font-extrabold uppercase tracking-wide text-white transition hover:bg-[#d8273a] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Send size={16} />
              {sending ? "Sending..." : "Send request"}
            </button>
          </form>
        )}
      </div>
    </AppShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-widest text-white/40">{label}</span>
      {children}
    </label>
  );
}
