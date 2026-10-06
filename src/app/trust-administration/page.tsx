import type { Metadata } from "next";
import { MoneyPage } from "@/components/money-page";
import { MONEY_PAGES } from "@/content/money-pages";

const page = MONEY_PAGES["trust-administration"];

export const metadata: Metadata = {
  title: page.title,
  description: page.description,
  alternates: { canonical: page.path },
  openGraph: { title: page.title, description: page.description },
};

export default function Page() {
  return <MoneyPage page={page} />;
}
