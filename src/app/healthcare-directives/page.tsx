import type { Metadata } from "next";
import { MoneyPage } from "@/components/money-page";
import { MONEY_PAGES } from "@/content/money-pages";

const page = MONEY_PAGES["healthcare-directives"];

export const metadata: Metadata = {
  title: page.title,
  description: page.description,
  alternates: { canonical: page.path },
  openGraph: {
    title: page.title,
    description: page.description,
    images: [{ url: `/og?title=${encodeURIComponent(page.title)}`, width: 1200, height: 630, alt: `Share card: ${page.title}` }],
  },
};

export default function Page() {
  return <MoneyPage page={page} />;
}
