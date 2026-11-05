// Worker bindings. Secrets are set with `wrangler secret put`, never committed.
export interface Env {
  DB: D1Database;
  BOOTSTRAP_TOKEN: string; // Phase 4a: the one account's bearer token. Replaced by password sessions in 4b.
  AI: Ai; // Workers AI binding (wrangler.toml [ai]). No API key: the binding is the credential.
}
