/**
 * Topic picker. Topics come from the question bank (content/questions.json): questions people
 * ask, each tagged with its cluster, risk and the site page that answers it. Illinois questions
 * go first (launch state), then general ones; a question is used once per format.
 */
import bank from "../../../content/questions.json";
import type { StudioVideo, Topic, VideoFormat } from "./types";

interface BankItem {
  q: string;
  cluster: string;
  intent: string;
  risk: "low" | "medium" | "high";
  state: boolean;
  coverage: "none" | "partial" | "faq" | "page";
  coveredBy: string | null;
  decide: string | null;
  resource: string | null;
}

/** US states other than Illinois, to skip questions about another state's law (launch state is Illinois). */
const OTHER_STATES = /\b(Alabama|Alaska|Arizona|Arkansas|California|Colorado|Connecticut|Delaware|Florida|Georgia|Hawaii|Idaho|Indiana|Iowa|Kansas|Kentucky|Louisiana|Maine|Maryland|Massachusetts|Michigan|Minnesota|Mississippi|Missouri|Montana|Nebraska|Nevada|New Hampshire|New Jersey|New Mexico|New York|North Carolina|North Dakota|Ohio|Oklahoma|Oregon|Pennsylvania|Rhode Island|South Carolina|South Dakota|Tennessee|Texas|Utah|Vermont|Virginia|Washington|West Virginia|Wisconsin|Wyoming)\b/;

function isIllinois(item: BankItem): boolean {
  return item.cluster === "illinois" || /illinois/i.test(item.q) || /illinois/i.test(item.coveredBy ?? "");
}

const ITEMS = (bank as unknown as { items: BankItem[] }).items.filter((i) => !OTHER_STATES.test(i.q) && !OTHER_STATES.test(i.coveredBy ?? ""));

export function toTopic(item: BankItem): Topic {
  return {
    question: item.q,
    cluster: item.cluster,
    intent: item.intent,
    risk: item.risk,
    state: isIllinois(item) ? "IL" : null,
    coveredBy: item.coveredBy,
    resource: item.resource,
    decide: item.decide,
  };
}

export function allTopics(): Topic[] {
  return ITEMS.map(toTopic);
}

const key = (q: string) => q.trim().toLowerCase();

/**
 * Next unused topics for a format. `needsPage` limits to questions our site already answers,
 * which is what the offline site-draft writer needs. Long videos prefer whole pages; shorts
 * take any answered question. Clusters rotate so one day's videos are not all on one subject.
 */
export function pickTopics(existing: StudioVideo[], format: VideoFormat, count: number, opts: { needsPage: boolean }): Topic[] {
  const used = new Set(existing.filter((v) => v.format === format && v.stage !== "rejected").map((v) => key(v.topic.question)));
  const pool = allTopics().filter((t) => !used.has(key(t.question)) && (!opts.needsPage || t.coveredBy));
  const score = (t: Topic) => (t.state === "IL" ? 0 : 1) * 10 + (format === "long" && t.coveredBy?.startsWith("/learn/") ? 0 : 1);
  pool.sort((a, b) => score(a) - score(b));
  const out: Topic[] = [];
  const deferred: Topic[] = [];
  const clusters = new Set(existing.filter((v) => v.format === format).slice(-3).map((v) => v.topic.cluster));
  for (const t of pool) {
    if (out.length >= count) break;
    if (clusters.has(t.cluster)) {
      deferred.push(t);
      continue;
    }
    out.push(t);
    clusters.add(t.cluster);
  }
  return [...out, ...deferred].slice(0, count);
}
