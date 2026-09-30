import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { User, UserRole } from '../modules/users/entities/user.entity';
import { Session } from '../modules/sessions/entities/session.entity';

/**
 * 存量数据回填脚本（幂等）：
 *  1. 定位 role=1 的管理员（优先 username='admin'，否则最小 id）；不存在则报错提示先跑 seed:admin；
 *  2. 其 organizer_name 为空则置为「系统主办方」；
 *  3. 其 status 为空/0 则置 1；
 *  4. UPDATE sessions SET organizer_id = <adminId> WHERE organizer_id IS NULL；
 *  5. 打印管理员 id、回填行数、剩余 NULL 计数。
 *
 * 仅写脚本，不在此处自动执行；由部署任务显式 `npm run seed:organizer` 触发。
 */
async function seedOrganizer() {
  const dataSource = new DataSource({
    type: 'mysql',
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    entities: [User, Session],
    synchronize: true,
  });

  await dataSource.initialize();
  const userRepo = dataSource.getRepository(User);

  let admin = await userRepo.findOne({ where: { username: 'admin', role: UserRole.ADMIN } });
  if (!admin) {
    admin = await userRepo.findOne({ where: { role: UserRole.ADMIN }, order: { id: 'ASC' } });
  }
  if (!admin) {
    console.error('未找到 role=1 的管理员账号，请先运行 npm run seed:admin 初始化管理员。');
    await dataSource.destroy();
    process.exit(1);
  }

  let changed = false;
  if (!admin.organizer_name) {
    admin.organizer_name = '系统主办方';
    changed = true;
  }
  if (!admin.status) {
    admin.status = 1;
    changed = true;
  }
  if (changed) {
    await userRepo.save(admin);
  }

  const updateResult = await dataSource.query(
    'UPDATE sessions SET organizer_id = ? WHERE organizer_id IS NULL',
    [admin.id],
  );
  const backfilled = Number(updateResult?.affectedRows ?? 0);
  const remainRows = await dataSource.query(
    'SELECT COUNT(*) AS cnt FROM sessions WHERE organizer_id IS NULL',
  );
  const remaining = Number(remainRows?.[0]?.cnt ?? 0);

  console.log('系统主办方（管理员）id:', admin.id);
  console.log('organizer_name:', admin.organizer_name);
  console.log('本次回填场次数:', backfilled);
  console.log('剩余 organizer_id IS NULL 的场次数:', remaining);

  await dataSource.destroy();
}

seedOrganizer().catch((err) => {
  console.error('Seed organizer failed:', err);
  process.exit(1);
});
