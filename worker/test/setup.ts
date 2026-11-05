// Applies the real migrations to the local D1 before each test file runs.
import { applyD1Migrations, env } from 'cloudflare:test';
import type { D1Migration } from '@cloudflare/vitest-pool-workers';

const bindings = env as unknown as { DB: D1Database; TEST_MIGRATIONS: D1Migration[] };
await applyD1Migrations(bindings.DB, bindings.TEST_MIGRATIONS);
