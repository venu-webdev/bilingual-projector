// Development: Vite with hot reload for the pages, Electron pointed at it.
import { createServer } from 'vite';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const server = await createServer({ configFile: 'vite.config.mjs' });
await server.listen();
const url = `http://localhost:${server.config.server.port}`;
const electron = createRequire(import.meta.url)('electron');
const child = spawn(electron, ['.', ...process.argv.slice(2)], { stdio: 'inherit', env: { ...process.env, PROJECTOR_DEV_URL: url } });
child.on('close', async (code) => { await server.close(); process.exit(code ?? 0); });
