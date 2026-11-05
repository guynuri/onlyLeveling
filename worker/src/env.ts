// Worker bindings. Secrets are set with `wrangler secret put`, never committed.
export interface Env {
  DB: D1Database;
  BOOTSTRAP_TOKEN: string; // Phase 4a: the one account's bearer token. Replaced by password sessions in 4b.
  AI: Ai; // Workers AI binding (wrangler.toml [ai]). No API key: the binding is the credential.
  VAPID_PUBLIC?: string; // push: the public key (wrangler.toml [vars]); the app subscribes with it
  VAPID_PRIVATE_JWK?: string; // push: the private key as JWK JSON, a secret: `wrangler secret put VAPID_PRIVATE_JWK`
}
