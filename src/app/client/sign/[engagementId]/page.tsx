import Link from "next/link";
import { firm } from "@/config/firm";
import { ESIGN_CONSENT_CHECKBOX, ESIGN_INTENT_CHECKBOX, esignDisclosure } from "@/lib/esignConsent";
import { ForbiddenError, requireMfa } from "@/server/auth/policy";
import { BuiltinEsignProvider, builtinSecret } from "@/server/esign/builtin";
import { currentActor, getDb } from "@/server/runtime";
import { markViewed, signingView, type SigningView } from "@/server/services/signing";
import { SignForm } from "./SignForm";
import styles from "./sign.module.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your engagement agreement", robots: { index: false, follow: false } };

const when = (iso: string) => new Date(iso).toLocaleString("en-US", { dateStyle: "long", timeStyle: "short" });
const kb = (n: number) => (n > 1_000_000 ? `${(n / 1_000_000).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1000))} KB`);

function Message({ children }: { children: React.ReactNode }) {
  return <div className={styles.wrap}><h1>Your engagement agreement</h1>{children}</div>;
}

export default async function SignPage({ params }: { params: Promise<{ engagementId: string }> }) {
  const { engagementId } = await params;
  const actor = await currentActor();
  if (!actor) return <Message><p>Please use the link from your attorney&apos;s office to sign in, or call {firm.phone}.</p></Message>;
  let view: SigningView;
  try {
    requireMfa(actor);
    const service = await getDb();
    if (actor.role === "client") await markViewed(service, actor, engagementId, new BuiltinEsignProvider(builtinSecret()));
    view = await signingView(service, actor, engagementId);
  } catch (err) {
    if (err instanceof ForbiddenError && /Two-step/.test(err.message)) return <Message><p>One more step to confirm it is you. <Link href="/portal/login/verify">Continue</Link></p></Message>;
    return <Message><p>We could not open this agreement. Please call {firm.phone} and the office will help.</p></Message>;
  }
  const pending = view.signers.filter((s) => !s.signed);
  const me = pending[0];
  const isClient = actor.role === "client";
  const disclosure = esignDisclosure(view.firmName);

  return (
    <div className={styles.wrap}>
      <p className={styles.eyebrow}>{view.firmName}</p>
      <h1 className={styles.title}>Your engagement agreement</h1>
      {!isClient && <p className="notice">Staff preview: this is what the client sees. Only the client can sign.</p>}

      {view.state === "voided" && <p className="callout">This agreement was withdrawn by the office. Please call {firm.phone} if you have questions.</p>}

      {view.state === "signed" && (
        <section className={styles.done} aria-live="polite">
          <h2>Signed. Thank you.</h2>
          <ul className={styles.signers}>
            {view.signers.map((s) => <li key={s.role}><span className={styles.tick}>✓</span> {s.name} signed {s.signed ? when(s.signed.signedAt) : ""}</li>)}
          </ul>
          <p>{view.countersigned ? `${view.attorneyName} has countersigned. Your agreement is complete.` : `${view.attorneyName} will countersign next. You do not need to do anything for that.`}</p>
          <div className={styles.actions}>
            <a className="button" href={`/client/sign/${view.engagementId}/copy`}>Download your copy</a>
            {view.paymentLinkUrl && <a className="button secondary" href={view.paymentLinkUrl}>Next: make your payment</a>}
            <Link className="button secondary" href="/client">Back to my case</Link>
          </div>
          {view.paymentLinkUrl && <p className={styles.small}>The payment goes straight to the firm through its secure payment page.</p>}
        </section>
      )}

      {view.state === "partly_signed" && (
        <p className="callout">
          {view.signers.filter((s) => s.signed).map((s) => s.name).join(" and ")} signed. Waiting for {pending.map((s) => s.name).join(" and ")}.
        </p>
      )}

      <section className={styles.summary} aria-labelledby="summary-h">
        <h2 id="summary-h">In plain words</h2>
        <dl>
          <div><dt>What you are hiring them for</dt><dd>{view.summary.hiring}{view.summary.includes.length > 0 && <ul>{view.summary.includes.map((i) => <li key={i}>{i}</li>)}</ul>}</dd></div>
          <div><dt>The fee</dt><dd>{view.summary.fee}</dd></div>
          <div><dt>How you pay</dt><dd>{view.summary.payment.map((p) => <span key={p}>{p} </span>)}</dd></div>
          <div><dt>What happens next</dt><dd><ol>{view.summary.next.map((n) => <li key={n}>{n}</li>)}</ol></dd></div>
        </dl>
        <p className={styles.small}>This summary is to help you read the agreement. The agreement below is what you sign. Questions? Call {firm.phone} or send a message from your case page before you sign.</p>
      </section>

      <div className={styles.docHead}>
        <h2>The full agreement</h2>
        <span className={styles.small}>Scroll to read all of it</span>
      </div>
      <div className={styles.letter} tabIndex={0} aria-label="Engagement agreement text">{view.letter}</div>

      {view.attachment && (
        <section className={styles.pdf}>
          <div className={styles.pdfRow}>
            <span><strong>Also part of this agreement:</strong> {view.attachment.name} ({kb(view.attachment.sizeBytes)})</span>
            <a className="button secondary" href={`/api/client/engagements/${view.engagementId}/attachment`} target="_blank" rel="noopener">Open the PDF</a>
          </div>
          <iframe src={`/api/client/engagements/${view.engagementId}/attachment`} title={view.attachment.name} />
          <p className={styles.small}>You are signing the letter above and this PDF together.</p>
        </section>
      )}

      {isClient && me && view.state !== "voided" && (
        <SignForm
          key={me.role}
          engagementId={view.engagementId}
          documentSha256={view.documentSha256}
          signer={{ role: me.role, name: me.name }}
          nextSigner={pending[1]?.name}
          disclosure={disclosure}
          consentText={ESIGN_CONSENT_CHECKBOX}
          intentText={ESIGN_INTENT_CHECKBOX}
        />
      )}
      <p className={styles.small}>Document fingerprint (sha256): <code>{view.documentSha256.slice(0, 16)}…</code> It is recorded with your signature so anyone can check the copy was not changed.</p>
    </div>
  );
}
