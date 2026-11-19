"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { runStrategy } from "@/app/app/actions";

export function RunStrategyButton({ label }: { label: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-col items-start gap-2 sm:items-end">
      <button
        className="btn-primary"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError(null);
            const res = await runStrategy();
            if (!res.ok) setError(res.error);
            else router.refresh();
          })
        }
      >
        {pending ? "L'agente sta analizzando… (fino a un minuto)" : label}
      </button>
      {error && <p className="text-sm text-tomato">{error}</p>}
    </div>
  );
}
