const assert = require('node:assert/strict');
const { test, after, afterEach } = require('node:test');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { Module, createRequire } = require('node:module');
const { JSDOM } = require('jsdom');
const ts = require('typescript');

// This is a component test, not browser E2E. Keep React, Ant Design, its Form,
// and the page implementation real; mock only remote services/navigation/toasts.
const dom = new JSDOM('<!doctype html><html><body></body></html>', {
  url: 'http://component.test/', pretendToBeVisual: true,
});
for (const key of ['window', 'document', 'HTMLElement', 'Element', 'Node', 'ShadowRoot', 'SVGElement', 'HTMLInputElement', 'MutationObserver', 'Event', 'MouseEvent']) {
  global[key] = dom.window[key];
}
global.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
global.requestAnimationFrame = dom.window.requestAnimationFrame.bind(dom.window);
global.cancelAnimationFrame = dom.window.cancelAnimationFrame.bind(dom.window);
global.IS_REACT_ACT_ENVIRONMENT = true;
dom.window.matchMedia = () => ({
  matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent() {},
});
global.ResizeObserver = dom.window.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };

// rc-component/form creates native MessageChannels for watcher notifications.
// Track and close their ports at teardown so Node can exit normally.
const NativeMessageChannel = global.MessageChannel;
const channels = [];
global.MessageChannel = class extends NativeMessageChannel {
  constructor() { super(); channels.push(this); }
};
const React = require('react');
const { act } = React;
const { createRoot } = require('react-dom/client');
const antd = require('antd');
let form;
let root;
let container;
let submitted;
let sessionRequests;
let navigation;
let submissionError;
const originalUseForm = antd.Form.useForm;
const originalSuccess = antd.message.success;
const originalError = antd.message.error;
antd.Form.useForm = (...args) => {
  const result = originalUseForm(...args);
  form = result[0];
  return result;
};
antd.message.success = () => {};
antd.message.error = () => {};

const sourcePath = path.resolve(__dirname, '../src/pages/roadshow/create/index.tsx');
const source = readFileSync(sourcePath, 'utf8');
const code = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
}).outputText;
const requireFromPage = createRequire(sourcePath);
const loaded = new Module(sourcePath, module);
loaded.filename = sourcePath;
loaded.paths = Module._nodeModulePaths(path.dirname(sourcePath));
loaded.require = name => {
  if (name === '../../../services/registration') return {
    getOrganizers: async () => ({ data: { list: [{ id: 101, name: 'Organizer A' }, { id: 102, name: 'Organizer B' }] } }),
    getAvailableSessions: async id => {
      sessionRequests.push(id);
      return { data: { list: [{ id: id === 101 ? 201 : 202, name: 'Fixture session', event_date: '2030-01-01' }] } };
    },
    submitRegistration: async values => {
      submitted.push(values);
      if (submissionError) throw submissionError;
      return { data: { id: 301 } };
    },
  };
  if (name === 'react-router-dom') return { useNavigate: () => destination => navigation.push(destination) };
  return requireFromPage(name);
};
loaded._compile(code, sourcePath);
const Page = loaded.exports.default;

async function settle(action = () => {}) {
  await act(async () => {
    await action();
    // Allow native MessageChannel and requestAnimationFrame form notifications.
    await new Promise(resolve => setTimeout(resolve, 40));
  });
}
function visibleButton(label) {
  return [...document.querySelectorAll('button')].find(button => !button.closest('[hidden]') && button.textContent.trim() === label);
}
async function click(label) {
  const button = visibleButton(label);
  assert.ok(button, `Visible button exists: ${label}`);
  await settle(() => button.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })));
}
async function mount() {
  submitted = [];
  sessionRequests = [];
  navigation = [];
  submissionError = undefined;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await settle(() => root.render(React.createElement(Page)));
}
async function performance() {
  // Populate using the real Form API; navigation uses actual React click handlers.
  await settle(() => form.setFieldsValue({ organizer_id: 101 }));
  await settle(() => form.setFieldsValue({
    session_id: 201, song_name: 'QA Song', artist_name: 'QA Artist', group_name: 'QA Team', song_format: 0,
    edited_file_url: 'https://example.test/audio.mp3',
  }));
}
async function members() {
  await settle(() => form.setFieldsValue({
    contact_phone: '13900000000', members: [{ member_name: 'QA Member', position: 'center' }],
    has_other_performance: 1, other_performance_detail: 'Second performance',
  }));
}
async function finalStep() {
  await mount();
  await performance();
  await click('下一步');
  await members();
  await click('下一步');
}
afterEach(async () => {
  if (root) await settle(() => root.unmount());
  container?.remove();
  root = undefined;
});
after(() => {
  antd.Form.useForm = originalUseForm;
  antd.message.success = originalSuccess;
  antd.message.error = originalError;
  global.MessageChannel = NativeMessageChannel;
  channels.forEach(channel => { channel.port1.close(); channel.port2.close(); });
  dom.window.close();
});

