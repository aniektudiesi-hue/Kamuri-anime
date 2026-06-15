"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "atv-register-dismissed";

export function RegisterPopup() {
  const [open, setOpen] = useState(false);
  const [platform, setPlatform] = useState("");
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(STORAGE_KEY)) return;
    const timer = setTimeout(() => setOpen(true), 3000);
    return () => clearTimeout(timer);
  }, []);

  function dismiss() {
    setOpen(false);
    localStorage.setItem(STORAGE_KEY, Date.now().toString());
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !platform) return;
    setLoading(true);
    try {
      await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, platform, errors }),
      });
      setSubmitted(true);
      setTimeout(dismiss, 2000);
    } catch {
      setSubmitted(true);
      setTimeout(dismiss, 2000);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) dismiss(); }}>
      <DialogContent className="!max-w-md !bg-[#0a0a0f] !border !border-white/10 !ring-0">
        <DialogHeader>
          <DialogTitle className="text-lg text-white">
            Register for Early Access
          </DialogTitle>
          <DialogDescription className="text-zinc-400">
            Get notified when our Android, Windows & macOS apps launch.
          </DialogDescription>
        </DialogHeader>

        {submitted ? (
          <div className="py-6 text-center">
            <p className="text-green-400 text-sm font-medium">Thanks for registering!</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3 mt-1">
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Platform</label>
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
                required
                className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-white outline-none focus:border-white/25 appearance-none"
              >
                <option value="" disabled>Select your platform</option>
                <option value="android">Android</option>
                <option value="windows">Windows</option>
                <option value="macos">macOS</option>
                <option value="ios">iOS</option>
              </select>
            </div>

            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 outline-none focus:border-white/25"
              />
            </div>

            <div>
              <label className="text-xs text-zinc-400 mb-1 block">
                Any errors you're seeing? <span className="text-zinc-600">(optional)</span>
              </label>
              <textarea
                value={errors}
                onChange={(e) => setErrors(e.target.value)}
                placeholder="Describe any issues..."
                rows={2}
                className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 outline-none focus:border-white/25 resize-none"
              />
            </div>

            <Button
              type="submit"
              disabled={loading || !email || !platform}
              className="w-full mt-1 bg-white text-black hover:bg-white/90 disabled:opacity-40 font-medium"
            >
              {loading ? "Submitting..." : "Register"}
            </Button>

            <button
              type="button"
              onClick={dismiss}
              className="text-xs text-zinc-500 hover:text-zinc-400 text-center py-1"
            >
              Maybe later
            </button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
