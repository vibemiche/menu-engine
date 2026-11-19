import Link from "next/link";
import type { MenuClass } from "@/lib/costing";

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-serif text-3xl font-semibold">{title}</h1>
        {subtitle && <p className="mt-1 max-w-2xl text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Stat({ label, value, hint, tone = "ink" }: { label: string; value: React.ReactNode; hint?: React.ReactNode; tone?: "ink" | "basil" | "tomato" | "amber" }) {
  const color = { ink: "text-ink", basil: "text-basil", tomato: "text-tomato", amber: "text-amber" }[tone];
  return (
    <div className="card p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-muted">{label}</div>
      <div className={`tabular mt-1 text-2xl font-semibold ${color}`}>{value}</div>
      {hint && <div className="mt-1 text-xs text-muted">{hint}</div>}
    </div>
  );
}

export function FoodCostBadge({ value, target }: { value: number | null; target: number }) {
  if (value == null) return <span className="text-xs text-muted">–</span>;
  const tone =
    value > target + 5 ? "bg-tomato-soft text-tomato" : value > target ? "bg-amber-soft text-amber" : "bg-basil-soft text-basil";
  return <span className={`tabular inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${tone}`}>{value.toFixed(1).replace(".", ",")}%</span>;
}

export const CLASS_STYLE: Record<MenuClass, { label: string; className: string; color: string }> = {
  star: { label: "Star", className: "bg-basil-soft text-basil", color: "#2f6b4f" },
  plowhorse: { label: "Cavallo da tiro", className: "bg-amber-soft text-amber", color: "#b7791f" },
  puzzle: { label: "Enigma", className: "bg-sky-soft text-sky", color: "#2f5f8a" },
  dog: { label: "Cane", className: "bg-tomato-soft text-tomato", color: "#c9472b" },
};

export function ClassBadge({ value }: { value: MenuClass | null }) {
  if (!value) return <span className="text-xs text-muted">–</span>;
  const s = CLASS_STYLE[value];
  return <span className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${s.className}`}>{s.label}</span>;
}

export function EmptyState({ title, text, href, cta }: { title: string; text: string; href?: string; cta?: string }) {
  return (
    <div className="card flex flex-col items-center px-6 py-14 text-center">
      <h3 className="font-serif text-xl font-semibold">{title}</h3>
      <p className="mt-2 max-w-md text-sm text-muted">{text}</p>
      {href && cta && <Link href={href} className="btn-primary mt-6">{cta}</Link>}
    </div>
  );
}
