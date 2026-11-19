"use client";

import { useFormStatus } from "react-dom";

export function SubmitButton({ children, className = "btn-primary", pendingText }: { children: React.ReactNode; className?: string; pendingText?: string }) {
  const { pending } = useFormStatus();
  return (
    <button className={className} disabled={pending}>
      {pending ? pendingText ?? "…" : children}
    </button>
  );
}

export function ConfirmButton({ children, className = "btn-ghost", message }: { children: React.ReactNode; className?: string; message: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      className={className}
      disabled={pending}
      onClick={(e) => {
        if (!confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
