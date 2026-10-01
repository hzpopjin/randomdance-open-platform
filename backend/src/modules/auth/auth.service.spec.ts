import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { User, UserRole } from '../users/entities/user.entity';
import { JWT_IDENTITY_VERSION } from './auth.constants';
import { SystemLogService } from '../system-logs/system-log.service';

function fixture() {
  const users: User[] = [];
  const repo = {
    findOne: async ({ where }: { where: Partial<User> }) =>
      users.find((user) => Object.entries(where).every(([key, value]) => user[key] === value)) ?? null,
    create: (input: Partial<User>) => ({ status: 1, is_guest: 0, ...input } as User),
    save: async (user: User) => {
      if (!user.id) user.id = users.length + 1;
      users.push(user);
      return user;
    },
  };
  const jwt = new JwtService({ secret: 'test-only-secret', signOptions: { expiresIn: '1h' } });
  const service = new AuthService(repo as any, jwt);
  const strategy = new JwtStrategy({ get: () => 'test-only-secret' } as any, repo as any);
  return { users, service, jwt, strategy };
}

test('guessed ordinary, organizer, admin and old guest identifiers never resume an account', async () => {
  const { users, service } = fixture();
  for (const [username, role] of [
    ['alice', UserRole.USER], ['organizer', UserRole.ORGANIZER],
    ['admin', UserRole.ADMIN], ['guest_dev_predictable', UserRole.USER],
  ] as const) {
    users.push({ id: users.length + 1, username, role, status: 1, is_guest: 0,
      password: 'old-hash' } as User);
    const result = await service.guestLogin({ device_id: username });
    assert.notEqual(result.user.id, users.find((u) => u.username === username)!.id);
    assert.equal(result.user.role, UserRole.USER);
  }
});

test('guest resume requires the server-issued secret, not guest ID or device ID', async () => {
  const { service } = fixture();
  const first = await service.guestLogin({ device_id: 'dev_123' });
  assert.match(first.guest_secret, /^[a-f0-9]{64}$/);
  assert.equal(first.user.role, UserRole.USER);
  const resumed = await service.guestLogin({ guest_id: first.guest_id, guest_secret: first.guest_secret });
  assert.equal(resumed.user.id, first.user.id);
  await assert.rejects(service.guestLogin({ guest_id: first.guest_id, guest_secret: '0'.repeat(64) }), UnauthorizedException);
  await assert.rejects(service.guestLogin({ guest_id: first.guest_id }), UnauthorizedException);
  const another = await service.guestLogin({ device_id: 'dev_123' });
  assert.notEqual(another.user.id, first.user.id);
});

test('a guessed guest prefix cannot resume a legacy account', async () => {
  const { users, service } = fixture();
  users.push({ id: 1, username: 'guest_known-device', role: UserRole.USER,
    is_guest: 0, status: 1, password: 'legacy' } as User);
  const result = await service.guestLogin({ device_id: 'known-device' });
  assert.notEqual(result.user.id, 1);
  await assert.rejects(service.guestLogin({ guest_id: 1, guest_secret: 'a'.repeat(64) }), UnauthorizedException);
});

test('legacy JWTs, including ones issued to privileged accounts, are rejected', async () => {
  const { users, strategy } = fixture();
  users.push({ id: 1, username: 'admin', role: UserRole.ADMIN, is_guest: 0, status: 1 } as User);
  assert.equal(JWT_IDENTITY_VERSION, 2);
  await assert.rejects(strategy.validate({ sub: 1, role: UserRole.ADMIN, identityVersion: 1 }), UnauthorizedException);
  const current = await strategy.validate({ sub: 1, role: UserRole.ADMIN, identityVersion: 2 });
  assert.equal(current.role, UserRole.ADMIN);
});

test('disabled and role-elevated guest identities cannot resume', async () => {
  const { users, service, strategy } = fixture();
  const guest = await service.guestLogin();
  users.find((u) => u.id === guest.guest_id)!.status = 0;
  await assert.rejects(service.guestLogin({ guest_id: guest.guest_id, guest_secret: guest.guest_secret }), UnauthorizedException);
  users.find((u) => u.id === guest.guest_id)!.status = 1;
  users.find((u) => u.id === guest.guest_id)!.role = UserRole.ORGANIZER;
  await assert.rejects(service.guestLogin({ guest_id: guest.guest_id, guest_secret: guest.guest_secret }), UnauthorizedException);
  await assert.rejects(strategy.validate({ sub: guest.guest_id, identityVersion: 2 }), UnauthorizedException);
});

test('a guest proof cannot resume a registered, organizer or admin account', async () => {
  const { users, service } = fixture();
  const guest = await service.guestLogin();
  for (const role of [UserRole.USER, UserRole.ORGANIZER, UserRole.ADMIN]) {
    const target = { id: users.length + 1, username: `target_${role}`, role,
      is_guest: 0, status: 1, password: users[0].password } as User;
    users.push(target);
    await assert.rejects(service.guestLogin({ guest_id: target.id, guest_secret: guest.guest_secret }), UnauthorizedException);
  }
});

