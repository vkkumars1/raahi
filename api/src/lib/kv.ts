import Redis from "ioredis";
import { env } from "../config/env";
import { logger } from "./logger";

/** Tiny key-value interface so OTP logic does not care whether Redis or memory is behind it. */
export interface KV {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSec?: number): Promise<void>;
  incr(key: string): Promise<number>;
  expire(key: string, ttlSec: number): Promise<void>;
  ttl(key: string): Promise<number>;
  del(key: string): Promise<void>;
  ping(): Promise<boolean>;
}

export class RedisKV implements KV {
  private r: Redis;
  constructor(url: string) {
    this.r = new Redis(url, { maxRetriesPerRequest: 2, enableReadyCheck: true });
    this.r.on("error", (e) => logger.error({ err: e.message }, "redis error"));
  }
  get(key: string) { return this.r.get(key); }
  async set(key: string, value: string, ttlSec?: number) {
    if (ttlSec) await this.r.set(key, value, "EX", ttlSec);
    else await this.r.set(key, value);
  }
  incr(key: string) { return this.r.incr(key); }
  async expire(key: string, ttlSec: number) { await this.r.expire(key, ttlSec); }
  ttl(key: string) { return this.r.ttl(key); }
  async del(key: string) { await this.r.del(key); }
  async ping() { return (await this.r.ping()) === "PONG"; }
  async quit() { await this.r.quit(); }
}

/** In-memory fallback for local dev and tests. Not for production (not shared across instances). */
export class MemoryKV implements KV {
  private m = new Map<string, { v: string; exp?: number }>();
  private live(key: string) {
    const e = this.m.get(key);
    if (!e) return undefined;
    if (e.exp && e.exp <= Date.now()) { this.m.delete(key); return undefined; }
    return e;
  }
  async get(key: string) { return this.live(key)?.v ?? null; }
  async set(key: string, value: string, ttlSec?: number) {
    this.m.set(key, { v: value, exp: ttlSec ? Date.now() + ttlSec * 1000 : undefined });
  }
  async incr(key: string) {
    const e = this.live(key);
    const n = (e ? parseInt(e.v, 10) : 0) + 1;
    this.m.set(key, { v: String(n), exp: e?.exp });
    return n;
  }
  async expire(key: string, ttlSec: number) {
    const e = this.live(key);
    if (e) e.exp = Date.now() + ttlSec * 1000;
  }
  async ttl(key: string) {
    const e = this.live(key);
    if (!e) return -2;
    return e.exp ? Math.ceil((e.exp - Date.now()) / 1000) : -1;
  }
  async del(key: string) { this.m.delete(key); }
  async ping() { return true; }
}

export let kv: KV = env.REDIS_URL ? new RedisKV(env.REDIS_URL) : new MemoryKV();
if (!env.REDIS_URL) logger.warn("REDIS_URL not set: using in-memory store (dev only)");
/** Test hook */
export const setKV = (k: KV) => { kv = k; };
