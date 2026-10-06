import type { Metadata } from "next";
import {
  diagramRegistry,
  Icon,
  iconNames,
  illustrations,
  MagnetCover,
  magnets,
  videos,
} from "@/components/visuals";

export const metadata: Metadata = {
  title: "Visual library",
  robots: { index: false, follow: false },
};

/**
 * Internal catalogue of every reusable visual, with the import line to copy.
 * Not linked from the site and not indexed.
 */
export default function VisualsPage() {
  return (
    <>
      <h1>Visual library</h1>
      <p className="lead">
        Every illustration, diagram, cover and video, ready to drop into a page. Import from{" "}
        <code>@/components/visuals</code>. The style guide is in <code>docs/visual-style.md</code>.
      </p>

      <h2>Diagrams ({diagramRegistry.length})</h2>
      <div className="v-gallery">
        {diagramRegistry.map(({ name, component: D, topics }) => (
          <div key={name} className="card">
            <D bare />
            <h3>{name}</h3>
            <code>{`<${name} caption="..." />`}</code>
            <p className="notice">{topics.join(", ")}</p>
          </div>
        ))}
      </div>

      <h2>Illustrations ({illustrations.length})</h2>
      <div className="v-gallery">
        {illustrations.map(({ name, component: I, kind, topics }) => (
          <div key={name} className="card">
            <I bare />
            <h3>{name}</h3>
            <code>{`<${name} />`}</code>
            <p className="notice">
              {kind} · {topics.join(", ")}
            </p>
          </div>
        ))}
      </div>

      <h2>Lead magnet covers ({magnets.length})</h2>
      <div className="v-gallery">
        {magnets.map((m) => (
          <div key={m.slug} className="card">
            <MagnetCover slug={m.slug} bare />
            <h3>{m.title}</h3>
            <code>{`<MagnetCover slug="${m.slug}" />`}</code>
            <p className="notice">Static: /media/covers/{m.slug}.png</p>
          </div>
        ))}
      </div>

      <h2>Videos ({videos.length})</h2>
      <ul>
        {videos.map((v) => (
          <li key={v.slug}>
            <a href={`/videos/${v.slug}`}>{v.title}</a> · <code>{`<VideoExplainer slug="${v.slug}" />`}</code>
          </li>
        ))}
      </ul>

      <h2>Icons ({iconNames.length})</h2>
      <p className="notice">
        House icons for diagrams and illustrations. For plain interface icons use <code>lucide-react</code>, which
        shares the 2px round stroke.
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
        {iconNames.map((n) => (
          <div key={n} style={{ width: 96, textAlign: "center", fontSize: "0.7rem" }}>
            <Icon name={n} size={36} />
            <div>{n}</div>
          </div>
        ))}
      </div>

      <h2>Share images</h2>
      <p>
        Every page can use <code>{`ogImageUrl("Page title", "Kicker")`}</code> from <code>@/lib/og-url</code> in{" "}
        <code>metadata.openGraph.images</code>.
      </p>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/og?title=How%20a%20revocable%20living%20trust%20works&kicker=Trusts" alt="Example share image" width={600} height={315} />
    </>
  );
}
