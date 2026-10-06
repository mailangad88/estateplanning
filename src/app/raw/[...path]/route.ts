import { absoluteUrl } from "@/config/site";
import { getAllArticles, getGlossary, getStateGuides, toPlainMarkdown } from "@/lib/library";

/** Markdown copy of each content page at /raw/{page path}.md, linked from llms.txt. */

export const dynamic = "force-static";
export const dynamicParams = false;

function pages() {
  return [...getAllArticles(), ...getStateGuides(), ...getGlossary()];
}

export function generateStaticParams() {
  return pages().map((p) => {
    const segments = p.url.slice(1).split("/");
    segments[segments.length - 1] += ".md";
    return { path: segments };
  });
}

export async function GET(_req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const url = `/${path.join("/")}`.replace(/\.md$/, "");
  const page = pages().find((p) => p.url === url);
  if (!page) return new Response("Not found", { status: 404 });
  const body = `${toPlainMarkdown(page)}\nCanonical: ${absoluteUrl(page.url)}\n`;
  return new Response(body, {
    headers: { "Content-Type": "text/markdown; charset=utf-8", Link: `<${absoluteUrl(page.url)}>; rel="canonical"` },
  });
}
