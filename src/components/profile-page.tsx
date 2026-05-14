"use client";

import Image from "next/image";
import Link from "next/link";
import { Camera, CheckCircle2, LogOut, UserRound } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth";
import { displayProfileName, useProfilePrefs } from "@/lib/profile";
import { Button, ButtonLink } from "./button";

export function ProfilePage() {
  const { isLoggedIn, user, logout } = useAuth();
  const accountName = user?.username || user?.email || "";
  const { prefs, savePrefs } = useProfilePrefs(accountName);
  const [displayName, setDisplayName] = useState(prefs.displayName || accountName);
  const [photo, setPhoto] = useState(prefs.photo || "");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setDisplayName(prefs.displayName || accountName);
    setPhoto(prefs.photo || "");
  }, [accountName, prefs.displayName, prefs.photo]);

  if (!isLoggedIn) {
    return (
      <div className="mx-auto grid min-h-[62vh] max-w-xl place-items-center px-4 py-12">
        <div className="w-full rounded-3xl border border-white/[0.08] bg-[#0d1020]/86 p-6 text-center shadow-[0_24px_90px_rgba(0,0,0,0.36)]">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-[#e11d48]/14 text-[#f43f5e] ring-1 ring-[#e11d48]/22">
            <UserRound size={26} />
          </div>
          <h1 className="mt-5 text-2xl font-black text-white">Sign in to manage profile</h1>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-white/45">
            Your watchlist and exact watch progress stay tied to your account when the backend keeps its database.
          </p>
          <ButtonLink href="/login" className="mt-6">Sign in</ButtonLink>
        </div>
      </div>
    );
  }

  async function onPhotoChange(file?: File | null) {
    if (!file) return;
    setBusy(true);
    setMessage("");
    try {
      const dataUrl = await resizeProfilePhoto(file);
      setPhoto(dataUrl);
      savePrefs({ displayName, photo: dataUrl });
      setMessage("Profile photo saved on this device.");
    } catch {
      setMessage("Could not read that image. Try a smaller JPG or PNG.");
    } finally {
      setBusy(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = displayName.trim() || accountName;
    setDisplayName(name);
    savePrefs({ displayName: name, photo });
    setMessage("Display username saved on this device.");
  }

  const shownName = displayProfileName(accountName, prefs.displayName || displayName);
  const initial = shownName[0]?.toUpperCase() || "A";

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 lg:px-6">
      <div className="relative overflow-hidden rounded-[28px] border border-white/[0.075] bg-[#0d1020] p-6 shadow-[0_30px_100px_rgba(0,0,0,0.42)] sm:p-8">
        <div className="absolute inset-0 opacity-70">
          <Image src="/logo.svg" alt="" width={420} height={420} className="absolute -right-16 -top-24 opacity-[0.035]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_20%,rgba(225,29,72,0.16),transparent_34%)]" />
        </div>

        <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <Avatar className="h-20 w-20 border border-[#e11d48]/30 bg-[#e11d48]/18">
              {photo ? <AvatarImage src={photo} alt={shownName} /> : null}
              <AvatarFallback className="bg-[#e11d48] text-2xl font-black text-white">{initial}</AvatarFallback>
            </Avatar>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#f43f5e]">animeTv profile</p>
              <h1 className="mt-1 text-3xl font-black tracking-tight text-white">{shownName}</h1>
              <p className="mt-1 text-sm font-semibold text-white/36">Login account: {accountName}</p>
            </div>
          </div>

          <Button
            type="button"
            variant="panel"
            onClick={logout}
            className="h-11 rounded-xl border-white/[0.08] text-white/70 hover:text-white"
          >
            <LogOut size={16} />
            Logout
          </Button>
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_0.86fr]">
        <form onSubmit={submit} className="rounded-2xl border border-white/[0.075] bg-[#0d1020]/82 p-5">
          <h2 className="text-lg font-black text-white">Display username</h2>
          <p className="mt-1 text-sm leading-6 text-white/42">
            This is a local display name for this device. It does not change your real login username on the API.
          </p>
          <label className="mt-5 grid gap-2 text-sm font-bold text-white/76">
            Name shown in the UI
            <Input
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              className="h-12 rounded-xl border-white/[0.09] bg-[#141828] px-4 text-white"
            />
          </label>
          <Button disabled={busy} className="mt-5 h-11 rounded-xl">
            Save profile
          </Button>
        </form>

        <div className="rounded-2xl border border-white/[0.075] bg-[#0d1020]/82 p-5">
          <h2 className="text-lg font-black text-white">Profile photo</h2>
          <p className="mt-1 text-sm leading-6 text-white/42">
            Pick a small image for your header/avatar. It is compressed and saved locally on this device.
          </p>
          <label className="mt-5 flex h-28 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-white/[0.13] bg-[#141828] text-center text-sm font-bold text-white/58 transition hover:border-[#e11d48]/45 hover:text-white">
            <Camera size={22} className="mb-2 text-[#f43f5e]" />
            Choose photo
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="sr-only"
              onChange={(event) => onPhotoChange(event.target.files?.[0])}
            />
          </label>
          {photo ? (
            <button
              type="button"
              onClick={() => {
                setPhoto("");
                savePrefs({ displayName, photo: "" });
                setMessage("Profile photo removed.");
              }}
              className="mt-3 text-xs font-black text-white/42 transition hover:text-white"
            >
              Remove photo
            </button>
          ) : null}
        </div>
      </div>

      {message ? (
        <div className="mt-5 flex items-center gap-2 rounded-2xl border border-emerald-400/18 bg-emerald-500/10 px-4 py-3 text-sm font-bold text-emerald-100">
          <CheckCircle2 size={16} />
          {message}
        </div>
      ) : null}

      <div className="mt-5 rounded-2xl border border-white/[0.06] bg-[#0d1020]/62 p-4 text-sm leading-6 text-white/40">
        For production persistence after deploy, keep the FastAPI database on persistent storage or an external DB. Browser profile photo is local; history and watchlist remain server account data.
        <Link href="/history" className="ml-2 font-black text-[#f43f5e]">Open history</Link>
      </div>
    </div>
  );
}

function resizeProfilePhoto(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("read failed"));
    reader.onload = () => {
      const img = new window.Image();
      img.onerror = () => reject(new Error("decode failed"));
      img.onload = () => {
        const size = 256;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("canvas failed"));
          return;
        }
        const scale = Math.max(size / img.width, size / img.height);
        const width = img.width * scale;
        const height = img.height * scale;
        ctx.drawImage(img, (size - width) / 2, (size - height) / 2, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      img.src = String(reader.result || "");
    };
    reader.readAsDataURL(file);
  });
}