test('required performance fields block advancing', async () => {
  await mount();
  await click('下一步');
  assert.equal(visibleButton('上一步'), undefined);
  for (const name of ['organizer_id', 'session_id', 'song_name', 'artist_name', 'group_name', 'song_format']) {
    assert.ok(form.getFieldError(name).length, `${name} has a validation error`);
  }
  assert.equal(submitted.length, 0);
});

test('full values and chosen session survive forward/back navigation and final submit', async () => {
  await mount();
  await performance();
  await click('下一步');
  assert.equal(form.getFieldValue('session_id'), 201);
  await members();
  await click('上一步');
  assert.equal(form.getFieldValue('session_id'), 201);
  assert.deepEqual(sessionRequests, [101]);
  await click('下一步');
  await click('下一步');
  await click('上一步');
  assert.equal(form.getFieldValue('members')[0].member_name, 'QA Member');
  await click('下一步');
  await settle(() => form.setFieldsValue({ additional_requirements: 'A microphone please' }));
  await click('提交报名');
  assert.deepEqual(submitted, [{
    session_id: 201, song_name: 'QA Song', artist_name: 'QA Artist', group_name: 'QA Team', song_format: 0,
    edited_file_url: 'https://example.test/audio.mp3', contact_phone: '13900000000',
    members: [{ member_name: 'QA Member', position: 'center', sort_order: 0 }],
    has_other_performance: 1, other_performance_detail: 'Second performance', additional_requirements: 'A microphone please',
  }]);
  assert.deepEqual(navigation, ['/roadshow/mine']);
  assert.deepEqual(sessionRequests, [101]);
});

test('initial and newly added blank member names block advancing', async () => {
  await mount();
  await performance();
  await click('下一步');
  await settle(() => form.setFieldsValue({ contact_phone: '13900000000' }));
  await click('下一步');
  assert.equal(visibleButton('提交报名'), undefined);
  assert.ok(form.getFieldError(['members', 0, 'member_name']).length);
  await settle(() => form.setFieldsValue({ members: [{ member_name: 'QA Member', position: '' }] }));
  await click('添加成员');
  await click('下一步');
  assert.equal(visibleButton('提交报名'), undefined);
  assert.ok(form.getFieldError(['members', 1, 'member_name']).length);
  await settle(() => form.setFieldsValue({ members: [{ member_name: 'QA Member', position: '' }, { member_name: 'Second Member' }] }));
  await click('下一步');
  await click('提交报名');
  assert.deepEqual(submitted[0].members, [
    { member_name: 'QA Member', position: '', sort_order: 0 },
    { member_name: 'Second Member', position: '', sort_order: 1 },
  ]);
});

test('genuine organizer change clears the session and requires a replacement', async () => {
  await mount();
  await performance();
  await settle(() => form.setFieldsValue({ organizer_id: 102 }));
  assert.equal(form.getFieldValue('session_id'), undefined);
  assert.deepEqual(sessionRequests, [101, 102]);
  await click('下一步');
  assert.equal(visibleButton('上一步'), undefined);
  assert.ok(form.getFieldError('session_id').length);
  await settle(() => form.setFieldsValue({ session_id: 202 }));
  await click('下一步');
  assert.ok(visibleButton('上一步'));
  assert.equal(form.getFieldValue('session_id'), 202);
});

test('final submit revalidates required fields on hidden earlier steps', async () => {
  await finalStep();
  await settle(() => form.setFieldsValue({ song_name: '', members: [{ member_name: '' }] }));
  await click('提交报名');
  assert.equal(submitted.length, 0);
  assert.deepEqual(navigation, []);
  assert.ok(form.getFieldError('song_name').length);
  assert.ok(form.getFieldError(['members', 0, 'member_name']).length);
});

test('failed submission preserves values for a successful retry', async () => {
  await finalStep();
  submissionError = new Error('Fixture service unavailable');
  await click('提交报名');
  assert.equal(submitted.length, 1);
  assert.deepEqual(navigation, []);
  assert.ok(visibleButton('提交报名'));
  assert.equal(form.getFieldValue('session_id'), 201);
  assert.equal(form.getFieldValue('members')[0].member_name, 'QA Member');
  submissionError = undefined;
  await click('提交报名');
  assert.equal(submitted.length, 2);
  assert.deepEqual(submitted[1], submitted[0]);
  assert.deepEqual(navigation, ['/roadshow/mine']);
});
