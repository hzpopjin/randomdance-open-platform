const assert = require('node:assert/strict');
const { test } = require('node:test');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function fixture() {
  const entries = new Map([['admin_token', 'old-token']]);
  const localStorage = { getItem: key => entries.get(key) ?? null,
    setItem: (key, value) => entries.set(key, value), removeItem: key => entries.delete(key) };
  const window = { location: { href: '/playlist/mine' } };
  const handlers = {};
  const client = { interceptors: {
    request: { use: fn => { handlers.request = fn; } },
    response: { use: (success, failure) => { handlers.success = success; handlers.failure = failure; } },
  } };
  const source = readFileSync('src/utils/request.ts', 'utf8').replace('import.meta.env.VITE_API_BASE_URL', 'undefined');
  vm.runInNewContext(ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }
  }).outputText, { exports: {}, localStorage, window, require: () => ({ create: () => client, AxiosHeaders: require('axios').AxiosHeaders }) });
  const config = handlers.request({ url: '/auth/profile', headers: {} });
  return { entries, window, handlers, config };
}

test('stale profile 401 after new login preserves the new session and location', async () => {
  const f = fixture();
  f.entries.set('admin_token', 'new-login-token');
  await assert.rejects(f.handlers.failure({ response: { status: 401 }, config: f.config }));
  assert.equal(f.entries.get('admin_token'), 'new-login-token');
  assert.equal(f.window.location.href, '/playlist/mine');
});

test('current session 401 clears its token and redirects to login', async () => {
  const f = fixture();
  await assert.rejects(f.handlers.failure({ response: { status: 401 }, config: f.config }));
  assert.equal(f.entries.has('admin_token'), false);
  assert.equal(f.window.location.href, '/login');
});

test('guest proof 401 does not clear an existing session', async () => {
  const f = fixture();
  f.config.url = '/auth/guest';
  await assert.rejects(f.handlers.failure({ response: { status: 401 }, config: f.config }));
  assert.equal(f.entries.get('admin_token'), 'old-token');
  assert.equal(f.window.location.href, '/playlist/mine');
});

test('unauthenticated or post-logout responses cannot redirect or erase a newer session', async () => {
  const f = fixture();
  await assert.rejects(f.handlers.failure({ response: { status: 401 }, config: { headers: {} } }));
  assert.equal(f.entries.get('admin_token'), 'old-token');
  f.entries.delete('admin_token');
  await assert.rejects(f.handlers.failure({ response: { status: 401 }, config: f.config }));
  assert.equal(f.window.location.href, '/playlist/mine');
});

test('business expiry code respects the same request session boundary', async () => {
  const f = fixture();
  f.entries.set('admin_token', 'new-login-token');
  await assert.rejects(f.handlers.success({ data: { code: 10002 }, config: f.config }));
  assert.equal(f.entries.get('admin_token'), 'new-login-token');
  const currentConfig = f.handlers.request({ headers: {} });
  await assert.rejects(f.handlers.success({ data: { code: 10002 }, config: currentConfig }));
  assert.equal(f.entries.has('admin_token'), false);
});
