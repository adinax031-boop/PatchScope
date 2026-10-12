#!/usr/bin/env node
import { resolve } from 'node:path';
import { createServer } from './server.js';
const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log('PatchScope\n\nUsage: patchscope [repository] [--port 4317]\n\nOpen the printed URL in your browser. Read-only, loopback only.\nWorking compares tracked files to HEAD; staged compares the index.');
} else {
  const positional = []; let port = 4317;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--port') port = Number(args[++i]);
    else if (args[i].startsWith('-')) { console.error(`Unknown option: ${args[i]}`); process.exit(1); }
    else positional.push(args[i]);
  }
  if (!Number.isInteger(port) || port < 1 || port > 65535 || positional.length > 1) { console.error('Usage: patchscope [repository] [--port 4317]'); process.exit(1); }
  const server = createServer({ cwd: resolve(positional[0] || '.') });
  server.on('error', error => { console.error(`Could not start PatchScope: ${error.message}`); process.exitCode = 1; });
  server.listen(port, '127.0.0.1', () => console.log(`\n  ◈ PatchScope\n  http://127.0.0.1:${port}\n\n  Local. Read-only. Yours.\n`));
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close());
}
