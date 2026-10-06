"use client";

import Link from "next/link";
import { useState } from "react";
import { clearDraft } from "@/lib/familyPlanHandoff";
import type { AccountOverview } from "@/server/services/planAccount";
import base from "../FamilyPlanner.module.css";
import styles from "../Account.module.css";
import { AuthenticatorSetup, CodeForm, errorText, postJson, RecoveryCodes, When } from "../AccountParts";

type Panel = null | "codes" | "phone" | "delete";

export default function AccountClient({ initial, usedRecoveryCode, idleMinutes, maxDays }: {
  initial: AccountOverview;
  usedRecoveryCode: boolean;
  idleMinutes: number;
  maxDays: number;
}) {
  const [data, setData] = useState(initial);
  const [panel, setPanel] = useState<Panel>(null);
  const [newCodes, setNewCodes] = useState<string[] | null>(null);
  const [newKey, setNewKey] = useState<{ secret: string; otpauthUrl: string } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [deviceError, setDeviceError] = useState<string | null>(null);
  const [busyDevice, setBusyDevice] = useState<string | null>(null);

  async function refresh() {
    try {
      const res = await fetch("/api/my-plan/account", { cache: "no-store" });
      if (res.status === 401) {
        window.location.assign("/my-plan?ended=timeout");
        return;
      }
      if (res.ok) setData((await res.json()) as AccountOverview);
    } catch {
      /* keep what is on screen */
    }
  }

  const ended = (status: number) => {
    if (status === 401) window.location.assign("/my-plan?ended=timeout");
    return status === 401;
  };

  async function signOutDevice(id: string | "all") {
    setBusyDevice(id);
    setDeviceError(null);
    const r = await postJson("/api/my-plan/account/devices", id === "all" ? { all: true } : { id });
    setBusyDevice(null);
    if (ended(r.status)) return;
    if (!r.ok) {
      setDeviceError(errorText(r.data));
      void refresh();
      return;
    }
    if (r.data.signedOutHere) {
      window.location.assign(id === "all" ? "/my-plan?ended=signed_out" : "/my-plan");
      return;
    }
    setNotice("That device is signed out. It will need the email link and a code to get back in.");
    void refresh();
  }

  const { mfa, devices, activity } = data;
  const lowCodes = mfa.recoveryCodesLeft <= 3;

  if (newCodes) {
    return (
      <>
        <header className={base.hero}>
          <p className={base.kicker}>Account and security</p>
          <h1>Your new recovery codes</h1>
        </header>
        <p className={base.ok} role="status">Your old recovery codes no longer work.</p>
        <RecoveryCodes
          codes={newCodes}
          doneLabel="Back to my account"
          onDone={() => {
            setNewCodes(null);
            setPanel(null);
            void refresh();
          }}
        />
      </>
    );
  }

  return (
    <>
      <Link href="/my-plan" className={styles.back}>&larr; Back to my plan</Link>
      <header className={base.hero}>
        <p className={base.kicker}>Your organizer</p>
        <h1>Account and security</h1>
        <p className="lead">Who can open your plan, from where, and everything that has happened on your account.</p>
      </header>

      {usedRecoveryCode && (
        <p className={styles.warn} role="status">
          <strong>You signed in with a recovery code.</strong> That code no longer works. If you lost your phone, set up your app on a new one
          below, then make new recovery codes.
        </p>
      )}
      {notice && <p className={base.ok} role="status">{notice}</p>}

      {/* Two-step verification */}
      <section className={base.card} aria-labelledby="acct-2fa-h">
        <h2 id="acct-2fa-h">Two-step verification</h2>
        <div className={styles.statusRow}>
          <span className={styles.on}>On</span>
          {mfa.enrolledAt && <span className={styles.meta}>Since <When iso={mfa.enrolledAt} withTime={false} /></span>}
        </div>
        <p>Each sign-in needs the email link and a 6-digit code from your authenticator app.</p>
        <p>
          <strong>Recovery codes left: {mfa.recoveryCodesLeft} of 10.</strong>{" "}
          {lowCodes ? "You are running low. Make new ones so you are not locked out if you lose your phone." : "Each works once if you lose your phone."}
        </p>
        {mfa.lockedUntil && (
          <p className={base.alert} role="status">
            Codes are paused until <When iso={mfa.lockedUntil} /> after too many wrong tries.
          </p>
        )}

        {panel === null && (
          <div className={base.actions}>
            <button type="button" className={lowCodes ? "button small" : "button secondary small"} onClick={() => setPanel("codes")}>Make new recovery codes</button>
            <button type="button" className="button secondary small" onClick={() => setPanel("phone")}>Moving to a new phone</button>
          </div>
        )}

        {panel === "codes" && (
          <div className={styles.inline}>
            <h3>Make new recovery codes</h3>
            <p className="notice">Your current codes stop working as soon as the new ones are made. Confirm it is you first.</p>
            <CodeForm
              label="6-digit code from your app"
              submitLabel="Make new codes"
              allowRecovery
              onCancel={() => setPanel(null)}
              onSubmit={async (code) => {
                const r = await postJson("/api/my-plan/account/recovery-codes", { code });
                if (ended(r.status)) return null;
                if (!r.ok) {
                  void refresh();
                  return errorText(r.data);
                }
                setNewCodes(r.data.recoveryCodes as string[]);
                return null;
              }}
            />
          </div>
        )}

        {panel === "phone" && (
          <div className={styles.inline}>
            <h3>Move to a new phone</h3>
            {!newKey ? (
              <>
                <p className="notice">First, a code from the app you use now. Lost that phone? Use a recovery code.</p>
                <CodeForm
                  label="6-digit code from your current app"
                  submitLabel="Continue"
                  allowRecovery
                  onCancel={() => setPanel(null)}
                  onSubmit={async (code) => {
                    const r = await postJson("/api/my-plan/account/authenticator", { step: "begin", code });
                    if (ended(r.status)) return null;
                    if (!r.ok) {
                      void refresh();
                      return errorText(r.data);
                    }
                    setNewKey({ secret: r.data.secret as string, otpauthUrl: r.data.otpauthUrl as string });
                    return null;
                  }}
                />
              </>
            ) : (
              <>
                <p>Now set up the app on your new phone. Your old app keeps working until this is done.</p>
                <AuthenticatorSetup secret={newKey.secret} otpauthUrl={newKey.otpauthUrl} />
                <CodeForm
                  label="6-digit code from your new app"
                  submitLabel="Switch to the new app"
                  onCancel={() => {
                    void postJson("/api/my-plan/account/authenticator", { step: "cancel" });
                    setNewKey(null);
                    setPanel(null);
                  }}
                  onSubmit={async (code) => {
                    const r = await postJson("/api/my-plan/account/authenticator", { step: "confirm", code });
                    if (ended(r.status)) return null;
                    if (!r.ok) return errorText(r.data);
                    setNewKey(null);
                    setPanel(null);
                    setNotice("Done. Codes now come from your new app; the old one no longer works.");
                    void refresh();
                    return null;
                  }}
                />
              </>
            )}
          </div>
        )}
        <p className="notice">
          Passkeys (Face ID, Touch ID or a security key) are not available yet.
        </p>
      </section>

      {/* Devices */}
      <section className={base.card} aria-labelledby="acct-devices-h">
        <h2 id="acct-devices-h">Signed-in devices</h2>
        <p className="notice">
          A device stays signed in for up to {maxDays} days, and is signed out after {idleMinutes} minutes with no activity. We keep only the kind of
          device and the first part of its network address.
        </p>
        <ul className={styles.list}>
          {devices.map((d) => (
            <li key={d.id}>
              <span className={styles.device}>
                <strong>
                  {d.device}
                  {d.current && <span className={styles.tag}>This device</span>}
                  {d.viaRecoveryCode && <span className={`${styles.tag} ${styles.tagWarn}`}>Recovery code</span>}
                </strong>
                <span className={styles.meta}>
                  Signed in <When iso={d.createdAt} /> · last active <When iso={d.lastSeenAt} />
                  {d.ipPrefix ? ` · network ${d.ipPrefix}` : ""}
                </span>
              </span>
              <button type="button" className="button secondary small" disabled={busyDevice !== null} onClick={() => void signOutDevice(d.id)}>
                {busyDevice === d.id ? "Signing out…" : "Sign out"}
              </button>
            </li>
          ))}
        </ul>
        {deviceError && <p className="error" role="alert">{deviceError}</p>}
        <button type="button" className={base.danger} disabled={busyDevice !== null} onClick={() => void signOutDevice("all")}>
          {busyDevice === "all" ? "Signing out…" : "Sign out of all devices"}
        </button>
      </section>

      {/* Your data */}
      <section className={base.card} aria-labelledby="acct-data-h">
        <h2 id="acct-data-h">Your data</h2>
        <p>
          Download everything we keep for your account: your answers, the summary, your consent, signed-in devices and the activity below,
          as one file (JSON, which a computer or an attorney&apos;s office can read).
        </p>
        <a className="button secondary small" href="/api/my-plan/export" download onClick={() => setTimeout(() => void refresh(), 1500)}>Download my plan</a>
      </section>

      {/* Activity */}
      <section className={base.card} aria-labelledby="acct-activity-h">
        <h2 id="acct-activity-h">Recent activity</h2>
        {activity.length === 0 ? (
          <p className="notice">Nothing yet.</p>
        ) : (
          <ul className={styles.activity}>
            {activity.map((a, i) => (
              <li key={`${a.at}-${i}`}>
                <span>{a.text}{a.count > 1 ? ` (${a.count} times)` : ""}</span>
                <When iso={a.at} />
              </li>
            ))}
          </ul>
        )}
        <p className="notice">If you see something you did not do, sign out of all devices and make new recovery codes, then call us.</p>
      </section>

      {/* Delete */}
      <section className={`${base.card} ${styles.dangerCard}`} aria-labelledby="acct-delete-h">
        <h2 id="acct-delete-h">Delete my account</h2>
        <p>
          This removes your account, your plan and its summary, your two-step setup and every signed-in device, for good. It cannot be undone.
          Our security log keeps a record that an account was deleted, with no names or answers in it.
        </p>
        {panel !== "delete" ? (
          <button type="button" className={base.danger} onClick={() => setPanel("delete")}>Delete my account</button>
        ) : (
          <CodeForm
            label="To confirm, enter a 6-digit code from your app"
            submitLabel="Delete everything for good"
            busyLabel="Deleting…"
            allowRecovery
            danger
            onCancel={() => setPanel(null)}
            onSubmit={async (code) => {
              const r = await postJson("/api/my-plan/account/delete", { code });
              if (ended(r.status)) return null;
              if (!r.ok) {
                void refresh();
                return errorText(r.data);
              }
              clearDraft();
              window.location.assign("/my-plan?ended=deleted");
              return null;
            }}
          />
        )}
      </section>
    </>
  );
}
