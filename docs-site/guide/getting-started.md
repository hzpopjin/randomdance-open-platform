# 快速开始 / 部署

本页介绍开放平台的后端、前端部署方式，环境变量配置，默认管理员账号，以及 Nginx 托管与 API 基础路径。

## API 基础路径

后端在 `main.ts` 中通过 `app.setGlobalPrefix('api/v1')` 设置全局前缀，因此：

```
所有接口基础路径 = http://<host>:<port>/api/v1
```

例如登录接口的完整地址为 `POST http://localhost:3002/api/v1/auth/login`。

::: tip 本文档中的路径约定
除特别说明外，本文档所有接口路径均**省略** `/api/v1` 前缀，仅书写资源路径（如 `/auth/login`）。实际调用时请自行补全为 `/api/v1/auth/login`。
:::

静态上传文件（本地存储模式）通过 `app.useStaticAssets(..., { prefix: '/uploads' })` 暴露在 `/uploads/<filename>`，**不带** `/api/v1` 前缀。

## 后端部署

```bash
cd backend
cp .env.example .env      # 编辑数据库与 JWT 配置
npm install
npm run build             # 编译 TypeScript 到 dist/
npm run seed:admin        # 创建默认管理员账号（admin / admin123）
npm run start:prod        # 或用 PM2 托管：pm2 start dist/main.js --name chaojifather-api
```

服务默认监听 `PORT`（缺省 `3002`），启动后控制台输出：

```
Backend service is running on http://localhost:3002
API base: http://localhost:3002/api/v1
```

## 前端部署

```bash
cd admin-web
npm install
npm run dev      # 开发模式 http://localhost:5173
npm run build    # 生产构建到 dist/
```

构建产物 `admin-web/dist/` 为静态 SPA，交由 Nginx 托管。

## 文档站部署（本站）

```bash
cd docs-site
npm install
npm run docs:build    # 构建静态站到 .vitepress/dist/
npm run docs:dev      # 本地预览（默认 http://localhost:5173）
```

文档站为**独立工程**，不进入 backend / admin-web 构建链，产物为纯静态 HTML，可由 Nginx 直接托管并接入 CDN 缓存，无需登录。

## 环境变量

后端 `.env`：

| 变量 | 说明 | 默认值 / 是否必填 |
|------|------|------|
| `DB_TYPE` | 数据库类型 | `mysql` |
| `DB_HOST` | 数据库地址 | `127.0.0.1` |
| `DB_PORT` | 数据库端口 | `3306` |
| `DB_USERNAME` | 数据库用户 | 必填 |
| `DB_PASSWORD` | 数据库密码 | 必填 |
| `DB_DATABASE` | 数据库名 | 必填 |
| `JWT_SECRET` | JWT 签名密钥 | 必填（生产务必改为随机强密钥） |
| `JWT_EXPIRES_IN` | Token 过期时间 | `7d` |
| `PORT` | 后端监听端口 | `3002` |
| `FASTAPI_BASE_URL` | FastAPI 音源服务地址 | `https://chunyin.jilllees.top:8443/api` |
| `OBJECT_STORAGE_CONFIG_ENCRYPTION_KEY` | TOS 配置密文加密密钥（可选） | 缺省回退使用 `JWT_SECRET` |

::: warning 关于 TOS 配置加密密钥
对象存储的 AccessKeySecret 以密文（AES-256-GCM）存储，加密密钥回退链为 `OBJECT_STORAGE_CONFIG_ENCRYPTION_KEY` → `JWT_SECRET`。由于目标平台已有 `JWT_SECRET`，开箱即用、零新增必填变量。但若计划轮换 `JWT_SECRET`，**建议显式配置** `OBJECT_STORAGE_CONFIG_ENCRYPTION_KEY`，否则已存的 TOS Secret 将无法解密。
:::

## 默认管理员

执行 `npm run seed:admin` 后创建：

| 用户名 | 密码 | 角色 |
|--------|------|------|
| `admin` | `admin123` | 管理员（role = 1） |

::: danger 首次部署后请立即修改管理员密码
可通过 `PATCH /admin/profile` 更新密码，详见 [鉴权机制](/guide/authentication)。
:::

## Nginx 托管建议

一个典型的三站点（前端 SPA + 后端 API + 文档站）Nginx 配置骨架：

```nginx
server {
    listen 80;
    server_name chaojifather.me;

    # 前端 SPA（admin-web/dist）
    root /www/wwwroot/chaojifather.me/admin-web/dist;
    index index.html;
    location / {
        try_files $uri $uri/ /index.html;
    }

    # 后端 API 反向代理到 NestJS（保留 /api/v1 前缀）
    location /api/v1/ {
        proxy_pass http://127.0.0.1:3002;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        client_max_body_size 100m;   # 与后端上传上限对齐
    }

    # 本地上传静态资源（未启用 TOS 时）
    location /uploads/ {
        proxy_pass http://127.0.0.1:3002;
        proxy_set_header Host $host;
    }

    # 文档站（docs-site/.vitepress/dist）
    location /docs/ {
        alias /www/wwwroot/chaojifather.me/docs-site/.vitepress/dist/;
        try_files $uri $uri/ /docs/index.html;
    }
}
```

::: tip 文档站独立域名 / 子路径
若以子路径（如 `/docs/`）托管，请在 `.vitepress/config.mts` 中补充 `base: '/docs/'`，否则静态资源路径会 404。独立域名托管则无需设置 `base`。
:::

## 下一步

- 了解如何获取 Token 并调用受保护接口：[鉴权机制](/guide/authentication)。
- 浏览全部接口：[API 参考 · 总览](/api/overview)。
