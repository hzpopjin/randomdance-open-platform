# Random Dance Open Platform

随机舞蹈中文站开放平台（`randomdance-open-platform`）

Random Dance Chinese Site Open Platform — 独立部署的随机舞蹈活动报名与歌单投稿管理平台。

## 概述

本项目是 apps.randomdance.cn 私有项目的公开改进版本，采用独立的用户名/UID 体系和本地 JWT 鉴权，可独立部署，供第三方主办方使用。

本仓库独立演进，会定期从私有项目中选择性迁移适合公开平台的功能、修复和改进，同时保留自身的实现与产品取舍。两个项目的功能、配置与发布时间不保证一致，本仓库并非私有项目的完整镜像。

核心功能：
- **路演报名**：用户提交表演曲目、成员与联系方式，管理员审核与 Excel 导出
- **随舞歌单投稿**：用户从曲库选择或添加自定义歌曲投稿，管理员审核、统计与 Excel 导出
- **场次管理**：管理员创建、编辑、取消、删除活动场次
- **用户系统**：本地注册/登录、JWT 鉴权、角色管理（管理员/普通用户）
- **管理后台**：仪表盘、场次管理、报名管理、投稿管理、歌曲库、用户管理、系统日志、客户端事件、云端配置
- **音源服务**：复用 FastAPI 音源服务进行歌曲查询与播放

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 19 + TypeScript + Ant Design 6 + Vite 8 |
| 后端 | NestJS 11 + TypeORM + MySQL |
| 鉴权 | 本地 JWT（用户名/密码注册登录） |
| 部署 | Nginx + PM2 |
| 音源 | FastAPI（外部服务，通过 Nginx 代理） |

## 目录结构

```
randomdance-open-platform/
├── admin-web/          前端 React SPA
│   ├── src/
│   │   ├── config/     路由配置、全局常量
│   │   ├── types/      TypeScript 类型定义
│   │   ├── services/   API 服务层
│   │   ├── stores/     Zustand 状态管理
│   │   ├── utils/      工具函数（请求封装、设备信息）
│   │   ├── components/ 公共组件（布局、守卫、标签）
│   │   └── pages/      页面组件
│   └── dist/           构建产物
├── backend/            后端 NestJS API
│   ├── src/
│   │   ├── modules/    业务模块
│   │   │   ├── auth/       认证（注册/登录/JWT）
│   │   │   ├── users/      用户实体
│   │   │   ├── sessions/   场次
│   │   │   ├── roadshow/   路演报名
│   │   │   ├── submissions/ 歌单投稿
│   │   │   ├── songs/      歌曲库
│   │   │   ├── upload/     文件上传
│   │   │   ├── admin/      管理后台控制器
│   │   │   ├── system-logs/ 系统日志
│   │   │   ├── client-events/ 客户端事件
│   │   │   └── client-config/ 云端配置
│   │   ├── common/     公共工具（拦截器、过滤器、守卫、DTO）
│   │   └── app.module.ts
│   └── dist/           编译产物
├── docs/               开发文档
└── README.md
```

## 快速开始

### 后端

```bash
cd backend
cp .env.example .env  # 编辑数据库配置
npm install
npm run build
npm run seed:admin    # 创建管理员账号（admin / admin123）
npm run start:prod    # 或 pm2 start dist/main.js --name chaojifather-api
```

### 前端

```bash
cd admin-web
npm install
npm run dev    # 开发模式 http://localhost:5173
npm run build  # 生产构建到 dist/
```

### 环境变量

后端 `.env`：

| 变量 | 说明 | 默认值 |
|------|------|--------|
| DB_HOST | 数据库地址 | 127.0.0.1 |
| DB_PORT | 数据库端口 | 3306 |
| DB_USERNAME | 数据库用户 | - |
| DB_PASSWORD | 数据库密码 | - |
| DB_DATABASE | 数据库名 | - |
| JWT_SECRET | JWT 密钥 | - |
| JWT_EXPIRES_IN | Token 过期时间 | 7d |
| PORT | 后端端口 | 3002 |
| FASTAPI_BASE_URL | FastAPI 音源地址 | https://chunyin.jilllees.top:8443/api |

## 默认管理员

| 用户名 | 密码 |
|--------|------|
| admin | admin123 |

> 首次部署后请立即修改管理员密码。

## API 概览

基础路径：`/api/v1`

详见 [开发文档](docs/README.md)。

## 与原平台 (apps.randomdance.cn) 的差异

| 方面 | 原平台 | 开放平台 |
|------|--------|---------|
| 用户系统 | WordPress JWT | 本地用户名/密码 + JWT |
| 积分系统 | WordPress 积分 | 无 |
| 支付功能 | 支付宝/微信支付 | 无 |
| 直拍预约 | 完整直拍流程 | 无 |
| 短信通知 | 阿里云短信 | 无 |
| 微信通知 | 微信服务通知 | 无 |
| 实名认证 | 三要素核验 | 无 |
| 音源服务 | FastAPI | 复用同一 FastAPI |
| 核心功能 | 路演报名 + 歌单投稿 | 路演报名 + 歌单投稿 ✅ |
| 部署方式 | 绑定 WordPress | 独立部署 |

## 功能迁移与维护

- 定期评估 apps.randomdance.cn 私有项目中的功能、修复与改进，按本平台的需求选择性迁移。
- 迁移以独立部署和公开使用为前提，适配本平台的用户体系、配置和业务流程。
- 迁移内容通过本仓库的提交记录说明；未迁移的功能及实现差异以本仓库源码和文档为准。
- 私有项目的凭据、用户数据和内部配置不属于公开仓库内容。

## 开源说明

本平台设计为可独立部署的开源项目，不依赖任何第三方用户系统。
第三方主办方只需配置自己的 MySQL 数据库和 Node.js 运行环境即可使用。

## License

MIT
