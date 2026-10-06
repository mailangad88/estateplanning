import { renderOgImage } from "@/lib/og";
import { firm } from "@/config/firm";

export const alt = `${firm.brandName}: estate planning with a real attorney`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return renderOgImage({
    title: "Wills, trusts and powers of attorney, explained plainly",
    kicker: "Estate planning",
  });
}
