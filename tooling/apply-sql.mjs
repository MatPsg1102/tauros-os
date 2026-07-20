// Aplica, em ordem, os .sql de supabase/migrations e prisma/seeds contra o
// DATABASE_URL (cloud ou local), usando `prisma db execute`.
// Uso: node tooling/apply-sql.mjs [--seeds-only|--migrations-only]
import { readdirSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join } from 'node:path';

if (!process.env.DATABASE_URL && existsSync('.env')) {
  process.loadEnvFile('.env');
}
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL ausente. Preencha o .env (ver .env.example).');
  process.exit(1);
}

const mode = process.argv[2] ?? '';
const groups = [];
if (mode !== '--seeds-only') groups.push('supabase/migrations');
if (mode !== '--migrations-only') groups.push('prisma/seeds');

for (const dir of groups) {
  const files = readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  for (const f of files) {
    const path = join(dir, f);
    console.error(`==> ${path}`);
    execSync(`pnpm exec prisma db execute --file "${path}" --schema prisma/schema`, {
      stdio: 'inherit',
    });
  }
}
console.error('OK: SQL aplicado.');
