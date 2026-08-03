"use client";

import Link from "next/link";

/** Shared chrome for every auth screen, so they stay visually consistent. */
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="p-4 sm:p-6">
        <Link href="/" className="font-bold text-lg text-gray-900">
          DojoPay
        </Link>
      </header>

      <main className="flex-grow flex items-start sm:items-center justify-center px-4 pb-12">
        <div className="w-full max-w-md">
          <div className="rounded-2xl border border-gray-200 bg-white p-6 sm:p-8 shadow-sm">
            <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
            {subtitle && <p className="mt-2 text-sm text-gray-600">{subtitle}</p>}
            <div className="mt-6">{children}</div>
          </div>
          {footer && <div className="mt-4 text-center text-sm text-gray-600">{footer}</div>}
        </div>
      </main>
    </div>
  );
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
    >
      {message}
    </div>
  );
}

export function FormNotice({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div
      role="status"
      className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800"
    >
      {message}
    </div>
  );
}

export function TextField({
  label,
  hint,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  return (
    <div>
      <label htmlFor={props.id} className="block text-sm font-medium text-gray-800 mb-1.5">
        {label}
      </label>
      <input
        {...props}
        className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 placeholder-gray-400 focus:border-transparent focus:ring-2 focus:ring-gray-900 disabled:bg-gray-50"
      />
      {hint && <p className="mt-1.5 text-xs text-gray-500">{hint}</p>}
    </div>
  );
}

export function SubmitButton({
  children,
  busy,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { busy?: boolean }) {
  return (
    <button
      {...props}
      type="submit"
      disabled={busy || props.disabled}
      className="w-full rounded-lg bg-[#f97316] px-4 py-2.5 font-semibold text-white transition-colors hover:bg-[#ea580c] disabled:cursor-not-allowed disabled:bg-gray-300"
    >
      {busy ? "Please wait…" : children}
    </button>
  );
}