test('guest proof is absent from profile and system request/response logs', async () => {
  const { service } = fixture();
  const guest = await service.guestLogin();
  const profile = await service.getProfile(guest.guest_id);
  assert.equal(JSON.stringify(profile).includes(guest.guest_secret), false);
  const saved: any[] = [];
  const logs = new SystemLogService({ create: (data: any) => data, save: async (data: any) => saved.push(data) } as any);
  await logs.createFromRequest({ method: 'POST', originalUrl: '/api/v1/auth/guest',
    headers: {}, body: { guest_secret: guest.guest_secret }, query: {} } as any,
  { level: 'info', type: 'api_request', message: 'success', response_payload: guest });
  assert.equal(JSON.stringify(saved).includes(guest.guest_secret), false);
});

test('concurrent first visits create separate identities and parallel resume is stable', async () => {
  const { service } = fixture();
  const created = await Promise.all(Array.from({ length: 8 }, () => service.guestLogin({ device_id: 'same-device' })));
  assert.equal(new Set(created.map((item) => item.guest_id)).size, 8);
  const resumed = await Promise.all(Array.from({ length: 8 }, () => service.guestLogin({
    guest_id: created[0].guest_id, guest_secret: created[0].guest_secret,
  })));
  assert.ok(resumed.every((item) => item.guest_id === created[0].guest_id));
});

test('new proofs are hashed and cannot be used through password login or converted by profile edit', async () => {
  const { users, service, jwt } = fixture();
  const guest = await service.guestLogin();
  assert.notEqual(users[0].password, guest.guest_secret);
  assert.match(users[0].password, /^\$2[aby]\$10\$/);
  assert.equal(jwt.verify(guest.token).identityVersion, 2);
  await assert.rejects(service.login({ username: guest.user.username, password: guest.guest_secret }), UnauthorizedException);
  await assert.rejects(service.updateProfile(guest.guest_id, { password: 'replacement-password' }), UnauthorizedException);
  assert.equal((await service.guestLogin({ guest_id: guest.guest_id, guest_secret: guest.guest_secret })).guest_id, guest.guest_id);
});

test('malformed proofs fail closed without creating an identity', async () => {
  const { users, service } = fixture();
  for (const input of [
    { guest_secret: 'a'.repeat(64) }, { guest_id: 0, guest_secret: 'a'.repeat(64) },
    { guest_id: '1', guest_secret: 'a'.repeat(64) }, { guest_id: 1.5, guest_secret: 'a'.repeat(64) },
    { guest_id: 1, guest_secret: null }, { guest_id: 1, guest_secret: 'short' },
    { guest_id: 999, guest_secret: 'a'.repeat(64) },
  ]) await assert.rejects(service.guestLogin(input as any), UnauthorizedException);
  assert.equal(users.length, 0);
});

test('JWT identity version must be current and authorization uses live database roles', async () => {
  const { users, strategy } = fixture();
  users.push({ id: 1, username: 'ordinary', role: UserRole.USER, is_guest: 0, status: 1 } as User);
  for (const identityVersion of [undefined, null, 0, 1, '2', 3]) {
    await assert.rejects(strategy.validate({ sub: 1, identityVersion }), UnauthorizedException);
  }
  assert.equal((await strategy.validate({ sub: 1, identityVersion: 2, role: UserRole.ADMIN })).role, UserRole.USER);
});

test('guest roles cannot be promoted and role management stays superadmin-only', async () => {
  const { AdminUserController } = await import('../admin/admin-user.controller');
  const { ROLES_KEY } = await import('../../common/decorators/roles.decorator');
  const { RolesGuard } = await import('../../common/guards/roles.guard');
  const { Reflector } = await import('@nestjs/core');
  const { service, users } = fixture();
  const guest = await service.guestLogin();
  let saved = false;
  const controller = new AdminUserController({ findOne: async () => users[0], save: async () => { saved = true; } } as any);
  for (const role of [UserRole.ADMIN, UserRole.ORGANIZER]) {
    await assert.rejects(controller.updateRole(999, String(guest.guest_id), { role, organizer_name: 'Organizer' }));
  }
  assert.equal(saved, false);
  assert.deepEqual(Reflect.getMetadata(ROLES_KEY, AdminUserController), [UserRole.ADMIN]);
  const guard = new RolesGuard(new Reflector());
  for (const role of [UserRole.USER, UserRole.ORGANIZER, UserRole.ADMIN]) {
    assert.equal(guard.canActivate({ getHandler: () => controller.updateRole,
      getClass: () => AdminUserController, switchToHttp: () => ({ getRequest: () => ({ user: { role } }) }) } as any), role === UserRole.ADMIN);
  }
});
