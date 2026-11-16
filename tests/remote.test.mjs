// The phone remote's door: PIN, lockout, allowed actions, switched off. node --test tests
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const { startOverlayServer, lanAddresses } = createRequire(import.meta.url)('../electron/overlay-server.cjs');
const dist = mkdtempSync(join(tmpdir(), 'remote-test-'));
writeFileSync(join(dist, 'overlay.html'), '<p>overlay</p>');

const commands = [];
const server = startOverlayServer(dist, { port: 17457, onRemote: (c) => commands.push(c) });
const wait = async () => { for (let i = 0; i < 50 && !server.url; i++) await new Promise((r) => setTimeout(r, 20)); };
const post = async (body) => {
  const r = await fetch(server.url.replace('overlay.html', 'remote/cmd'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return r.status;
};

test('switched off, nothing is accepted', async () => {
  await wait();
  server.setRemote(false);
  assert.equal(await post({ pin: '123456', action: 'next' }), 403);
  assert.equal(commands.length, 0);
});

test('the right PIN works, a wrong one does not, unknown actions are refused', async () => {
  const { pin } = server.setRemote(true);
  assert.match(pin, /^\d{6}$/);
  assert.equal(await post({ pin, action: 'next' }), 200);
  assert.equal(await post({ pin, action: 'go', index: 3 }), 200);
  assert.deepEqual(commands.splice(0), [{ action: 'next', index: null }, { action: 'go', index: 3 }]);
  assert.equal(await post({ pin: pin === '000000' ? '111111' : '000000', action: 'next' }), 403);
  assert.equal(await post({ pin, action: 'shutdown' }), 400);
  assert.equal(await post({ pin, action: 'check' }), 200);
  assert.equal(commands.length, 0, 'check and refused actions reach nothing');
});

test('five wrong PINs lock the address, even for the right PIN', async () => {
  const { pin } = server.setRemote(true); // a new PIN clears old misses
  const wrong = pin === '000000' ? '111111' : '000000';
  const codes = [];
  for (let i = 0; i < 6; i++) codes.push(await post({ pin: wrong, action: 'next' }));
  assert.deepEqual(codes, [403, 403, 403, 403, 429, 429]);
  assert.equal(await post({ pin, action: 'next' }), 429);
  assert.equal(commands.length, 0);
});

test('switching on again makes a new PIN and lifts the lock', async () => {
  const before = server.remote.pin;
  const { pin } = server.setRemote(true);
  assert.equal(await post({ pin, action: 'next' }), 200);
  assert.equal(commands.pop().action, 'next');
  if (pin !== before) assert.equal(await post({ pin: before, action: 'next' }), 403);
  server.setRemote(false);
});

test('the address a phone can reach comes first; VPNs and virtual networks last', () => {
  const v4 = (address) => [{ family: 'IPv4', address, internal: false }];
  const got = lanAddresses({
    Tailscale: v4('100.116.55.58'),
    CloudflareWARP: v4('172.16.0.2'),
    'vEthernet (Default Switch)': v4('192.168.48.1'),
    'vEthernet (VenuLab-External)': v4('192.168.0.25'),
    'Wi-Fi': v4('10.0.0.7'),
    'Loopback Pseudo-Interface 1': [{ family: 'IPv4', address: '127.0.0.1', internal: true }],
    'Ethernet 3': v4('169.254.10.1'),
  });
  assert.deepEqual(got.map((a) => [a.ip, a.kind]), [
    ['192.168.0.25', 'network'], ['10.0.0.7', 'network'], ['192.168.48.1', 'virtual'], ['172.16.0.2', 'vpn'], ['100.116.55.58', 'vpn'],
  ]);
});

test.after(() => server.close());
