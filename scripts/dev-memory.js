// Runs the app against a throwaway in-memory MongoDB, for trying it without Atlas.
// Data is lost when it stops. Sources read test/fixtures unless SOURCES_DEMO=0.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { MongoMemoryServer } from 'mongodb-memory-server';

const mongo = await MongoMemoryServer.create();
process.env.MONGODB_URI = mongo.getUri('job-radar');
process.env.JWT_SECRET ||= 'dev-only-secret';
process.env.SOURCES_DEMO ??= '1';
process.env.ADMIN_EMAILS ||= 'admin@example.com';
console.log(`In-memory MongoDB at ${process.env.MONGODB_URI} (admin email: ${process.env.ADMIN_EMAILS})`);

// Next doesn't override variables that are already set, so these win over .env.
const nextBin = path.join(path.dirname(createRequire(import.meta.url).resolve('next/package.json')), 'dist', 'bin', 'next');
const next = spawn(process.execPath, [nextBin, 'dev'], { stdio: 'inherit' });

// Ctrl+C reaches Next too; stay alive until it exits so MongoDB gets stopped below.
process.on('SIGINT', () => {});

next.on('exit', async (code) => {
  await mongo.stop();
  process.exit(code ?? 0);
});
