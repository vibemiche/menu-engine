import Link from "next/link";
import { Logo } from "./Logo";

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="flex flex-col px-4 py-6 sm:px-10">
        <Link href="/"><Logo /></Link>
        <div className="flex flex-1 items-center justify-center py-10">{children}</div>
      </div>
      <div className="hidden flex-col justify-end bg-basil p-12 text-white lg:flex">
        <p className="font-serif text-3xl leading-snug">
          “Pochi centesimi a piatto, moltiplicati per ogni coperto, fanno la differenza tra un anno in pari e un anno buono.”
        </p>
        <p className="mt-6 text-sm text-white/70">Foto del menu, delle fatture e delle ricette. Al resto pensa Menu Engine.</p>
      </div>
    </div>
  );
}
