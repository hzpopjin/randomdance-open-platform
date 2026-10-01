const assert = require('node:assert/strict');
const { test } = require('node:test');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(path, requireFn = require) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }
  }).outputText, { exports, require: requireFn });
  return exports;
}
const utils = load('src/utils/notificationDrafts.ts');
const valid = () => ({ name: '活动提醒', title: '{{event_name}}', body: '欢迎 {{event_name}}', variables: [{ name: 'event_name', required: true }] });

test('draft validates limits, declared placeholders, safe unique names and max30 variables', () => {
  assert.equal(utils.validateNotificationDraft(valid()), undefined);
  for (const name of ['__proto__', 'prototype', 'constructor', 'toString', 'hasOwnProperty', '_event', 'event.name', 'a'.repeat(41)]) {
    assert.equal(utils.isNotificationVariableName(name), false, name);
  }
  for (const name of ['event', 'event_1', 'A'.repeat(40)]) assert.equal(utils.isNotificationVariableName(name), true);
  for (const [key, length] of [['name',81], ['title',121], ['body',2001]]) assert.ok(utils.validateNotificationDraft({ ...valid(), [key]: 'x'.repeat(length) }));
  assert.ok(utils.validateNotificationDraft({ ...valid(), name: '  ' }));
  assert.ok(utils.validateNotificationDraft({ ...valid(), variables: [...valid().variables, ...valid().variables] }));
  assert.ok(utils.validateNotificationDraft({ ...valid(), title: '{{missing}}' }));
  assert.ok(utils.validateNotificationDraft({ ...valid(), title: '{{event_name' }));
  assert.ok(utils.validateNotificationDraft({ ...valid(), variables: Array.from({length:31}, (_,i) => ({name:`v${i}`, required:false})) }));
});

test('preview accepts only declared own scalar values, preserves false/zero, rejects empty required values', () => {
  const variables = [{name:'name', required:true}, {name:'count', required:false}, {name:'active', required:false}, {name:'optional', required:false}];
  const result = utils.buildPreviewValues(variables, {name:'<img src=x onerror=alert(1)>', count:0, active:false, extra:'ignored'});
  assert.equal(Object.getPrototypeOf(result), null);
  assert.deepEqual(JSON.parse(JSON.stringify(result)), {name:'<img src=x onerror=alert(1)>', count:0, active:false});
  for (const value of ['', '  ', undefined, null, {}, [], Infinity, 'x'.repeat(2001)]) assert.throws(() => utils.buildPreviewValues([{name:'name', required:true}], {name:value}));
  assert.throws(() => utils.buildPreviewValues([{name:'name', required:true}], Object.create({name:'inherited'})));
  assert.throws(() => utils.buildPreviewValues([{name:'constructor', required:false}], {}));
});

test('request generations suppress dismissed and older async results', async () => {
  const gate = utils.createDraftRequestGate();
  const first = gate.next();
  assert.equal(gate.current(first), true);
  const second = gate.next();
  assert.equal(gate.current(first), false);
  assert.equal(gate.current(second), true);
  gate.invalidate();
  assert.equal(gate.current(second), false);
  const third = gate.next();
  assert.equal(gate.current(third), true);
});

test('service exposes only bounded draft lifecycle endpoints with revisions', async () => {
  const calls = [];
  const request = Object.fromEntries(['get','post','put'].map(method => [method, async (...args) => { calls.push([method, ...args]); return {data:[]}; }]));
  const api = load('src/services/notification-drafts.ts', () => request);
  await api.getNotificationDrafts();
  await api.createNotificationDraft(valid());
  await api.updateNotificationDraft(7, valid(), 3);
  await api.archiveNotificationDraft(7, 4);
  await api.restoreNotificationDraft(7, 5);
  await api.previewNotificationDraft(7, 6, {event_name:'活动'});
  assert.deepEqual(calls.map(c=>c.slice(0,2)), [['get','/admin/notification-drafts'],['post','/admin/notification-drafts'],['put','/admin/notification-drafts/7'],['post','/admin/notification-drafts/7/archive'],['post','/admin/notification-drafts/7/restore'],['post','/admin/notification-drafts/7/preview']]);
  assert.deepEqual(calls.slice(2).map(c=>c[2].revision), [3,4,5,6]);
  assert.equal(Object.keys(api).length, 6);
});

