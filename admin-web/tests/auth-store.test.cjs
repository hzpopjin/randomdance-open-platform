const assert = require('node:assert/strict');
const { test } = require('node:test');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function fixture(initial = {}) {
  const entries = new Map(Object.entries(initial));
  const localStorage = { getItem: key => entries.get(key) ?? null,
    setItem: (key, value) => entries.set(key, value), removeItem: key => entries.delete(key) };
  const calls = [];
  let resolveGuest;
  let resolveProfile;
  const api = { guestLogin: (...args) => { calls.push(args); return new Promise(resolve => { resolveGuest = resolve; }); },
    login: async () => ({ data: { token: 'registered-token', user: { id: 2, role: 0 } } }),
    logout: async () => {}, getProfile: () => new Promise(resolve => { resolveProfile = resolve; }) };
  const exports = {};
  vm.runInNewContext(ts.transpileModule(readFileSync('src/stores/authStore.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText, { exports, localStorage, window: { location: { href: '' } },
    crypto: { randomUUID: () => 'test-device' }, require: name => name === 'zustand' ? require(name) : api });
  return { store: exports.useAuthStore, entries, calls,
    finishGuest: () => resolveGuest({ data: { token: 'guest-token', user: { id: 1, role: 0 }, guest_id: 1, guest_secret: 'a'.repeat(64) } }),
    finishProfile: () => resolveProfile({ data: { id: 1, role: 0 } }) };
}

test('concurrent first visits share one request and persist the proof', async () => {
  const f = fixture();
  const a = f.store.getState().guestLogin();
  const b = f.store.getState().guestLogin();
  assert.equal(f.calls.length, 1);
  f.finishGuest();
  assert.deepEqual(await Promise.all([a, b]), [true, true]);
  assert.equal(JSON.parse(f.entries.get('guest_credential_v2')).guest_secret, 'a'.repeat(64));
  const resumed = f.store.getState().guestLogin();
  assert.equal(f.calls[1][1].guest_id, 1);
  f.finishGuest();
  await resumed;
});

test('explicit logout forgets proof and ignores a late guest response', async () => {
  const f = fixture({ guest_credential_v2: JSON.stringify({ guest_id: 1, guest_secret: 'a'.repeat(64) }) });
  const pending = f.store.getState().guestLogin();
  f.store.getState().logout();
  f.finishGuest();
  assert.equal(await pending, false);
  assert.equal(f.entries.has('guest_credential_v2'), false);
  assert.equal(f.entries.has('admin_token'), false);
  assert.equal(f.store.getState().user, null);
});

test('late guest response cannot overwrite a registered login', async () => {
  const f = fixture();
  const pending = f.store.getState().guestLogin();
  await f.store.getState().login('alice', 'password');
  f.finishGuest();
  assert.equal(await pending, false);
  assert.equal(f.store.getState().token, 'registered-token');
  assert.equal(f.entries.has('guest_credential_v2'), false);
});

test('late profile response cannot restore a logged-out identity', async () => {
  const f = fixture({ admin_token: 'old-token' });
  const pending = f.store.getState().fetchProfile();
  f.store.getState().logout();
  f.finishProfile();
  await pending;
  assert.equal(f.store.getState().user, null);
});
