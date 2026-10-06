"use client";

export const usd = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export function Money({ label, value, onChange, help }: { label: string; value: number; onChange: (n: number) => void; help?: string }) {
  return (
    <label className="field">
      {label}
      <input
        inputMode="numeric"
        value={value ? value.toLocaleString("en-US") : ""}
        placeholder="0"
        onChange={(e) => onChange(Number(e.target.value.replace(/[^0-9]/g, "")) || 0)}
      />
      {help && <span className="notice" style={{ fontWeight: 400 }}>{help}</span>}
    </label>
  );
}

export function Num({ label, value, onChange, min = 0, max = 100, step = 1, suffix }: { label: string; value: number; onChange: (n: number) => void; min?: number; max?: number; step?: number; suffix?: string }) {
  return (
    <label className="field">
      {label}{suffix ? ` (${suffix})` : ""}
      <input type="number" value={value} min={min} max={max} step={step} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}

export function YesNo({ label, value, onChange }: { label: string; value: boolean; onChange: (b: boolean) => void }) {
  return (
    <label className="check">
      <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}
