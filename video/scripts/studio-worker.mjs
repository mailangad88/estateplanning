// Studio render worker (run by .github/workflows/studio.yml).
//   node scripts/studio-worker.mjs --jobs jobs.json --out dir/
// jobs.json is the response of POST /api/studio/render-queue: { jobs: [{ id, contentHash, plan }] }.
// Each job is rendered with render-studio.mjs, uploaded to S3-compatible storage (Cloudflare R2) when the
// STUDIO_S3_* variables are set, and reported to /api/studio/render-result. Without storage the files stay in
// the output dir (kept as a workflow artifact) and the job is reported as failed so the site shows why.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const opt = (n) => {
  const i = args.indexOf(`--${n}`);
  return i < 0 ? undefined : args[i + 1];
};
const jobsFile = opt("jobs");
const out = path.resolve(opt("out") ?? "studio-renders");
if (!jobsFile) throw new Error("usage: node scripts/studio-worker.mjs --jobs jobs.json --out dir/");
const { jobs } = JSON.parse(fs.readFileSync(jobsFile, "utf8"));
const env = process.env;
const SITE = (env.STUDIO_SITE_URL ?? env.SITE ?? "").replace(/\/$/, "");
const storage = env.STUDIO_S3_ENDPOINT && env.STUDIO_S3_BUCKET && env.STUDIO_S3_ACCESS_KEY_ID && env.STUDIO_S3_SECRET_ACCESS_KEY && env.STUDIO_MEDIA_BASE_URL;

async function report(body) {
  if (!SITE || !env.STUDIO_WORKER_TOKEN) return console.log("result (not reported):", JSON.stringify(body));
  const res = await fetch(`${SITE}/api/studio/render-result`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${env.STUDIO_WORKER_TOKEN}` },
    body: JSON.stringify(body),
  });
  console.log(`report ${body.id}: ${res.status} ${await res.text()}`);
}

let s3;
async function upload(file, key, contentType) {
  if (!s3) {
    const { S3Client } = await import("@aws-sdk/client-s3");
    s3 = new S3Client({ region: "auto", endpoint: env.STUDIO_S3_ENDPOINT, credentials: { accessKeyId: env.STUDIO_S3_ACCESS_KEY_ID, secretAccessKey: env.STUDIO_S3_SECRET_ACCESS_KEY } });
  }
  const { PutObjectCommand } = await import("@aws-sdk/client-s3");
  await s3.send(new PutObjectCommand({ Bucket: env.STUDIO_S3_BUCKET, Key: key, Body: fs.readFileSync(file), ContentType: contentType }));
  return `${env.STUDIO_MEDIA_BASE_URL.replace(/\/$/, "")}/${key}`;
}

for (const job of jobs) {
  const dir = path.join(out, job.id);
  fs.mkdirSync(dir, { recursive: true });
  const planFile = path.join(dir, "plan.json");
  fs.writeFileSync(planFile, JSON.stringify(job.plan));
  try {
    execFileSync("node", ["scripts/render-studio.mjs", "--plan", planFile, "--out", dir, "--name", job.id], { stdio: "inherit" });
    if (!storage) throw new Error("Rendered, but no storage is configured (STUDIO_S3_* secrets); files kept as a workflow artifact");
    const stamp = job.contentHash.slice(0, 12);
    const base = `studio/${job.id}-${stamp}`;
    const videoUrl = await upload(path.join(dir, `${job.id}.mp4`), `${base}.mp4`, "video/mp4");
    const thumbnailUrl = await upload(path.join(dir, `${job.id}-poster.jpg`), `${base}.jpg`, "image/jpeg");
    const captionsUrl = await upload(path.join(dir, `${job.id}.vtt`), `${base}.vtt`, "text/vtt");
    await report({ id: job.id, contentHash: job.contentHash, status: "done", videoUrl, thumbnailUrl, captionsUrl });
  } catch (err) {
    await report({ id: job.id, contentHash: job.contentHash, status: "failed", error: String(err instanceof Error ? err.message : err).slice(0, 400) });
  }
}
