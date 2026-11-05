// Worker tests run in the Cloudflare runtime with a local D1 (PLAN Phase 4). Separate from the app's config.
import { defineConfig } from 'vitest/config';
import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-pool-workers';

export default defineConfig(async () => {
  const migrations = await readD1Migrations('worker/migrations');
  return {
    plugins: [
      cloudflareTest({
        wrangler: { configPath: './wrangler.test.toml' },
        miniflare: {
          bindings: { TEST_MIGRATIONS: migrations, BOOTSTRAP_TOKEN: 'test-bootstrap-token' },
        },
      }),
    ],
    test: {
      include: ['worker/src/**/*.test.ts'],
      setupFiles: ['worker/test/setup.ts'],
    },
  };
});
