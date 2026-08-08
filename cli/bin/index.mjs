#!/usr/bin/env node
// create-uw-workbench — democratized onboarding for self-hosters.
// Usage: npx create-uw-workbench [dir]
// Clones the repo, installs dependencies, starts Postgres (docker compose),
// migrates + seeds, and prints the demo login. ~3 minutes to a running desk.
import { execSync } from 'node:child_process';
import { existsSync, copyFileSync } from 'node:fs';
import path from 'node:path';

const REPO = 'https://github.com/KevinHicksCLT/uw-workbench.git';
const dir = process.argv[2] ?? 'uw-workbench';

const run = (cmd, cwd) => {
  console.log(`\n> ${cmd}`);
  execSync(cmd, { stdio: 'inherit', cwd });
};

const step = (n, msg) => console.log(`\n── [${n}/6] ${msg}`);

try {
  step(1, `Cloning ${REPO} into ./${dir}`);
  if (existsSync(dir)) {
    console.error(`Directory ${dir} already exists — pick another name.`);
    process.exit(1);
  }
  run(`git clone --depth 1 ${REPO} ${dir}`);
  const root = path.resolve(dir);

  step(2, 'Installing dependencies');
  run('npm install', root);

  step(3, 'Starting Postgres (docker compose up -d)');
  try {
    run('docker compose up -d', root);
  } catch {
    console.warn('\nDocker unavailable — start your own Postgres and set DATABASE_URL in server/.env, then re-run: npm run db:setup');
  }

  step(4, 'Configuring server/.env');
  const env = path.join(root, 'server', '.env');
  if (!existsSync(env)) copyFileSync(path.join(root, '.env.example'), env);

  step(5, 'Migrating + seeding the demo underwriting estate');
  run('npm run db:setup', root);

  step(6, 'Done!');
  console.log(`
  UW Workbench is ready.

    cd ${dir}
    npm run dev:server     # API on :4000
    npm run dev:web        # UI  on :5173

  Demo login:  demo@uw-workbench.dev / underwrite!
  Or create your own company at http://localhost:5173/signup

  Content packs live in packs/ — import one, reshape it, export yours,
  and open a PR to share it with the commons.
`);
} catch (e) {
  console.error('\ncreate-uw-workbench failed:', e.message);
  process.exit(1);
}
