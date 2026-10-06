"use client";

export default function PrintButton() {
  return (
    <button type="button" className="button small" onClick={() => window.print()}>
      Print or save as PDF
    </button>
  );
}
