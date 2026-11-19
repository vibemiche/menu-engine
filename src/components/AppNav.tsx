"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { Logo } from "./Logo";

const LINKS = [
  { href: "/app", label: "Dashboard", icon: "M3 12l9-8 9 8M5 10v10h14V10" },
  { href: "/app/importa", label: "Importa da foto", icon: "M4 7h3l2-3h6l2 3h3v12H4zM12 17a4 4 0 100-8 4 4 0 000 8z" },
  { href: "/app/piatti", label: "Piatti", icon: "M4 13h16M6 13a6 6 0 0112 0M12 7V5" },
  { href: "/app/preparazioni", label: "Preparazioni", icon: "M5 10h14l-1 9H6zM8 10V6h8v4" },
  { href: "/app/ingredienti", label: "Ingredienti", icon: "M12 3c4 4 6 7 6 10a6 6 0 01-12 0c0-3 2-6 6-10z" },
  { href: "/app/analisi", label: "Audit menu", icon: "M4 20V10M10 20V4M16 20v-7M22 20H2" },
  { href: "/app/ingegneria", label: "Ingegneria avanzata", icon: "M4 19h16M7 16V9M12 16V5M17 16v-4M5 8l5-4 4 3 5-3" },
  { href: "/app/strategia", label: "Agente strategia", icon: "M12 3l2.5 5.5L20 9l-4 4 1 6-5-3-5 3 1-6-4-4 5.5-.5z" },
  { href: "/app/menu-design", label: "Nuovo menu", icon: "M6 3h12v18H6zM9 7h6M9 11h6M9 15h4" },
  { href: "/app/impostazioni", label: "Impostazioni", icon: "M12 15a3 3 0 100-6 3 3 0 000 6zM19 12l2-1-2-4-2 1-2-2V4h-4v2L9 8 7 7l-2 4 2 1v0l-2 1 2 4 2-1 2 2v2h4v-2l2-2 2 1 2-4z" },
];

export function AppNav({ userName, restaurantName }: { userName: string; restaurantName: string | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function signOut() {
    await authClient.signOut();
    router.push("/");
    router.refresh();
  }

  const isActive = (href: string) => (href === "/app" ? pathname === "/app" : pathname.startsWith(href));

  const list = (
    <nav className="flex flex-col gap-0.5">
      {LINKS.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          onClick={() => setOpen(false)}
          className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
            isActive(l.href) ? "bg-basil text-white" : "text-ink/80 hover:bg-black/5"
          }`}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d={l.icon} />
          </svg>
          {l.label}
        </Link>
      ))}
    </nav>
  );

  const footer = (
    <div className="border-t border-line pt-4 text-sm">
      <div className="truncate font-medium">{restaurantName ?? "Nessun locale"}</div>
      <div className="truncate text-xs text-muted">{userName}</div>
      <button onClick={signOut} className="mt-3 text-xs font-medium text-muted hover:text-tomato">Esci</button>
    </div>
  );

  return (
    <>
      <aside className="no-print sticky top-0 hidden h-screen w-60 shrink-0 flex-col justify-between border-r border-line bg-card p-4 lg:flex">
        <div>
          <Link href="/app" className="mb-6 block px-2"><Logo /></Link>
          {list}
        </div>
        {footer}
      </aside>

      <div className="no-print sticky top-0 z-30 flex items-center justify-between border-b border-line bg-card px-4 py-3 lg:hidden">
        <Link href="/app"><Logo /></Link>
        <button onClick={() => setOpen((o) => !o)} className="btn-ghost px-2" aria-label="Menu" aria-expanded={open}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d={open ? "M6 6l12 12M18 6L6 18" : "M4 7h16M4 12h16M4 17h16"} /></svg>
        </button>
      </div>
      {open && (
        <div className="no-print fixed inset-x-0 top-[57px] z-20 border-b border-line bg-card p-4 shadow-lg lg:hidden">
          {list}
          <div className="mt-4">{footer}</div>
        </div>
      )}
    </>
  );
}
