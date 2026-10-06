import { ImageResponse } from "next/og";
import { firm } from "@/config/firm";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Estate planning with a real attorney";

export default function OgImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", padding: 80, background: "#fbfaf7", color: "#1d1f22" }}>
        <div style={{ fontSize: 36, color: "#1f5f8b", fontWeight: 700 }}>{firm.brandName}</div>
        <div style={{ fontSize: 72, fontWeight: 700, marginTop: 24, lineHeight: 1.1 }}>Estate planning, explained plainly.</div>
        <div style={{ fontSize: 34, marginTop: 24, color: "#555b63" }}>Wills · Trusts · Powers of attorney · Probate</div>
      </div>
    ),
    size,
  );
}
