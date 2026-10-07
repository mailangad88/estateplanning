/**
 * Studio storage. Kept apart from the portal's Db so the two can change independently:
 * an in-memory store for development and tests, and a Postgres store (db/studio.sql) of
 * JSON documents when DATABASE_URL is set. Access is checked in access.ts before any call here.
 */
import type { ChannelAccount, Platform, StudioSettings, StudioVideo } from "./types";

export interface StudioStore {
  getVideo(id: string): Promise<StudioVideo | undefined>;
  listVideos(): Promise<StudioVideo[]>;
  saveVideo(video: StudioVideo): Promise<StudioVideo>;
  getChannel(platform: Platform): Promise<ChannelAccount | undefined>;
  saveChannel(channel: ChannelAccount): Promise<ChannelAccount>;
  getSettings(): Promise<StudioSettings | undefined>;
  saveSettings(settings: StudioSettings): Promise<StudioSettings>;
}

export function createMemoryStudioStore(): StudioStore {
  const videos = new Map<string, StudioVideo>();
  const channels = new Map<Platform, ChannelAccount>();
  let settings: StudioSettings | undefined;
  const copy = <T>(v: T): T => structuredClone(v);
  return {
    async getVideo(id) {
      const v = videos.get(id);
      return v && copy(v);
    },
    async listVideos() {
      return [...videos.values()].map(copy);
    },
    async saveVideo(video) {
      videos.set(video.id, copy(video));
      return video;
    },
    async getChannel(platform) {
      const c = channels.get(platform);
      return c && copy(c);
    },
    async saveChannel(channel) {
      channels.set(channel.platform, copy(channel));
      return channel;
    },
    async getSettings() {
      return settings && copy(settings);
    },
    async saveSettings(s) {
      settings = copy(s);
      return s;
    },
  };
}

/** Postgres store: three small tables of JSON documents (db/studio.sql). Runs as the service role. */
export async function createPgStudioStore(): Promise<StudioStore> {
  const { getPool, inTx } = await import("@/server/pg");
  const pool = getPool();
  const q = <R>(fn: (c: import("pg").PoolClient) => Promise<R>) => inTx(pool, "service", fn);
  return {
    async getVideo(id) {
      return q(async (c) => (await c.query("SELECT doc FROM studio_videos WHERE id = $1", [id])).rows[0]?.doc);
    },
    async listVideos() {
      return q(async (c) => (await c.query("SELECT doc FROM studio_videos ORDER BY created_at")).rows.map((r) => r.doc));
    },
    async saveVideo(v) {
      await q((c) =>
        c.query(
          `INSERT INTO studio_videos (id, stage, format, slot_at, doc, created_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7)
           ON CONFLICT (id) DO UPDATE SET stage = $2, format = $3, slot_at = $4, doc = $5, updated_at = $7`,
          [v.id, v.stage, v.format, v.slotAt ?? null, JSON.stringify(v), v.createdAt, v.updatedAt],
        ),
      );
      return v;
    },
    async getChannel(platform) {
      return q(async (c) => (await c.query("SELECT doc FROM studio_channels WHERE platform = $1", [platform])).rows[0]?.doc);
    },
    async saveChannel(ch) {
      await q((c) =>
        c.query(
          "INSERT INTO studio_channels (platform, doc, updated_at) VALUES ($1,$2,now()) ON CONFLICT (platform) DO UPDATE SET doc = $2, updated_at = now()",
          [ch.platform, JSON.stringify(ch)],
        ),
      );
      return ch;
    },
    async getSettings() {
      return q(async (c) => (await c.query("SELECT doc FROM studio_settings WHERE id = 'settings'")).rows[0]?.doc);
    },
    async saveSettings(s) {
      await q((c) =>
        c.query(
          "INSERT INTO studio_settings (id, doc, updated_at) VALUES ('settings',$1,now()) ON CONFLICT (id) DO UPDATE SET doc = $1, updated_at = now()",
          [JSON.stringify(s)],
        ),
      );
      return s;
    },
  };
}

const g = globalThis as unknown as { __studioStore?: Promise<StudioStore> };

export function getStudioStore(): Promise<StudioStore> {
  if (!g.__studioStore) {
    g.__studioStore = (process.env.DATABASE_URL ? createPgStudioStore() : Promise.resolve(createMemoryStudioStore())).catch((err) => {
      g.__studioStore = undefined;
      throw err;
    });
  }
  return g.__studioStore;
}

/** Tests swap in their own store. */
export function setStudioStore(store: StudioStore | undefined): void {
  g.__studioStore = store ? Promise.resolve(store) : undefined;
}
