import 'reflect-metadata';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { firstValueFrom, of } from 'rxjs';
import { NotificationDraftService } from './notification-draft.service';
import { NotificationDraftController } from './notification-draft.controller';
import { content, exact, render } from './notification-draft.validation';
import { SystemLogService } from '../system-logs/system-log.service';
import { ResponseInterceptor } from '../../common/interceptors/response.interceptor';
import { AllExceptionsFilter } from '../../common/filters/http-exception.filter';
import { RolesGuard } from '../../common/guards/roles.guard';
const alice = { id: 1, role: 2 }, bob = { id: 2, role: 2 }, admin = { id: 3, role: 1 };
const template = () => ({ name: '活动提醒', title: '{{name}} 的活动', body: '你好 {{name}}，剩余 {{count}}', variables: [{ name: 'name', required: true }, { name: 'count', required: false }] });
function fixture() {
  const rows: any[] = [], calls: any[] = [];
  const matches = (row: any, where: any) => Object.entries(where).every(([key, value]) => row[key] === value);
  const repo = {
    create: (input: any) => ({ ...input }),
    save: async (row: any) => {
      if (rows.some(other => other.organizer_id === row.organizer_id && other.name === row.name)) throw { code: 'ER_DUP_ENTRY' };
      row.id = rows.length + 1; rows.push({ ...row }); return { ...row };
    },
    find: async (options: any) => { calls.push(['find', options.where]); return rows.filter(row => matches(row, options.where)).map(row => ({ ...row })); },
    findOne: async (options: any) => { calls.push(['findOne', options.where]); const row = rows.find(row => matches(row, options.where)); return row ? { ...row } : null; },
    update: async (where: any, changes: any) => {
      calls.push(['update', where, changes]);
      const row = rows.find(row => matches(row, where));
      if (!row) return { affected: 0 };
      if (changes.name && rows.some(other => other.id !== row.id && other.organizer_id === row.organizer_id && other.name === changes.name)) throw { driverError: { code: 'ER_DUP_ENTRY' } };
      Object.assign(row, { ...changes, revision: row.revision + 1 }); return { affected: 1 };
    },
  };
  const service = new NotificationDraftService(repo as any);
  return { rows, calls, service, controller: new NotificationDraftController(service) };
}
test('renderer interpolates scalar values, supports repeated placeholders, optional blanks and literal HTML', () => {
  assert.deepEqual(render(template(), { name: '<b>A</b>', count: 0 }), { title: '<b>A</b> 的活动', body: '你好 <b>A</b>，剩余 0', preview_only: true });
  assert.equal(render(template(), { name: 'Alice', count: false }).body, '你好 Alice，剩余 false');
  assert.equal(render(template(), { name: 'Alice' }).body, '你好 Alice，剩余 ');
});
test('strict validation rejects forged fields, duplicate declarations, invalid and undeclared placeholders', () => {
  for (const field of ['organizer_id', 'id', 'status', 'revision', 'created_by', 'updated_by', 'created_at', 'updated_at', 'send']) {
    assert.throws(() => exact({ ...template(), [field]: 1 }, ['name', 'title', 'body', 'variables']), BadRequestException);
  }
  const invalid = [
    { ...template(), variables: [{ name: 'name', required: true }, { name: 'name', required: false }] },
    { ...template(), title: '{{user.name}}' }, { ...template(), title: '{{name + 1}}' },
    { ...template(), title: '{{unknown}}' }, { ...template(), title: '{{name}' },
    { ...template(), title: '{{name}} }}}' }, { ...template(), name: '  ' },
    { ...template(), title: 'x'.repeat(121) }, { ...template(), body: 'x'.repeat(2001) },
    ...['constructor', '__proto__', 'prototype', 'toString', 'name.x'].map(name => ({ ...template(), variables: [{ name, required: true }] })),
    { ...template(), variables: [{ name: 'name', required: 'true' }] },
    { ...template(), variables: [{ name: 'name', required: true, example: 'secret' }] },
  ];
  invalid.forEach(value => assert.throws(() => content(value as any), BadRequestException));
});
test('preview rejects missing required values, nonscalar/prototype/undeclared data and expanded length overflow', () => {
  const invalid: any[] = [{}, { name: '' }, { name: null }, { name: {} }, { name: [] }, { name: Infinity }, { name: 'A', extra: 1 }, JSON.parse('{"name":"A","__proto__":"secret"}'), Object.create({ name: 'inherited' }), { name: 'x'.repeat(120) }];
  invalid.forEach(values => assert.throws(() => render(template(), values), BadRequestException));
});
test('management roles only, including direct service calls; guest/ordinary/anonymous fail closed', async () => {
  const { service, controller } = fixture();
  for (const actor of [undefined, { id: 1, role: 0 }, { id: 1, role: 2, is_guest: 1 }, { id: 1, role: '1' }, { id: 0, role: 1 }]) {
    assert.throws(() => service.list(actor as any), ForbiddenException);
    await assert.rejects(controller.create(template(), actor as any), ForbiddenException);
    await assert.rejects(service.preview(1, { revision: 1, values: {} }, actor as any), ForbiddenException);
  }
  const guard = new RolesGuard(new Reflector());
  for (const role of [0, 1, 2, undefined]) {
    const context = { getHandler: () => controller.list, getClass: () => NotificationDraftController, switchToHttp: () => ({ getRequest: () => ({ user: { role } }) }) };
    assert.equal(guard.canActivate(context as any), role === 1 || role === 2);
  }
});
test('owner assigned by server; every cross-owner action returns 404 even for admin', async () => {
  const { controller, service, calls } = fixture();
  const row = await controller.create(template(), alice);
  assert.equal(row.organizer_id, alice.id); assert.equal(row.created_by, alice.id); assert.equal(row.updated_by, alice.id); assert.equal(row.revision, 1); assert.equal(row.status, 'draft');
  for (const actor of [bob, admin]) {
    assert.deepEqual(await controller.list(actor), []);
    for (const invoke of [() => controller.get(row.id, actor), () => controller.update(row.id, { ...template(), revision: 1 }, actor), () => controller.archive(row.id, { revision: 1 }, actor), () => controller.restore(row.id, { revision: 1 }, actor), () => controller.preview(row.id, { revision: 1, values: { name: 'Alice' } }, actor)]) await assert.rejects(invoke(), NotFoundException);
  }
  assert.ok(calls.every(([, where]) => Number.isInteger(where.organizer_id)));
  await service.create(template(), admin); // same name in another account is valid
});
test('duplicate name fails closed and forged ownership/audit/status fields are rejected', async () => {
  const { service } = fixture(); const row = await service.create(template(), alice);
  await assert.rejects(service.create(template(), alice), ConflictException);
  for (const field of ['organizer_id', 'created_by', 'updated_by', 'status', 'id']) {
    await assert.rejects(service.create({ ...template(), [field]: 2 }, alice), BadRequestException);
    await assert.rejects(service.update(row.id, { ...template(), revision: 1, [field]: 2 }, alice), BadRequestException);
  }
  await assert.rejects(service.archive(row.id, { revision: 1, status: 'sent' }, alice, 'archived'), BadRequestException);
  await service.create({ ...template(), name: 'another' }, alice);
  await assert.rejects(service.update(row.id, { ...template(), name: 'another', revision: 1 }, alice), ConflictException);
});
test('atomic compare-and-swap allows one concurrent edit and preserves audit/status lifecycle', async () => {
  const { service, calls } = fixture(); const row = await service.create(template(), alice);
  const results = await Promise.allSettled([service.update(row.id, { ...template(), revision: 1 }, alice), service.update(row.id, { ...template(), name: 'Other', revision: 1 }, alice)]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(results.filter(r => r.status === 'rejected' && r.reason instanceof ConflictException).length, 1);
  assert.ok(calls.filter(([operation]) => operation === 'update').every(([, where, changes]) => where.organizer_id === 1 && where.revision === 1 && where.status === 'draft' && typeof changes.revision === 'function'));
  const archived = await service.archive(row.id, { revision: 2 }, alice, 'archived'); assert.equal(archived.revision, 3); assert.equal(archived.status, 'archived');
  await assert.rejects(service.update(row.id, { ...template(), revision: 3 }, alice), ConflictException);
  const restored = await service.archive(row.id, { revision: 3 }, alice, 'draft'); assert.equal(restored.revision, 4); assert.equal(restored.created_by, 1); assert.equal(restored.updated_by, 1);
  await assert.rejects(service.archive(row.id, { revision: 3 }, alice, 'archived'), ConflictException);
});
test('preview is read only, revision-bound, strict and never saves example values', async () => {
  const { service, rows, calls } = fixture(); const row = await service.create(template(), alice); const snapshot = JSON.stringify(rows);
  assert.equal((await service.preview(row.id, { revision: 1, values: { name: 'private example' } }, alice)).preview_only, true);
  assert.equal(JSON.stringify(rows), snapshot); assert.ok(calls.every(([operation]) => operation !== 'update'));
  await assert.rejects(service.preview(row.id, { revision: 2, values: { name: 'A' } }, alice), ConflictException);
  await assert.rejects(service.preview(row.id, { revision: 1, values: { name: 'A' }, recipients: [1] }, alice), BadRequestException);
  for (const revision of [0, -1, 1.1, '1', null, 4294967295]) await assert.rejects(service.preview(row.id, { revision, values: { name: 'A' } }, alice), BadRequestException);
});
test('success and failure system logging never persists draft or preview payloads, query strings or error stacks', async () => {
  const saved: any[] = []; const logs = new SystemLogService({ create: (x: any) => x, save: async (x: any) => saved.push(x) } as any);
  const interceptor = new ResponseInterceptor(new Reflector(), logs), filter = new AllExceptionsFilter(logs);
  for (const path of ['/api/v1/admin/notification-drafts/1/preview?secret=x', '/api/v1/admin/notification-drafts', '/api/v1/admin/NOTIFICATION-DRAFTS/1/preview/', '/api/v1/admin/notification%2Ddrafts/1/preview']) {
    const req = { originalUrl: path, method: 'POST', body: { values: { personal: 'PRIVATE' } }, query: { personal: 'PRIVATE' }, headers: {} };
    const res: any = { statusCode: 200, status: () => res, json: () => undefined };
    const http = { getRequest: () => req, getResponse: () => res };
    await firstValueFrom(interceptor.intercept({ switchToHttp: () => http, getHandler: () => () => {} } as any, { handle: () => of({ title: 'PRIVATE' }) }));
    filter.catch(new Error('PRIVATE'), { switchToHttp: () => http } as any);
  }
  assert.deepEqual(saved, []);
  await logs.createFromRequest({ url: '/api/v1/unrelated', headers: {}, method: 'GET' } as any, { level: 'info', type: 'api_request', message: 'ok' });
  assert.equal(saved.length, 1);
});
