# 通知草稿与预览（迁移第一步）

本次仅提供管理端通知内容草稿与纯文本预览，不代表实际通知推送已迁移。

## 已实现

- 管理员（role=1）和主办方（role=2）可创建、查看、编辑、归档、恢复自己的草稿
- `organizer_id` 由服务器指定为当前管理账号 ID。管理员在此模块也不能跨账号访问
- 创建者、更新者、时间与递增 `revision` 记录在草稿上；修改使用带归属和版本条件的单条 SQL UPDATE
- 每账号名称唯一（包括归档草稿，大小写规则遵循数据库 collation）
- 模板支持 `{{event_name}}` 形式的声明变量，重复引用同一变量允许；重复声明拒绝
- 变量仅允许安全标识符，不支持表达式、属性路径、原型名称；示例值仅可为字符串、有限数字或布尔值
- 标题最多 120、正文最多 2000、名称最多 80 个 JavaScript 字符长度单位；渲染后再次检查长度
- 预览不修改数据库，不记录示例值，不查询用户，不调用渠道或外部服务
- 全部通知草稿路由退出系统请求日志记录，包括成功、失败、请求/响应/查询参数和错误堆栈；草稿审计字段仍保留
- 前端以当前账号/角色/登录凭证隔离状态；关闭对话框、换账号与较新请求会屏蔽旧异步响应；预览内容通过 React 文本节点展示

## API

统一前缀 `/api/v1/admin/notification-drafts`，沿用平台 `{code,message,data}` 响应格式与 JWT 鉴权。

| 方法 | 路径 | 请求体 |
|---|---|---|
| GET | `/` | 无；返回仅当前账号的草稿数组 |
| GET | `/:id` | 无 |
| POST | `/` | `{name,title,body,variables:[{name,required}]}` |
| PUT | `/:id` | 上述内容字段加 `revision` |
| POST | `/:id/archive` | `{revision}` |
| POST | `/:id/restore` | `{revision}` |
| POST | `/:id/preview` | `{revision,values:{event_name:"示例"}}` |

未声明字段、伪造归属/审计/状态字段会返回 400；其他账号 ID 返回 404；版本冲突和重复名称返回 409。预览返回 `{title,body,preview_only:true}`。更新归档草稿前需先恢复。前端预览入口仅开放草稿状态，API 也可对已归档内容做只读预览。

## 数据库与发布边界

新增显式迁移 `backend/migrations/002_notification_drafts.sql`，不得在应用启动时自动执行，也不得用生产数据库进行测试。生产 `synchronize` 保持关闭。升级时依次应用 `001_guest_identity.sql`、`002_notification_drafts.sql`，两项结构准备完成后再启动本版本后端。先在隔离非生产目标 MySQL 版本验证，再由有权限的人按既有发布流程应用。本次未执行生产迁移，也未部署。

2026-10-01 已使用原 NestJS 后端和独立 MariaDB 11.8.6 合成数据完成 SQL 实际执行、旧用户及报名逐列保留、JSON/默认值映射、三个外键、账号内名称唯一约束、collation、账号隔离、并发 revision 冲突与只读预览验证。以 `DB_SYNCHRONIZE=false` 启动迁移后的后端验证通过。自动化服务测试仍使用内存仓库替身；真实数据库测试单独运行，MariaDB 结果不等于目标 MySQL 版本验收。

## 验证

- `cd backend && npm test`：构建后运行全部认证及通知草稿测试
- `cd admin-web && npx tsc --noEmit`
- `cd admin-web && npm test`
- `cd admin-web && npm run build`

本版本后端测试 21/21、前端测试 23/23、类型检查和构建通过。前端测试覆盖校验、API 契约、身份边界和请求代次逻辑；真实浏览器交互端到端验收因环境访问限制尚未完成。

## 后续仍需明确

未接入推送渠道、接收人、用户同意/退订规则、发送任务、定时、投递状态、设备令牌、微信、支付或摄影师业务。真实渠道与规则确定前不扩展此边界。

本次仅参考已脱敏源项目中 notification-center 的声明变量检查/插值方式和 PushTemplateManager 的表单结构，未引入其在线模块或发送 worker。
