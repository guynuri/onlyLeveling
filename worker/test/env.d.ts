// Types for the `cloudflare:test` env: the Worker bindings plus the migrations the test setup applies.
import type { D1Migration } from '@cloudflare/vitest-pool-workers';
import type { Env } from '../src/env';

declare module 'cloudflare:test' {
  interface ProvidedEnv extends Env {
    TEST_MIGRATIONS: D1Migration[];
  }
}
