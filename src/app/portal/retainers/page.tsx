import Link from "next/link";
import { can } from "@/server/auth/policy";
import { currentActor, getDb, scopedDb } from "@/server/runtime";
import { MATTER_LABELS } from "@/server/services/leads";
import { listFirmTemplates } from "@/server/services/retainerTemplates";
import { RetainerEditor } from "./RetainerEditor";
import styles from "./retainers.module.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Retainer templates", robots: { index: false, follow: false } };

export default async function RetainersPage({ searchParams }: { searchParams: Promise<{ firm?: string }> }) {
  const actor = await currentActor();
  if (!actor) return <p>Please <Link href="/portal">sign in</Link>.</p>;
  if (!can(actor, "view_retainer_templates")) return <p>Retainer templates are for the receiving firm&apos;s attorneys and office.</p>;
  const db = scopedDb(await getDb(), actor);
  const { firm } = await searchParams;
  const firms = actor.role === "platform_admin" ? await db.firms.list() : [];
  const firmId = actor.role === "platform_admin" ? (firm ?? firms[0]?.id) : actor.firmId;
  const templates = await listFirmTemplates(db, actor, firmId);
  const firmName = firmId ? (await db.firms.get(firmId))?.name : undefined;

  return (
    <div className={styles.page}>
      <p><Link href="/portal">← Portal</Link></p>
      <h1>Retainer templates{firmName ? ` · ${firmName}` : ""}</h1>
      <div className={styles.intro}>
        <p className="lead">Your own engagement agreement, filled in automatically with what each client told us, ready to send from the lead page in two clicks.</p>
        <p>Write or paste your agreement, drop in fields like the client&apos;s name and fee, and attach your standard PDF if you have one. Each change saves a new version; an attorney of your firm approves a version before it is used. Pick one default per matter type.</p>
      </div>
      <p className={styles.responsibility}>
        <strong>The wording is your firm&apos;s.</strong> The platform fills in the fields and records the signatures; it does not review or stand behind the agreement&apos;s terms. Have the responsible attorney read every version before approving it.
      </p>
      {actor.role === "platform_admin" && firms.length > 1 && (
        <p className="notice">Viewing as platform admin (read only): {firms.map((f, i) => <span key={f.id}>{i > 0 && " · "}<Link href={`/portal/retainers?firm=${f.id}`}>{f.name}</Link></span>)}</p>
      )}
      <RetainerEditor
        templates={templates}
        matters={Object.entries(MATTER_LABELS).map(([key, label]) => ({ key, label }))}
        canManage={can(actor, "manage_retainer_templates") && !!actor.firmId}
        canApprove={can(actor, "approve_retainer_templates") && !!actor.firmId}
      />
    </div>
  );
}
