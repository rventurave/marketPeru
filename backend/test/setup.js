import { applyD1Migrations } from 'cloudflare:test';
import { env } from 'cloudflare:workers';

// Aplica las migraciones de D1 (idempotente). TEST_MIGRATIONS se inyecta
// desde vitest.config.js.
await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
