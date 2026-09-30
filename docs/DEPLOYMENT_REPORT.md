# 部署报告

## 部署信息

| 项目 | 值 |
|------|-----|
| 域名 | chaojifather.me |
| 服务器 | 现有服务器（宝塔面板） |
| 数据库 | MySQL - chaojifather_me |
| 后端端口 | 3002 (PM2: chaojifather-api) |
| 前端 | Nginx 静态文件 (admin-web/dist) |
| 部署日期 | 2026-08-04 |

## 部署步骤记录

### 1. 后端部署
- 创建 NestJS 项目结构，编写全部后端代码
- 安装依赖：`npm install` (502 packages)
- 编译：`npm run build` -> `dist/`
- 创建数据库表：TypeORM `synchronize: true` 自动创建
- 种子管理员：`node dist/scripts/seed-admin.js` (admin / admin123)
- PM2 启动：`pm2 start dist/main.js --name chaojifather-api`
- PM2 持久化：`pm2 save` + `pm2 startup`

### 2. 前端部署
- 创建 React + Vite 项目，编写全部前端代码
- 安装依赖：`npm install` (132 packages)
- 构建：`npm run build` -> `dist/`
- 设置权限：`chown -R www:www dist && chmod -R 755 dist`

### 3. Nginx 配置
- 修改 `/www/server/panel/vhost/nginx/chaojifather.me.conf`
- root 指向 `admin-web/dist`
- 添加 `/api/v1` -> `http://127.0.0.1:3002` 代理
- 添加 `/uploads` -> `http://127.0.0.1:3002` 代理
- 添加 `/fa-api` -> FastAPI 音源服务代理
- 添加 SPA 路由 `try_files $uri $uri/ /index.html`
- 移除 PHP 配置
- `nginx -t` 验证通过，`nginx -s reload` 重载

### 4. 数据库

| 表名 | 说明 |
|------|------|
| users | 用户表（本地注册） |
| sessions | 活动场次 |
| roadshow_registrations | 路演报名 |
| registration_members | 报名成员 |
| submissions | 歌单投稿 |
| submission_songs | 投稿歌曲 |
| songs | 本地歌曲库 |
| system_logs | 系统日志 |
| client_events | 客户端事件 |
| client_config | 云端配置 |

## 验证测试结果

| 测试项 | 结果 |
|--------|------|
| 首页加载 | ✅ HTTP 200 |
| 用户注册 | ✅ 返回 JWT |
| 用户登录 | ✅ 返回 JWT |
| 管理员登录 | ✅ 返回 JWT |
| 创建场次 | ✅ |
| 路演报名提交 | ✅ |
| 歌单投稿提交 | ✅ |
| 报名审核 | ✅ |
| 投稿审核 | ✅ |
| 报名导出 Excel | ✅ |
| 投稿导出 Excel | ✅ |
| 投稿统计 | ✅ |
| 仪表盘统计 | ✅ |
| FastAPI 歌曲查询 | ✅ |
| 系统日志记录 | ✅ |

## PM2 进程

```
┌────┬─────────────────────┬─────────┬──────────┐
│ id │ name                │ status  │ port     │
├────┼─────────────────────┼─────────┼──────────┤
│ 1  │ chaojifather-api    │ online  │ 3002     │
└────┴─────────────────────┴─────────┴──────────┘
```

## 后续维护

- 修改后端代码后：`cd backend && npm run build && pm2 restart chaojifather-api`
- 修改前端代码后：`cd admin-web && npm run build`
- 数据库备份：`mysqldump -u chaojifather_me -p chaojifather_me > backup.sql`
- 修改管理员密码：登录后在个人信息页修改
- JWT_SECRET 变更后所有用户需重新登录

## 与原平台的对比

本平台完整复刻了 apps.randomdance.cn 的核心功能（路演报名 + 歌单投稿），
设计风格一致，但：
1. 去除了 WordPress 依赖，使用独立用户系统
2. 去除了积分系统
3. 去除了支付/直拍/短信/微信通知等功能
4. 保留了 FastAPI 音源服务集成
5. 保留了系统日志、客户端事件、云端配置等运维功能
6. 新增了用户注册功能（原平台依赖 WordPress 注册）
7. 设计为可独立部署、开源使用