test('page route and menu are role guarded; rendering stays text-only and identity scoped', () => {
  const page = readFileSync('src/pages/notification-drafts/index.tsx','utf8');
  const routes = readFileSync('src/config/routes.tsx','utf8');
  const menu = readFileSync('src/components/layout/AdminLayout.tsx','utf8');
  assert.match(routes, /path: 'notification-drafts', element: <RequireRole roles=\{\[1, 2\]\}/);
  assert.equal((menu.match(/key: '\/admin\/notification-drafts'/g) || []).length, 2);
  assert.match(page, /key=\{`\$\{user.id\}:\$\{user.role\}:\$\{token\}`\}/);
  assert.match(page, /auth.token === identity.token && auth.user\?\.id === identity.id/);
  assert.doesNotMatch(page, /dangerouslySetInnerHTML|innerHTML|sendNotification|recipient|schedule/);
  assert.match(page, /仅预览，不会发送/);
});

function boundaryFixture() {
  let auth = { token: 'token-a', user: { id: 11, role: 2 } };
  let cleanup;
  const exports = {};
  const source = readFileSync('src/pages/notification-drafts/index.tsx', 'utf8').replace('function useRequestBoundary(', 'export function useRequestBoundary(');
  vm.runInNewContext(ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX }
  }).outputText, { exports, require: name => {
    if (name === 'react') return {
      useState: initial => [typeof initial === 'function' ? initial() : initial, () => {}],
      useRef: value => ({ current: value }), useCallback: fn => fn,
      useEffect: effect => { cleanup = effect(); },
    };
    if (name.endsWith('/authStore')) return { useAuthStore: { getState: () => auth } };
    if (name.endsWith('/role')) return { canAccessAdmin: role => [1, 2].includes(Number(role)) };
    if (name.endsWith('/notificationDrafts')) return utils;
    return {};
  } });
  const boundary = exports.useRequestBoundary({ id: 11, role: 2, token: 'token-a' });
  return { boundary, setAuth: value => { auth = value; }, unmount: () => cleanup() };
}

test('actual page boundary refuses late responses after identity, token or permission changes', () => {
  for (const next of [
    { token:'token-b', user:{id:22,role:2} },
    { token:'token-b', user:{id:11,role:2} },
    { token:'token-a', user:{id:11,role:0} },
    { token:null,user:null },
  ]) {
    const f = boundaryFixture();
    const ticket = f.boundary.gate.next();
    assert.equal(f.boundary.current(ticket), true);
    f.setAuth(next);
    assert.equal(f.boundary.current(ticket), false);
  }
});

test('actual page boundary refuses late responses after modal dismissal or unmount', () => {
  const f = boundaryFixture();
  const ticket = f.boundary.gate.next();
  f.boundary.gate.invalidate();
  assert.equal(f.boundary.current(ticket), false);
  const newer = f.boundary.gate.next();
  assert.equal(f.boundary.current(newer), true);
  f.unmount();
  assert.equal(f.boundary.current(newer), false);
});

test('preview input changes unlock pending work and ignore its late response', async () => {
  const exports = {};
  const setters = [];
  const state = [];
  const requests = [];
  const Form = Object.assign('form', { Item: 'form-item' });
  const source = readFileSync('src/pages/notification-drafts/index.tsx', 'utf8').replace('function PreviewDialog(', 'export function PreviewDialog(');
  vm.runInNewContext(ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX }
  }).outputText, { exports, require: name => {
    if (name === 'react') return {
      useState: initial => { const index = state.length; state.push(typeof initial === 'function' ? initial() : initial); setters.push(value => { state[index] = value; }); return [state[index], setters[index]]; },
      useRef: current => ({current}), useCallback: fn => fn, useEffect: effect => { effect(); },
    };
    if (name === 'react/jsx-runtime') return {jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})};
    if (name === 'antd') return { Form, Input:'input', Alert:'alert', Modal:'modal', Button:'button', Card:'card', Typography:{} };
    if (name.endsWith('/authStore')) return {useAuthStore:{getState:()=>({token:'a',user:{id:11,role:2}})}};
    if (name.endsWith('/role')) return {canAccessAdmin:()=>true};
    if (name.endsWith('/notificationDrafts')) return utils;
    if (name.endsWith('/notification-drafts')) return {previewNotificationDraft:()=>new Promise(resolve=>requests.push(resolve))};
    return {};
  } });
  const tree = exports.PreviewDialog({identity:{id:11,role:2,token:'a'},draft:{...valid(),id:7,revision:1},close:()=>{},refresh:()=>{}});
  const form = tree.props.children.find(child => child && child.type === Form);
  const first = form.props.onFinish({event_name:'first'});
  assert.equal(requests.length, 1);
  assert.equal(state[0], true);
  form.props.onValuesChange();
  assert.equal(state[0], false);
  const second = form.props.onFinish({event_name:'second'});
  assert.equal(requests.length, 2);
  requests[0]({data:{title:'stale',body:'old',preview_only:true}});
  await first;
  assert.equal(state[2], null);
  requests[1]({data:{title:'current',body:'new',preview_only:true}});
  await second;
  assert.equal(state[2].title, 'current');
  assert.equal(state[0], false);
});
