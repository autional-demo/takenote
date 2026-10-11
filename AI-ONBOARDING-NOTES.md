# AI Onboarding Notes — 问题日志

> 实验：用 Autional AI onboarding skill（https://www.autional.com/ai）给本项目接入 Autional 登录。
> 本文件记录接入全过程中的问题、根因与处置。按发生顺序，分类归档。

## 总览（结论先行）2026-10-10

- **结论**：skill 可完成接入（本 fork Phase 0-8 走通、单测 128 例绿、浏览器 E2E 全绿），但**浏览器端按 skill 原样配置 100% 被 CORS 墙阻断（D17）**——这是唯一流程级 P0（**当日已产品侧根治**：oauth 动态 CORS + SDK SSO 重写，见「根治」节）；另有 2 个 P0 配置陷阱（D1/D2，照抄模板必踩）。
- **问题总量 37 项**：A 环境适配 4（非 skill 流程）+ B skill/部署 2 + C 租户/账号 11（全部线上实证）+ D 依赖/配置/运行时 20。
- **2026-10-11 增补（SSO 线实证）**：dev E2E 三腿全绿（CLI 18/18 + 浏览器 12/12 + 线上 9/9）期间又挖出 **T7**（refresh 契约缺陷，已修 `1950a7d`）与 **T8**（公开客户端同意提交链断裂，已修 + 部署拓扑纠正——线上自 09-29 已是 fetch，无此缺陷）；另留档 **device authorize 双 gap + PAR 多层缺陷链 + atob/base64url 观察项**（见「SSO 接入线实证」节）。
- **2026-10-11 深夜增补（localhost 全链验证）**：真实 Chromium × localhost:5173 全链 **11/11 PASS**（跨源换票 CORS 真验 / 仪表盘内容水合 / 刷新会话保持）；期间修掉 **4 处接入摩擦**（F1 vite 代理键吞回调路由 · F2 StrictMode 双换票 · F3 skill 模板 apiUrl 缺 `/bff` · F4 demo Dashboard 传空对象白屏）；探针实证 **SSO access_token 对 identity API 全通**（4/4 200）。见「SDK demo localhost 全链实证」节。
- **2026-10-11 收官增补（takenote 存量应用改造实证）**：webpack 老应用（React 16）按 skill v3.1 §5.2b 改造接入，**真机全链 12/12 PASS**（真登录页填表 → 同意 → 回跳 code → 同源代理换票 → 落 `/app`）；期间修掉第三批接入摩擦 **F5–F7**（SDK 默认 authorize 在同源代理形态下踩 api 平面陷阱 · .com `/bff` 502 双区不对等 · 租户 `login_methods=["oauth"]` 登录死路 + identity auth-config 写读分裂假成功）；另存 webpack-dev-server 配置不热更的工具链教训。见「takenote SSO 接入实证」节。

### 严重度分布（D 组 20 项）

| 级别 | 数量 | 项                                                                                |
| ---- | ---- | --------------------------------------------------------------------------------- |
| P0   | 3    | D17（CORS 墙）· D1（apiUrl 缺 /bff）· D2（tenantId 注入链断裂）                   |
| P1   | 4    | D6（依赖墙 ERESOLVE）· D9（TS 连锁升级）· D12（注册落错租户）· D3（appId 不可得） |
| P2   | 9    | D4 · D5 · D8 · D10 · D13 · D16 · D18 · D19 · D20                                  |
| P3   | 4    | D7 · D11 · D14 · D15                                                              |

（C 组另含 P0 两项：C5 试用管理员密码传输口径自相矛盾——实验内已对齐，2026-10-10 **产品侧根修并部署 dev**；C6 试用租户 RBAC 零播种——**同日根修**：试用链补 RBAC 播种 + `initial_role` 通道生效，真机 E2E 9/9 全绿。另有 C11：SDK changePassword 字段名与服务端不符，调用必 400 → **同日 SDK 修复 PR 已提、服务端对称/非对称改密 fail-loud 已部署**。三项修复落地对照见「深挖」节。）

### 过程一图

```
Phase 0-1 调研/租户   ── C 组 11 项（邀请码无铸造 API、试用管理员死结等）
Phase 2-3 租户/账号   ── C5 P0：管理员登录按 skill 口径必失败（实测绕行）
Phase 4   依赖/配置   ── D1/D2 P0 配置陷阱 + D3-D13（照抄模板不可用）
Phase 5-6 构建/单测   ── 29 套件 / 128 用例 绿
Phase 7   Node 集成   ── 8/8 PASS ── ⚠ 假绿 #1：Node 无 CORS 约束
Phase 8   浏览器 E2E  ── D17 P0 全阻断 → 同源代理绕行后 5/5 绿
                                    ⚠ 假绿 #2：代理探测「200」实为 SPA 回退
```

### 归因分类

| 归因                                         | 项                                        | 要点                                                                      |
| -------------------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------- |
| 文档只讲半程 / 运行时模型未进材料            | D4 D5 D8 D13 D17 D18 D19 D20 · B2         | 部署形态（CORS/反代）、会话生命周期、错误面、镜像路径均无说明             |
| SDK 实现缺陷（代码级）                       | D11 D12 D14 D15 D16 · C1 C6 C7 C9 C10 C11 | 驼峰租户键、无重试的 AuthClient、fire-and-forget 登出、改密字段名不符等   |
| 服务端/部署缺陷                              | B1✅ · C3 C5                              | .com 站 references 区错配（cn/zh 内容）✅ 已修（10-10）；邀请码无铸造 API |
| 基础设施抖动                                 | C8 · D16/D20 实测现象                     | 跨境链路 20-30% 5xx，经 SDK 冒泡为用户可见错误                            |
| 环境年份差（非 skill 问题，但 skill 无预案） | A1-A4                                     | 老依赖 × 现代 Node，4 个阻断点                                            |

## 环境与基线

| 项           | 值                                                                                                                                 |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| Fork         | https://github.com/autional-demo/takenote                                                                                          |
| 本地         | D:\ws\ai-onboarding-lab\takenote                                                                                                   |
| 本机 Node    | v24.15.0（npm 11.12.1）                                                                                                            |
| 项目官方环境 | Dockerfile `node:12-alpine`（2020 年代项目）                                                                                       |
| Skill        | https://www.autional.com/ai/skill.md（en，region .com）；实验基线 core@f495cd50f8cc（强化版 core@ffb54a28b76c 于 2026-10-10 发布） |

## A. 环境适配阶段（接入前置，非 skill 流程）

老项目（2020 年栈）× 现代 Node 24 的年份差问题。共 4 个，均为阻断级。

### A1 · node-sass 无法安装（原生模块无二进制）

- 现象：`npm install` 时 `node-sass@4.14.1` 触发 node-gyp 编译，Node 24 无预编译二进制，失败。
- 根因：node-sass 4.x 仅支持至 Node 14；Node 17+ 必需 dart-sass。
- 处置：`node-sass@^4.14.1` → `sass@^1.32.0`（dart-sass）。sass-loader 10 自动检测切换，webpack 配置零改动。
- 备注：老 `@import` 语法在 dart-sass 下有 deprecation 警告，不影响构建。

### A2 · webpack md4 hash 崩溃（OpenSSL 3 移除）

- 现象：`npm run build` → `Error: error:0308010C:digital envelope routines::unsupported`。
- 根因：webpack 5.1.3 内部用 md4 生成 hash；Node 17+ 的 OpenSSL 3 移除 md4。
- 处置：scripts 注入 `NODE_OPTIONS=--openssl-legacy-provider`（build/client 两条）。
- 备注：webpack ≥5.54 已改用 wasm 版 md4、无此问题；升级属更大改动，未做。

### A3 · postcss exports 拦截老 css-loader

- 现象：`ERR_PACKAGE_PATH_NOT_EXPORTED: './package.json' is not defined by "exports" in .../postcss/package.json`
- 根因：postcss@8.1.1（lock 锁定）的 exports 未暴露 `./package.json` 子路径；Node 20+ 严格执法（当年 Node 12 对此豁免）。
- 处置：`overrides: { "postcss": "^8.4.0" }`（新版本已补 `./package.json` 导出）。

### A4 · websocket-driver 0.6.5 调用已移除的 Node 内部 API

- 现象：`npm run client` 启动即崩：`Error: No such module: http_parser`。
- 根因：webpack-dev-server 3 → sockjs → faye-websocket → websocket-driver@0.6.5，其代码 `process.binding('http_parser')`；该 binding 在现代 Node 已移除。
- 处置：`overrides: { "websocket-driver": "^0.7.4" }`（0.7.4+ 已不依赖该 binding）。

### A 组小结（对 AI 接入的启示）

- 4 个阻断点全部是「老依赖 × 新运行时」的年份差，与业务代码无关。
- Autional skill 的流程假设「项目本身能跑」；对存在环境适配问题的老项目**无预案**（无 Phase 或指引覆盖）。
- AI agent 执行接入前应先做「可运行性验证 + 环境适配」，否则 Phase 5 的 build 验证会被环境问题污染。

## B. Skill 内容与部署问题（Phase 1-2 期间发现）

### B1 · .com 站的 references 文件区域错配（部署缺陷，影响所有 .com 区接入者）

- 现象：skill.md（region: com / lang: en）要求 AI 从 `https://www.autional.com/ai/references/*.md` 读取参考文件。实际抓取，该站的两个 references 文件内容是 **region: cn / lang: zh** 版本，配置模板中 `issuer: 'https://api.autional.cn'`（错区 endpoint）。
- 证据（2026-10-10 三来源对照）：

| 来源                        | SKILL.md / skill.md | references/\*.md                       |
| --------------------------- | ------------------- | -------------------------------------- |
| www.autional.com            | ✅ com/en           | ❌ **cn/zh**（issuer=api.autional.cn） |
| cdn.autional.com/ai/latest/ | ✅ com/en           | ✅ com/en（issuer=api.autional.com）   |
| www.autional.cn             | ✅ cn/zh            | ✅ cn/zh                               |

- 影响：按 skill 指引（"只从 canonical domain 抓取相关文件"）执行的 AI agent 会拿到中文内容 + .cn endpoint 配置——若照用，开发者应用的 issuer 将指向错误区域，OIDC discovery 失败或跨区混乱。
- 绕行（本次实验采用）：references 改用 CDN 镜像版本 `https://cdn.autional.com/ai/latest/references/*`（核验为正确 com/en 版）。
- 根因（2026-10-10 证实）：**单仓双区拓扑**——github.com:autional/web 单仓同时构建 .com/.cn 两站（双 Vercel 项目），而 `public/ai/references/` 只有**单份**入仓文件（cn 变体，`region: cn`）服务双站；com 站构建时根本没有 com 版可落位（非"部署时区混用"，是产物装配缺失）。
- 处置（2026-10-10 已修复上线，web `5e9c67b`）：入仓镜像按区命名（`*.com.md` / `*.cn.md`）+ gen-static 构建期按 `REGION` 落位无名版（`public/ai/references/*.md` 转为生成物）+ 双守卫（skill frontmatter 区/lang、references 首行区标记，不符即拒构建）。线上复验（cache-buster + 落盘 sha256）：`www.autional.com/ai/references/*` = com 版（`b8669366…`/`ed918832…`，`issuer: api.autional.com`）；`www.autional.cn/ai/references/*` = cn 版（`79b30207…`/`ec0b6a2b…`，`issuer: api.autional.cn`）——与 CDN 版本逐字节一致。

### B2 · fallback 链路对 references 的指引缺失

- skill.md 的 fallback 条款只给 SKILL.md 自身的 CDN 镜像地址，未给 references 的镜像路径；同时 boundaries 规则限制"只从本区 canonical domain 抓取"。若 .com 站整体不可达，AI 将无法合法获取 references（实际上 CDN 有 `/ai/latest/references/` 镜像，但指引中不存在）。
- 影响：降级场景下接入流程会中断（无明示的合法路径）。

## C. 租户与账号（Phase 2-3 执行期间 + 2026-10-10 补测，全部线上实证）

> 口径：本节全部结论来自 2026-10-10 对生产 API（api.autional.com → 跨境中转 → 云机）与云库（autional_tenant / autional_identity / autional_rbac）的实测。租户 = `takenote-demo`（`01M4J4BF8M2WQCTGVS2S0T9024`）。

### C1 · SDK createTrialTenant 路径错误，且根本不支持邀请码（双缺陷）

- 现象（代码证据）：`@autional/core@0.3.0` auth-client.ts:343 请求 `${baseUrl}/tenant/api/v1/public/tenants`。
  - 实线上所有服务挂 `/bff/<svc>` 前缀（gateway-service.yaml 全量路由）；公开注册真实路径 = `/bff/tenant/api/v1/tenant/public/tenants`。SDK 路径**缺 `/bff` 前缀且缺 `tenant/` 一段**，直连必 404。
  - 更关键：SDK 请求体（auth-client.ts:337-342）**没有 `invitation_code` 字段** —— 即使路径对，SDK 也无法执行"邀请码通道"注册（服务端 DTO 明明支持）。
- 处置：绕开 SDK，手工 POST 正确路径（本实验 provision/register-tenant.mjs）成功。
- 影响：照 skill 用 SDK 完成 [B] 邀请码路径注册的接入者 100% 卡死（404），且无 skill 指引可循。

### C2 · 邀请码 ≠ 永久租户（skill 文案与实现不符）

- 现象（DB 实证）：用邀请码成功注册后：`trial = t`、`plan = free`、`trial_expires_at = 注册时刻 + 7 天`（本租户到期 2026-10-17）。
- 根因（代码证据）：service-tenant `CreateTrialTenant` 中 `trial := true` **无条件**（tenant_service.go:257）；邀请码段只做"查码校验 → 原子消费 → 建租户"，完全不改 trial/plan/时长。
- 影响：skill 的 [B]「永久租户」表述与实现不符。接入者需按"7 天试用"规划；到期后果与续期路径 skill 未述。

### C3 · 邀请码无铸造 API，批量发码只能直写数据库

- 现象：邀请码系统面向**消费端**（注册时校验+消费）；服务仓文件头注 "RESERVED: Planned self-service tenant invitation code management" —— 管理端自助发码未实现。任何 API 都不铸造邀请码。
- 实际表结构（实测）：表名 `profile_invitation_codes`（不是直觉上的 `invitation_codes`；模型来自共享仓 micro-share `user.InvitationCode`）。消费 = 单条条件 UPDATE（`code=? AND status='active' AND used_count<max_uses AND (expires_at IS NULL OR expires_at>now())`），并发安全。
- 处置：本实验直连云库 INSERT 10 枚单次码（`mint-invite-codes.mjs`：id=ULID、code=18 字符 `AUT-XXXX-XXXX-XXXX`、max_uses=1、有效期 1 年），已建 batch 共 10 枚，寄存器验证 10 行 active。
- 影响：skill [B] 要求"提供邀请码"，但拿码渠道（管理员自助）不存在；接入者与发码方之间是死结（除非有库权限）。skill 无说明。

### C4 · 用户名保留名单会拒掉常见英文名（含 skill 示例风格的名字）

- 现象（422 实证）：注册 `alice`、`carol` → `username is reserved`（错误码 61001701）；`bob` 通过。
- 根因：保留名单 `service-share/micro-share/reserved/data/04_english_names.txt` 收录大量常见英文名（alice/carol 在列），**精确匹配**、大小写不敏感。
- 处置：测试账号改名 `takenote-alice` / `takenote-carol`（前缀化避开精确匹配），注册成功。
- 影响：若文档/示例惯用 alice/bob/carol 类演示名，2/3 会被服务端拒绝；错误信息友好（i18n_key），但 skill 未预警这一名单的存在与匹配方式。

### C5 · 试用管理员密码"传输模式自相矛盾"——按 skill 流程永远登不上（P0）

- 现象（实测）：注册时设定的管理员密码，按 **hash 模式**（`sha256hex(pwd|tenantId)`）登录 → `401 password content mismatch`（61000104）；改按 **plain 明文**登录 → **200 成功**。
- 根因（代码证据）：tenant-service 的 `RegisterTrialAdmin` 调身份服务公共 `/auth/register` 时**不传 `password_transmission`**（client.go:109-114，raw 明文入 body）→ 身份服务按"明文输入"做 argon2 落库；而租户密码策略默认 **hash 模式**（service-identity security_policy.go:120 全局回退 `TransmissionHash`），SDK/skill 按 hash 计算 —— 两端对不上。
- 影响：任何按 skill 默认配置（hash 传输）的接入者，注册出的试用管理员用标准客户端流程**永远登录失败**；唯一可行登录法是知道 plain 传输这个非文档化偏方。且明文登录与租户自身 "hash" 策略相悖（见 C9）。
- **处置（2026-10-10 实验内已实测对齐）**：以 plain 登录取令牌后调 `PUT /bff/identity/api/v1/auth/me/password`（服务端字段：`old_password`=原明文、`new_password`=`sha256hex(同一口令|tid)`、`password_transmission:"hash"`）→ 200 `password changed successfully`；随后 hash 登录 200 / plain 登录 401 `password content mismatch` —— 口令值不变，仅存储形从 argon2(明文) 翻转为 argon2(hash 摘要)，与租户策略对齐。脚本：`provision/admin-align-hash.mjs`（内含 SDK 形/服务端形双探针与对齐后验证）。
- 注：无法用 `sdk.changePassword()` 完成此对齐——该 API 本身调不通（C11 字段名不符 → 400），只能手写请求体。
- 产品侧修复建议：`RegisterTrialAdmin` 注册时携带 `password_transmission=hash` + 预哈希口令（参照 `service-identity/db/seeds/demo_accounts.go` 的 `PasswordTransmission: domain.TransmissionHash` 写法），从源头消除矛盾。→ 代码级根因闭环（两处"空串豁免"）见后文「深挖」节。
- **产品侧根修（2026-10-10，已部署 dev）**：按上述建议落地——tenant `RegisterTrialAdmin` 改发 `password_transmission:"hash"` + `sha256hex(明文|tenantID)` 预哈希（`internal/infrastructure/identity/client.go`）；非 2xx 错误附响应体摘要（原"只报状态码"致此类错配长期不可见）。注册侧"空串豁免"本体未动（收紧属另一争议面）。真机验证：hash 登录 200（E2E T2）。

### C6 · initial_role=super_admin 被静默丢弃——试用管理员 0 RBAC 角色

- 现象（DB 实证）：4 个用户（管理员 + 3 测试账号）在 `rbac_user_roles` / `rbac_user_permissions` **零绑定**。
- 根因（代码证据）：`RegisterTrialAdmin` 的 body 带 `"initial_role":"super_admin"`（client.go:113），但身份服务 `RegisterRequest` DTO（dto.go:118-126）**没有该字段**，反序列化静默忽略 → 权限意图丢失。
- 影响：代码注释"（含 super_admin 权限）"与事实不符；试用管理员即便登得进去也没有任何管理权限。
- **2026-10-10 门户实测补证（升级为 P0 级阻断）**：C5 对齐后，admin.autional.com 登录链路（auth.autional.com/takenote-demo/login，请求头 `x-entry-plane: admin`）密码层已过（请求体内为正确 hash），随即被入口平面门禁拦死：**403 `40000503 entry plane not authorized`**（auth_login.go:668 → entry_plane_authz.go:47：admin 平面需 admin 类角色）。`check-role` 七码探针（super_admin / admin / security_admin / user_manager / auditor / member / tenant_admin）——**管理员与 takenote-alice 全部 false**：不只 initial_role 丢失，连 `member` 都不存在——该试用租户 RBAC 完全零播种（SDK 注册路径的默认角色亦未落地）。
- 链条：C5 的 401 此前一直掩盖 C6 的 403；密码对齐后 403 成为可见阻断。
- 影响升级：管理面门户（admin / security）对试用租户管理员**不可进入**，且无客户端自救路径（授予角色本身需管理面权限——鸡生蛋死结）；用户面登录层已验证可用（api 平面 200）。→ 全链代码证据与修复设计（含存量播种方案）见后文「深挖」节。
- **产品侧根修（2026-10-10，已部署 dev）**：三层齐落——① rbac `BootstrapTenantRBAC` gRPC **幂等化**（三角色 find-or-create + exact code 比对 + 重放安全，`internal/grpc/server.go`）；② tenant 试用链在管理员注册**之前**调用该 gRPC（普通建租户链原有调用不动；失败不阻断、域事件 + metric 同口径）；③ identity 注册链 `initial_role` 通道打通（**仅当** X-API-Key 命中已配置内部 key 且角色 ∈ `{super_admin,admin,member}` 才生效，公开注册静默忽略防提权）。真机 E2E（`service-tenant/e2e/trial-onboard-e2e.mjs`）**9/9 全绿**：`check-role super_admin=true`（initial_role 绑定）+ `member=true`（member 默认角色随 bootstrap 落地，同时证明 bootstrap 先于注册的时序）。门户 403「entry plane not authorized」的同源判定前提消除；门户浏览器腿未覆（可选）。→ 修复落地对照见「深挖」节。

### C7 · open 模式注册不写 tenant_members（成员列表为空）

- 现象（DB 实证）：3 测试账号 + 管理员全部注册成功（identity 侧 4 用户 active），但 `tenant_members` 表 takenote-demo **0 行**。
- 根因（代码证据）：auth_register.go 仅 `approval_required` 分支调 `AddTenantMember`（auth_register.go:171-209）；`open` 分支无成员行。
- 影响：租户管理面成员列表将显示 0 人；"open 模式=任意同租户认证用户即成员"的物化时点不明（是否有懒物化未进一步验证——列入待验证项）。

### C8 · 跨境中转链路 ~20-30% 5xx 抖动（接入期高频踩雷）

- 现象：本阶段 20+ 次公开 API 请求中约 8 次 502（Vercel 边 `ROUTER_EXTERNAL_TARGET_CONNECTION_ERROR`，约 30s 挂起后 502）；**同请求重试 2-4 次内必成功**。
- 影响：所有接入脚本必须自带重试（幂等性由服务端天然保证：租户名唯一、邮箱唯一）；502 错误页只有通用文案 "An error occurred with this application"，对排查不友好。skill 无此提示。

### C9 · 注册与登录对 password_transmission 的执行口径不一致

- 现象（代码证据）：register **强制** `password_transmission` 匹配租户策略（auth_register.go:129-148，不符即 400）；login **只做格式校验不查策略**（auth_login.go:326 / 1153：plain 放行；hash 只要求 64 位 hex）。
- 影响：管理员 plain 登录不被策略拒绝（C5 的偏方因此可行）；登录侧对租户策略的宽松使得"策略"形同虚设。两端口径应当一致。

### C10 · SDK 内联注释与实现不一致（小）

- password-transmission.ts:7 注释写 `SHA-256(password + tenantId)`，实现是 `rawPassword + '|' + policy.tenantId`（:57）。照注释手写实现会 401。SDK 测试文件（password-transmission.test.ts:50）用的才是正确带 `|` 的表述。

### C11 · `sdk.changePassword()` 字段名与服务端不符——调用必 400（P1，线上实测）

- 现象（线上 400 实证）：按 SDK 原样调用（请求体 `{current_password, password, password_transmission}`，auth-client.ts:209-213）→ `400`："Key: 'ChangePasswordRequest.OldPassword' Error:Field validation for 'OldPassword' failed on the 'required' tag" + 同型 NewPassword 错误。
- 根因：服务端 DTO 字段为 `old_password` / `new_password`（dto/user.go:165-169，handler auth_password.go:90 绑定）；SDK 发 `current_password` / `password` —— 两个 required 字段全部落空。
- 版本核对：装机版 = `npm view @autional/core version` = **0.3.0**（最新发布版），非旧版漂移。
- 影响：`sdk.changePassword()` 对所有接入项目 100% 不可用；本实验的 C5 对齐只能手写请求体绕行。建议 SDK 改用 `old_password`/`new_password`（或服务端兼容别名，二者取一并写进契约）。
- 附注：hash 模式下 `new_password` 须传**摘要**（64 hex；服务端 `min=8` 校验可过），「新口令先按策略处理」的语义只在 SDK 源码里，文档无述——手写调用者必须知道这一点。→ 成因（双写契约 + 自证测试）与 symmetric/asymmetric 静默损坏（服务端改密链无解密阶段）见后文「深挖」节。
- **修复落地（2026-10-10）**：① SDK 仓 `autional/sdk` PR #1——字段名对齐 `old_password`/`new_password`、**新旧密码均**按租户策略预处理（只处理新密码会让旧密码校验恒失败）、修 `fetchAuthConfig` 取错配置面（原恒取 default → hash 输入拼错 tenant id）、symmetric/asymmetric 显式报错 `61001670`（changeset `@autional/core: patch`，发版另行执行）；错误契约背书的旧单测断言同步替换。② 服务端（identity）`changePasswordCore` 对 symmetric/asymmetric **fail-loud**（`ErrInvalidTransmissionMode` 61001670）——替代"密文当明文哈希 → 账号锁死"的静默损坏（深挖方案表 C 兜底已落）；方案 B（完整密钥交换支持）明确非本次范围。真机验证：hash 改密 200 → 新密重登 200 → 旧密 401（E2E T4-T6）。

### C 组小结（对 AI 接入的启示）

- C5/C6 是**功能性阻断**：按 skill 流程建出的"管理员"登不上（hash 流）、且无权限——两个缺陷叠加，[B] 路径在"注册之后"实际不可用（2026-10-10 两项均已产品侧根修并部署 dev，真机 E2E 9/9；此前 C5 仅实验内对齐、C6 开放 → 管理面门户 403 不可进）。
- C1/C3 是**能力面缺口**：SDK 不支持邀请码注册；平台无发码工具——[B] 路径两端的工具链都缺，接入者被夹在中间。
- C2/C4/C9 是**语义/口径不一致**：文档说永久/示例名可用/策略强制，实现说试用/部分名保留/仅注册侧强制。
- 接入建议（本实验实际采取的绕行）：直连 REST（正确 /bff 路径）完成租户与账号生命周期；账号用非保留名；hash 约定以 SDK 实现（带 `|`）为准；管理员口令先按 plain 登录取令牌、再经改密对齐到 hash（勿用 SDK changePassword，见 C11）；脚本一律带 5xx 重试。

## D. 依赖与配置阶段（Phase 4 执行期间发现，2026-10-10）

### D1 · apiUrl 缺 `/bff` 段——SDK 全部 API 调用 404（P0）

- 现象（线上实证）：skill 两处给出 `apiUrl: 'https://api.autional.com'`（config-template.md 与 4.2 节 env 块），**无 `/bff`**。SDK 以 `${baseUrl}/identity/api/v1/...` 拼 URL（auth-client.ts:111 登录等）。
  - 直测：`GET https://api.autional.com/identity/api/v1/public/auth-config/default` → **404**（Vercel NOT_FOUND 页）；同请求加 `/bff` → **200**。
  - 网关配置：仅路由 `/bff/<svc>/...` 前缀（configs/service/gateway-service.yaml:49 起，strip_prefix 转发上游）；裸 `/identity/...` 无路由。
- 佐证（SDK 自证）：Discovery 类显式剥离 `/bff` —— 注释原文「去掉 /bff 等 BFF 路径前缀，回到根路径访问 /.well-known」（discovery.ts:28-31）→ **SDK 设计预期 apiUrl 含 `/bff`**，模板值与该预期不符。
- 影响：按模板配置接入，登录/刷新/用户信息/验证码**全部 404**，接入完全不可用。C1 只覆盖 createTrialTenant 一条路径；此条是**系统性**的（所有端点）。
- 正确值（本实验实测通过）：`apiUrl = https://api.autional.com/bff`；issuer 保持根域（discovery 用，实测 200）。

### D2 · tenantId 注入链三处断裂——登录到不了目标租户（P0）

- (a) skill 197 行明文要求「tenantId / appId / issuer / api URL：写 .env（public block）和 src/autional.ts」，但 config-template.md 的 `autionalConfig` 对象与 .env 块**都没有 tenantId 字段**。
- (b) @autional/react 的 `AutionalProviderConfig` 类型**不含 tenantId**（AutionalProvider.tsx:16-22），组装 CoreConfig 时不透传（:46-53）→ 即使把 tenantId 写进 config 对象也会在 React 层被丢弃（TS strict 下直接编译报错）。
- (c) core 的兜底提取对 canonical issuer 失效：`extractTenantFromIssuer('https://api.autional.com')` 主机名 3 段 → 取 parts[0] = **`'api'`**（autional.ts:154-167）——垃圾值。
- (d) 无参 `fetchAuthConfig()` 命中 `/public/auth-config/default`（auth-client.ts:49-51）→ 线上实测返回的是 **default 租户**配置（tenant_id="default"），且策略与我们的租户不同（default: require_special=true / breach=true；takenote-demo: special=false / breach=false）。
- (e) 登录的 hash 盐与 body 里的 tenant_id 都取决于 `credentials.tenantId` 显式传入（auth-client.ts:95 / 383 / 396）。
- 净效果：**按模板配置，SDK 永远登不进任何真实租户**（hash 盐错、tenant_id 缺、策略读错）。绕行：login 调用逐次传 `tenantId`；配置对象中不能带 tenantId（TS 拒绝），单独导出常量。

### D3 · appId 对新租户不可获得，但 React provider 类型强制要求（P1）

- skill 3.2/4.2 要求注入 appId；@autional/react 的 provider 类型 `appId: string` **必填**（AutionalProvider.tsx:17）。
- 但：新注册租户无任何「创建应用」的文档/API/入口（tenant_applications 表 takenote-demo 0 行；developer portal 需登录，而试用管理员登录即 C5 死局）。skill 自己的 Phase 3.2 凭据清单里也没有 appId 的获取途径。
- SDK 运行时对缺 appId 仅 `console.warn`（autional.ts:47-49）。实测以空 appId 继续（记入 AUTIONAL_CHANGES.md）。

### D4 · webpack（非标准前缀）无配置指引（P2）

- 4.2 的 env-prefix 表只有 Vite/Next/CRA/Node 四行；takenote 是自定义 webpack 5（dotenv + DefinePlugin，仅透传 CLIENT_ID/DEMO 两键）。
- 对该类项目：「追加 .env」对客户端 bundle **无效**（无键透传），真正生效的是模板里 `src/autional.ts` 的**字面量**——skill 未说明这一点，agent 可能在 .env 上兜圈。
- 另：skill 标注 .env 为「public — safe to commit」，但 takenote `.gitignore` 忽略 `.env` → 公共配置不随仓分发，与模板表述不符。

### D5 · Phase 7 验收第 8 步按字面无法验证目标租户（P2）

- 「fetchAuthConfig() returns the tenant policy chosen in Phase 2」——按字面（无参调用）读的是 **default** 租户配置（D2d 实证），不是接入方策略；React hook 的 context `authConfig` 同样永远是 default（AutionalProvider.tsx:111）。按 skill 写的验收要么假绿（不细看）要么误红（细看发现不是自己的策略）。

### D6 · 依赖墙：skill 安装命令在 React <18 项目上直接 ERESOLVE（P1，实测踩中）

- skill 4.1 精确命令 `npm install @autional/core @autional/react @autional/api-identity` 在 takenote（react ^16.14.0）→ npm ERESOLVE 失败（peer react >=18.0.0）；skill 无版本兼容说明与降级条款。
- 但实际不兼容是**声明级**的：扫描 react SDK dist，用到的 React API 仅 createContext / useContext / useEffect / useMemo / useState（React 16.8+ 全有）；且 react 16.14 已 backport `react/jsx-runtime`（安装后 webpack resolve 实测通过）→ peerDependencies 声明过严。
- 绕行：`--legacy-peer-deps` 后安装成功（3 包、秒级）。

### D7 · RequireAuth 不区分「未登录」与「角色不足」（P3）

- unauthenticated 与 forbidden 返回同一 fallback（RequireAuth.tsx:38-44）→ 角色不足的用户看到登录页，重登后依旧被挡 = 可能无限循环，且无提示。

### D8 · 无既有账号体系的 app 无指引（P2）

- 5.2（替换/并存/仅加守卫）与 5.3（用户表迁移）都假设 app 自带账号体系；takenote 这类 0 账号的本地笔记应用落入覆盖空白——skill 未定义「从零新建登录页 + 守卫结构」的路径，完全由 agent 自拟。

### D9 · TypeScript 工具链连锁升级（P1，实测踩中三层连环错）

- 现象：build（Phase 5.5）连续三层失败，每层都是「SDK 新语法/新 API × 项目旧工具链」：
  1. **TS1005 解析错**（24 处）：SDK 的 `dist/index.d.ts` 用了 TS 4.5+ 的 export 内联 `type` 修饰符（`export { ApiClient, type AuthResult, ... }`），takenote 装的是 typescript **4.0.3** → 解析直接失败。
  2. 升 TS 4.9.5 后 → ts-loader 8.0.5 与 TS ≥4.7 的 `resolveTypeReferenceDirective` API 不兼容（`Non-string value passed to ts.resolveTypeReferenceDirective`）。
  3. 升 ts-loader 9.6.2 → 它调用 `new webpack.WebpackError(...)`（webpack ≥5.24 API），takenote webpack **5.1.3** 无此导出 → `webpack.WebpackError is not a constructor`。
- 解决路径（本实验既不是"全升"也不是"全降"，取最小一致组合）：
  - typescript：4.5.5（第一个能解析内联 type 修饰符的版本，`--save-exact` 防止 caret 漂到 4.9）；
  - **tsconfig 加 `useUnknownInCatchVariables: false`**（TS 4.4+ 起 catch 变量默认 unknown，旧代码 `error.message` 会炸 — 官方逃生阀）；
  - ts-loader 8.4.0（8.x 最终版，webpack 5.1 API 兼容；不用 9.x 是为了不动 webpack 5.1.3 及其 2020 年代插件群）；
  - 残余 6 处 TS7057（generator 无返回注解 → yield 隐式 any，TS 4.3+ 新检查）：8 个 saga generator 补 `Generator<any, any, any>` 注解（注：更"正统"的 `SagaIterator` 注解会连锁要求所有裸 promise yield 改 `call()` 包裹，对 onboarding 场景过深，未采用）。
- 影响：任何 TS <4.5 的项目接 SDK 必踩；skill 无任何工具链最低版本声明（应给出「TS ≥4.5」或 SDK 侧降级 d.ts 语法）。这是 A 组（老项目 × 新运行时）的 TS 版翻版，同类年份差问题在 skill 里**第二次**无预案。

### D10 · 过期会话仍通过 RequireAuth（stale-user 回退）（P2，单测实证）

- `useAutional().isAuthenticated` 实为 `!!user`（AutionalProvider.tsx:120），而同名 SDK 方法 `autional.isAuthenticated()` 按 **token 过期**判定（autional.ts:199）——同名不同义。
- `autional.user` getter 回退到持久化 store 的用户对象（autional.ts:169-171）；initialize 对过期 token 直接跳过（accessToken null → 整个用户恢复分支被跳过），残留的 user 使守卫放行。
- 实证：tests/unit/client/autional/require-auth.test.tsx 第 3 例——localStorage 播入过期 JWT + 残留 user → 渲染受保护内容而非跳登录（特征化断言）。
- 影响：过期会话在**首次 API 调用 401** 之前一直显示已登录；纯本地/演示应用（不调 API）可长期停留。绕行：接入方自行校验 token 有效性后再放行。

### D11 · logout() 清理的 localStorage 键错误（P3，代码级）

- auth-client.ts:314 `window.localStorage.removeItem('autional_auth_tokens')`；而 TokenManager 实际键是 `${prefix}tokens` = **`autional_tokens`**（token-manager.ts:12/40-42）。
- 效果：该行为死代码（真清理靠 clear()+persist() 置空字段），但键名不一致会误导接入方排查「为什么登出后 local” 还有残留键」。

### D12 · register() 的租户键驼峰直传 → 注册落到错误租户（P1，代码级 + 服务端实证）

- auth-client.ts:156-160 register body = `{...data, password, password_transmission}` 原样透传；SDK 类型 `RegisterRequest.tenantId` 是**驼峰**（types.ts:30-37），而 login 显式映射 `tenant_id`（auth-client.ts:396）——同一 SDK 内两套口径。
- 服务端实证：`dto.RegisterRequest.TenantID` 的 json tag 仅 `tenant_id`（service-identity/internal/handler/dto/auth_login.go:124）；驼峰键被 gin 忽略 → `getTenantID(c)` 回退链 = 上下文 → `X-Tenant-ID` 头（SDK register 不发此头）→ **defaultTenantID**（handler/tenant_context.go:32-50）。
- 净效果：带 tenantId 调 SDK 注册 → tenant 键被忽略 → 用户被建到**服务端默认租户**（跨租户错位，安全相关）。**本实验未做该路径的线上实测**——会在平台默认租户产生真实用户，越出实验授权范围；证据为服务端 json tag + 回退链（代码级）+ 单测特征化断言。
- 绕行：接入方对注册单发原始 HTTP（本实验即如此，见 provision/register-test-accounts.mjs）；或给 http 适配器注入 `X-Tenant-ID` 头（Phase 7 实测可行）；SDK 侧修复应统一为 snake 映射。

### D13 · RegisterRequest 类型无法表达 invitation_code（P2，条件性缺口）

- SDK `RegisterRequest` 只有 email/phone/username/password/tenantId/name（types.ts:30-37），**没有 invitationCode** 字段。
- 服务端邀请制模式（`membership_approval=invitation_only`）必填 `invitation_code`（auth_register.go「仅邀请模式」检查段；tag 见 auth_login.go:123）。
- 影响范围：仅「邀请制租户」；本实验租户为 **open**（3 个测试账号即免邀请码直接注册成功，provision/register-test-accounts.mjs 注释亦确认），未踩中。
- 备注：skill 的 invite-path 材料只描述「管理员发邀请」，未提示 invitation_only 租户下 SDK register 的字段缺口。

### D 组小结

- D1+D2 叠加 = **按 skill 文档配置的接入 100% 不可用**（全部 404 + 登不到目标租户）；而正确值（apiUrl 带 /bff + 逐次传 tenantId）在 skill 全部材料中都不存在。这是继 B1（references 区配）、C1（SDK 路径）之后的**第三类文档缺陷：配置口径与部署现实脱节**（网关前缀未进模板）。
- D6 属声明过严型依赖墙，一次 `--legacy-peer-deps` 可过；D3/D4/D5/D8 是接入体验缺口；D9 是第二例「年份差 × 无预案」。
- 阶段结果：修完 D9 后 `npm run build` **通过**（webpack 5.1.3，3 条警告均为原有资源体积告警）。D10-D13 全部由 Phase 6 单测落地（5 套 26 例，含对 D10/D12 行为的特征化断言）；全量回归 28 套 127 例全绿。

## Phase 7 · 集成测试（实测，SDK 驱动）2026-10-10

- 载体：`provision/phase7-integration.mjs` —— 用 takenote 的 node_modules 内的**真 SDK**（@autional/core）驱动线上端点；凭据运行时从 test-accounts.txt 读取（不落脚本）；超时/5xx 自建重试适配器（C8 同类线上现象）。
- 结论：**8/8 PASS**，含两处对文档缺口的实测绕行：① apiUrl 带 `/bff`（D1）；② SDK register 经 http 适配器注入 `X-Tenant-ID` 头（D12）。

| #   | 步骤                   | 结果 | 关键证据                                                                                          |
| --- | ---------------------- | ---- | ------------------------------------------------------------------------------------------------- |
| 1   | Discovery              | PASS | `/.well-known/openid-configuration` 200；issuer=https://api.autional.com                          |
| 2   | Register（SDK）        | PASS | 创建 user id=01M4J6N6HR48NP9EWFR3D9R0TG（takenote-phase7）；注册不回 token，需另登录              |
| 3   | Login                  | PASS | alice 登录成功；JWT claims：sub=01M4J4P6WAXH60Y4W2J1HYCY7K · tenant_id=01M4J4BF8M2WQCTGVS2S0T9024 |
| 4   | Profile                | PASS | /auth/me 返回 id/username/email/status/must_change_password/password_expires_in/mfa_enabled 等    |
| 5   | Refresh                | PASS | 换新 access token（rotated=true）且新 token 立即可用（经 AuthClient 直调，见 D14）                |
| 6   | Logout                 | PASS | 本地态清理 + 后续 profile 走 401 路径返回 null                                                    |
| 7   | Revoked                | PASS | 登出后的旧 access token → **HTTP 401**（服务端真撤销，非仅本地清理）                              |
| 8   | AuthConfig(tenant)     | PASS | tenant 与 transmission=hash 与 Phase 2 选择一致；display 名为空串                                 |
| 附  | fetchAuthConfig() 无参 | INFO | 命中 default 租户（special=true）——D2d 线上复核                                                   |

- 实测观察：API 面**间歇性高延迟** —— /auth/me 三次 15–20s 超时、auth-config 一次 20s 超时，均为重试后成功；裸 SDK 的 AuthClient 无重试（见 D16）。

### D14 · skill 步骤 5「sdk.refreshToken()」在公开 API 上不存在（P3）

- `Autional` facade 只有 `getRefreshToken()`（读值）；`refreshToken()` 仅存在于内部 AuthClient（`autional.ts:70` 匿名注入），React hook 亦无。
- 按字面执行 8 步会在第 5 步断掉；实验改用公开导出的 `new AuthClient(...)` 直调（refreshToken 实测通过）。
- 意义：skill 把「刷新」列为 facade 能力，但对外只有「顺带刷新」（expired access token → getAccessToken 内部触发）；接入方想显式轮换必须绕过 facade。

### D15 · logout() 是 fire-and-forget：Promise 完成 ≠ 服务端撤销完成（P3，实测无可见窗口）

- auth-client.ts:307-312：登出 POST 不 await（`.catch(()=>{})`），本地清态先完成、HTTP 在途。
- 实测（`provision/phase7-logout-window.mjs`）：同链路 366ms 后再探旧 token → 已 401——未观测到可利用窗口。
- 结构风险仍在：logout() resolve 不代表服务端已撤销；多标签页/本地转存 token 的场景只能靠服务端撤销时机兜底。

### D16 · AuthClient 无重试策略（ApiClient 才有）→ 线上间歇超时直接冒泡用户（P2，实测踩中）

- ApiClient 内建 5xx/网络重试（指数退避，api-client.ts:125-142）；AuthClient 所有方法**裸调 http.request**，无重试、无超时策略。
- 实测：8 步流程中 4 处 15–20s 超时（/auth/me 为主 + auth-config 一次），全部由实验自建的重试适配器消化；若按 skill 直接用 facade 登录/取资料，这些超时会以错误形式抛给终端用户。
- 建议：AuthClient 复用 ApiClient 的重试/退避；skill 失败处置表补注「SDK 哪一层已经重试、哪一层没有」。

## Phase 8 · 浏览器端到端（实测：踩中 CORS 墙 → dev 代理绕行后全绿）2026-10-10

- 结论先行：按 skill 配置接入后，**浏览器端 100% 不可用**（D17 全阻断，登录第一跳即死）→ 实现同源代理绕行后 E2E 全绿。
- E2E 清单与结果（Playwright 实测）：

| #   | 检查           | 结果 | 关键证据                                                                                               |
| --- | -------------- | ---- | ------------------------------------------------------------------------------------------------------ |
| 1   | 登录 → /app    | PASS | alice 登录成功 → 跳转 /app，TakeNote 全 UI 渲染（侧栏/分类/欢迎笔记）                                  |
| 2   | 重载会话保持   | PASS | ignoreCache 硬重载仍停留 /app（localStorage `autional_tokens` 供 token）                               |
| 3   | 多标签登出联动 | PASS | 标签 A 点 Log out → A、B 两标签同时跳 /login；存储字段全部清空（保留空壳 stub）；POST /auth/logout 200 |
| 4   | 错误密码       | PASS | HTTP 401 → 页面显示 "Login failed"，不跳转                                                             |
| 5   | CAPTCHA        | N/A  | 本租户安全策略未启用验证码                                                                             |

- 绕行（两处，均进 fork）：
  1. `config/webpack.dev.js`：`'/bff'`、`'/.well-known'` → `https://api.autional.com`（changeOrigin）——浏览器视角全部同源，CORS 不再参与；
  2. `src/client/autional.ts`：demo 分支 `apiUrl = window.location.origin + '/bff'`（必须**绝对同源**，理由见 D18）。

### 本 Phase 的两类假绿（均实际踩中，方法论教训）

1. **Node ≠ 浏览器**：Phase 7 用 Node 直驱 SDK 得 8/8 PASS —— 但 Node/curl 无 CORS 约束，浏览器首调全灭。**「SDK 集成测试」只跑 Node 会漏掉整个浏览器安全模型**；skill 的验证清单亦无浏览器项。
2. **200 ≠ 正确响应**：curl 探测代理曾以「200 OK」误判通过——实为 dev server 的 SPA 回退把未知路径喂了 index.html（HTML 也是 200）。**验证代理必须核响应体/Content-Type，不能只看状态码。** 同类坑：`TaskStop` 停 npm 任务会**孤儿化 node 子进程**（Windows 进程树），旧 dev server 继续持有 :3000 → 新任务 EADDRINUSE 静默失效 → 出现「配置改了不生效、但 bundle 却是新的」幻象（旧 watcher 重编译新源码）。先 `netstat -ano` 认端口属主再排障。

### D17 · CORS 墙：按 skill 配置的浏览器端接入 100% 不可用（P0，浏览器实测）

- 现象（控制台原文）：
  - 初始化 discovery：`Access to fetch at 'https://api.autional.com/.well-known/openid-configuration' from origin 'http://localhost:3000' has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present`
  - 点登录：`POST .../auth/login ... Response to preflight request doesn't pass access control check: No 'Access-Control-Allow-Origin' header`
- curl 探测矩阵（2026-10-10）：

| 请求                                              | 结果 | ACAO                           |
| ------------------------------------------------- | ---- | ------------------------------ |
| OPTIONS 预检 /bff/.../auth/login                  | 204  | **无**（预检失败 → POST 不发） |
| GET /bff/.../public/auth-config/{tid}             | 200  | `*`（公开端点豁免）            |
| GET /.well-known/openid-configuration             | 200  | **无**（响应被浏览器扣留）     |
| POST /bff/.../auth/login（带 Authorization/JSON） | —    | 预检即挡                       |

- 机制：服务端按 **origin 白名单**签发 ACAO（`ACA-Credentials: true`，Allow-Headers 含 `X-Tenant-ID`/`X-Entry-Plane`）；本地/自部署域名不在白名单 → 全部预检被拒。SDK 侧其实**内置了同源代理模式**（Discovery 支持 discoveryBaseUrl、AuthClient 走 config.apiUrl）——可见「同源反向代理」是官方预期的浏览器部署形态；但 **skill 配置模板只给直连 apiUrl，全文无 CORS/代理部署说明，也无白名单申请入口**（第四类文档缺陷：运行时安全模型未进接入材料）。
- 影响：接入方在域名获批前浏览器端 0 可用；失败发生在登录第一跳，错误信息面向开发者、终端用户无从自查。
- 绕行：同源 dev 代理（上表两处配置）。生产形态应二选一：域名加白名单，或前端同源自反代。
- 未做：白名单自助配置路径验证（skill/开发者门户均未见入口，未进一步深挖）。
- **根治（2026-10-10 当日）**：四层断点全修（core 空头 / 网关白名单 / oauth 动态 CORS / 注册数据链）+ SDK SSO 全链重写——应用登记 redirect_uri + cors_origins 即可浏览器直连（代理模式保留可选）。详见后文「根治」节。

### D18 · SDK discovery 的代理模式对相对 apiUrl 静默降级（P2，代码级 + 实测踩中）

- `Discovery` 构造：`discoveryBaseUrl = (apiUrl || '').replace(/\/bff\/?$/, '')...`，`discover()` 里 `base = this.discoveryBaseUrl || issuer`（discovery.js:10-19）。
- 传**相对** `apiUrl = '/bff'`：strip 后 = `''` → falsy → **静默回退到绝对 issuer** → discovery 又变跨域（同源代理失效一半）。
- 实测：第一版绕行即用相对写法 → 浏览器仍跨域打 `https://api.autional.com/.well-known/...`（CORS 错误复现）；改为绝对 `window.location.origin + '/bff'` 后同源 200。且 facade 构造只把 `config.apiUrl` 传给 Discovery（index.mjs:1063）——没有独立配置 discovery 基址的入口。
- 意义：SDK 的代理模式可用但踩点隐蔽（最自然的相对路径写法恰好降级且无任何警告）。建议 SDK：strip 后为空串时保留相对基址（浏览器同源 resolve），或显式报配置错误。

### D19 · demo「Log out」只清 Redux、不结束 Autional 会话（P2，app 集成缺口，本 fork 已修）

- 现象：takenote 既有登出只 `dispatch(logout)`（SettingsModal.tsx:57）→ demo 分支 saga 仅 `put(logoutSuccess())`（sagas/index.ts:41-53）——**SDK token 与会话原封不动**：Redux 看似登出（用户信息清空），刷新页面立刻又「已登录」（RequireAuth 看 SDK 持久态）＝ 登出按钮形同虚设。
- 修复（fork）：登出 saga 经一个 React 无关的桥接函数 `endAutionalSession()`（`autional.ts`）结束 SDK 会话——SDK：清 token + 服务端撤销 + TabSync 广播；桥接函数由入口处组件（`index.tsx` 的 AutionalSessionBridge）用 `useAutional().logout()` 注册（见 AUTIONAL_CHANGES.md）。选择 saga 桥接而非组件内直接调 hook：登出流程原本就在 saga，且避免让被测组件依赖 Autional Provider（首版直接改 SettingsModal，TakeNoteApp 单测 1 例红，故改道）。
- 实测（修复后，两标签闭环）：标签 A 登录 → A、B 同时进 /app（登录也走 TabSync）；标签 A 登出 → A、B 同时回 /login；`POST /auth/logout` 200；本地存储字段清空（保留空壳 stub）。
- 归属：SDK 侧能力齐全（hook 有 logout、TabSync 广播）；这是**接入方集成缺口 + skill 文档只覆盖「进」（provider/守卫）不覆盖「出」（登出接线）**。建议 skill 增「会话生命周期」步骤：登录、登出、登出联动、过期处置四项验收。

### D20 · 网关抖动 × 代理 502 text/plain → 用户看到 JSON 解析错误（P2，实测）

- 实测链路：登录时上游间歇 502（跨境链路抖动，与 D16 同类现象）→ dev 代理以 `text/plain` 返回 "An error occurred while trying to proxy…" → SDK http 适配器按 JSON 解析失败 → 页面错误条显示 `Unexpected token 'A', "An error o"... is not valid JSON`（用户无法理解）。
- 放大效应：auth-config/login 无重试（D16）→ 每次抖动 = 一次用户可见失败。实测登录共 3 次点击才成功（2×502 后 200）；E2E 期间 auth-config 三连 502/超时。
- 建议：http 适配器对非 JSON 响应归一化为「网关/网络错误」；AuthClient 补重试（同 D16）。skill 快速排错表补「页面出现 Unexpected token '<' 之类 → 上游不是 JSON（常为代理/网关错误页）」。

### Phase 8 小结

- 一天内两轮「全绿假象」：Phase 7 的 Node 8/8、代理探测的「200」——都被更真实的一层推翻（浏览器安全模型 / 响应体校验）。**接入验证的最后一跳必须是真浏览器。**
- CORS 墙（D17）是本次实验**唯一 P0**：它不来自代码错误，而来自「skill 未文档化运行时安全模型」——老项目接入前不可预测、失败点最早、对用户最不友好。建议 skill 把「部署形态（同源反代 or CORS 白名单）」列为接入前置决策项。
- D18/D19/D20 均为「文档只讲半程」型缺口（代理配置半程、会话生命周期半程、错误面处理半程）。

## 深挖（2026-10-10 代码级）：C6 / C11 / C5 本质分析与修复设计

> 方法：两侧源码对账。SDK 仓 `autional/sdk`（master 经 gh api 直读，本地无检出）；服务端本地工作区 `shared/service-identity`、`shared/service-rbac`、`shared/service-tenant`。每条含代码指针，可逐条复核。

### 一句话本质

| 项  | 本质模式            | 一句话                                                                          |
| --- | ------------------- | ------------------------------------------------------------------------------- |
| C6  | 意图黑洞 + 播种无主 | `initial_role` 从未被服务端"认识"；新租户 RBAC 在任何生命周期链路上无人负责播种 |
| C11 | 双写契约 + 自证测试 | SDK 与服务端各写各的改密字段名；SDK 单测背书错误契约 → CI 永远绿，线上必 400    |
| C5  | 语义豁免叠加        | 注册允许"不声明传输口径"（空串豁免）→ 库存明文；验证按字节精确比对 → 永远登不上 |

共同结构：**同一事实的多个副本（文档 / SDK / 服务端 / 测试）之间没有任何机器对账**。

### C6 深挖：死结的每一环（全链代码证据）

```
service-tenant                  service-identity                    service-rbac
──────────────                  ────────────────                    ────────────
CreateTrialTenant
 ├ 建租户
 ├ 建安全策略（仅此，无 RBAC 步骤）
 └ RegisterTrialAdmin ──POST /auth/register──▶ RegisterRequest DTO
    body 带 initial_role=super_admin           无该字段 → 静默丢弃
    （client.go:113）                          （dto/auth_login.go:115-125）
                                                 │
                                      CreateUser 内 InitialRole 全逻辑存在
                                      （建角色+绑定，user_service.go:663-695）
                                      但 HTTP/gRPC 均无入口 → 仅 dev seed 触达
                                                 │
                                      ApplyDefaultRoles ──gRPC──▶ rbac_tenant_default_roles 空
                                      （user_service.go:655）      → return 0, nil（不报错）
                                                                   （rbac_service.go:1493-1499）
```

逐条事实：

1. **发布方以为成功**：`RegisterTrialAdmin` 收到 200/201 即返回 nil（client.go:130-132）；调用方记日志 "trial admin created"（tenant_service.go:382）。"（含 super_admin 权限）"是注释里的美好愿望。
2. **接收方不知情**：`Register` 用标准 `ShouldBindJSON`（auth_register.go:73）——未知键静默忽略；identity 全仓零 `initial_role` 处理（HTTP DTO 无、gRPC 无）。
3. **兜底逻辑存在但断路**：identity 的 InitialRole 路径完整（查角色 → 缺则建 → `permanent` 绑定，user_service.go:663-695），当前唯一触达方是 **dev seed**（demo_accounts.go:155）——生产 HTTP 路径零触达。
4. **默认角色同样空转**：`ApplyDefaultRoles` 查 rbac 的 `tenant_default_roles` 表 → 空 → `return 0, nil`。该表仅平台租户由种子写 2 行（guest / device_guest，platform_rbac.go:5）——**任何新租户都是 0 行**，member 也永远不会自动到手。
5. **租户开通链无 RBAC 步骤**：CreateTrialTenant 只建安全策略（tenant_service.go:348-356）；管理面 CreateTenant 同构（注释自证"与管理面一致"）——开通路径全族同病。
6. **兜底通道被门禁**：`POST /internal/rbac/bootstrap-admin` 仅 `APP_ENV=development` 可用（internal_handler.go:207，生产 403）。
7. **跨租户护栏封死自救**：rbac 管理 API 三重要求——JWT 租户 == X-Tenant-ID（router.go:67）+ 本租户 admin 类角色（:70）+ `rbac:admin` 权限（:72）。0 角色租户内无人可调。
8. **为什么"建角色"就够解锁**：`CheckPermission` 对 `super_admin`/`admin` 角色码有**全量旁路**（rbac_service.go:677-688）——最小播种 = 租户内建 super_admin 角色 + 绑定，**不需要权限行**；入口平面（同码表，entry_plane_authz.go）随之放行，门户全通。

死结图（当前生产实测）：

```
管理员(0 角色) ──登录──▶ 403 entry plane not authorized
     ▲                          │
     │                          ▼
  发角色需要                  发角色需要
  管理面权限 ◀─────────────── 管理面入口
        （鸡生蛋；当前唯一出口 = 平台侧 DB 播种）
```

修复设计（三层）：

| 层                 | 动作                                                                                                                                                                                      | 覆盖                       | 成本                 |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- | -------------------- |
| 存量修复（本租户） | 平台侧播种：rbac 库 2 行——`rbac_roles` 建 super_admin 行 + `rbac_user_roles` 绑定管理员（可选：member 角色 + `rbac_tenant_default_roles` 行）                                             | takenote-demo 门户即刻解锁 | 生产 DML，按窗口纪律 |
| 治本·最小          | identity `RegisterRequest` 补 `initial_role` + 映射进 `CreateUserRequest`；**仅限带 X-API-Key 的内部调用生效**（公开注册忽略该字段防提权；auth_register.go:107 已有内部调用判别先例）     | C6 主链                    | ~10 行 + 测试        |
| 治本·完整          | rbac 新增内部 API `POST /internal/rbac/bootstrap-tenant`（API-key、幂等）：种 super_admin / admin / member + 默认角色行 + 可选 admin 绑定；service-tenant 开通链（试用 + 管理面）显式调用 | C6 + C7 全族、member 上线  | 中                   |
| 防线               | 开通 E2E 断言：建租户 → 管理员 admin 平面登录 200 → `check-role super_admin` true → 普通账号 `check-role member` true                                                                     | 防复归                     | 小                   |

> 注：identity InitialRole 路径若被触达会**自动建角色**（user_service.go:670），无需 rbac 预置；但角色无权限行（super_admin 旁路下不阻碍门户；如需权限列表完整，走完整方案）。

### C11 深挖：错误的契约为什么能同时活过 CI 和评审

证据对账表：

| 副本                   | 字段名                                 | 指针                                       | 状态                        |
| ---------------------- | -------------------------------------- | ------------------------------------------ | --------------------------- |
| 服务端 DTO（真源）     | `old_password` / `new_password`        | dto/user.go:165-169                        | 权威（线上 400 报错名可证） |
| SDK 实现               | `current_password` / `password`        | auth-client.ts:209-213（0.3.0 = 最新主干） | 错误                        |
| SDK 单测               | 断言 `body.current_password`           | auth-client.test.ts:329-334                | **背书错误契约**            |
| 门户前端（参考客户端） | 生成客户端 `HTTPChangePasswordRequest` | generated/api.ts:5412                      | 正确（从未走样）            |
| 服务端兼容别名         | 全仓零 `current_password`              | 服务端 grep 实证                           | 无                          |

结论：SDK 手写客户端独立演化；单测对着手写实现写——**只证明"实现符合自己的假设"，不证明"符合服务端"**。SDK 仓无跨边界契约校验（无对 identity OpenAPI 的机器对账、无真实服务端集成测试）。

深一层（修复必须覆盖，否则修完仍是半修）：

- **服务端改密链没有解密阶段**：`changePasswordCore` 直接 `verifyPassword(旧)` / `hashPassword(新)`（user_service.go:1519/1553），无 `preprocessPasswordForTransmission`（对比：登录链 :1243、建户链 :479 均有）。
- **两层 DTO 均不收密钥交换字段**：`dto.ChangePasswordRequest` / `domain.ChangePasswordRequest` 都没有 `key_exchange_id` / `client_pub_key`（user.go:165-169 / 508-515）；SDK 却照发（auth-client.ts:214-215）——发到空气里。
- **推论（symmetric / asymmetric 租户）**：即使字段名改对——旧口令密文比对必失败（表现成"原密码错"）；新口令密文被当明文哈希入库，且密文含随机 IV 每次不同 → **账号永久锁死**。"不是不可用，是危险地静默损坏"。
- **同族漂移（注册链）**：HTTP 注册 DTO/handler 同样无密钥交换字段（auth_register.go:154-162 无 KeyExchangeID 映射）→ symmetric 租户的公共注册同病；SDK 注册也照发 key_exchange_id / client_pub_key（auth-client.ts:161-162）。

修复设计：

| 方案            | 内容                                                                                                                              | 适用                            | 取舍                            |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- | ------------------------------- |
| A（首选，最小） | SDK 改 `old_password` / `new_password`；单测断言同步改；发 0.3.1                                                                  | plain/hash 租户（当前现实全部） | 治本；不动服务端契约            |
| B（完整）       | 服务端补全：DTO/domain/handler 加密钥交换字段 + `changePasswordCore` 前置解密（旧+新）；注册链同补                                | symmetric/asymmetric 租户       | 工作量中；需与 A 同发才真正可用 |
| C（兜底防御）   | 服务端对不支持的模式**显式 400**（fail loud），替代当前"静默损坏"；plain/hash 照常                                                | 全部                            | 无论 A/B 是否落，建议都做       |
| 防回归          | ① SDK CI 加契约对账（字段名对 identity OpenAPI schema 机器校验）或真实服务端集成测试；② 贡献指南写明"mock 型单测不得作为契约证据" | ——                              | "双写契约"模式的通用解药        |

> 成因线索：SDK 注释自述"移植自 web/packages/shared/src/utils/password-transmission.ts"——只移植了加密模块；改密请求体是 SDK 作者手写的新代码，没有生成客户端可抄。

### C5 根因闭环（补代码级链条）

- **注册侧两处"空串豁免"**：handler 检查 `req.PasswordTransmission != "" &&` 才做策略比对（auth_register.go:140）→ 空串绕过；service 层同构（user_service.go:462）→ 空串跳过一致性校验。`RegisterTrialAdmin` 正好不声明（空串）→ 明文入库在 hash 策略租户内"合法化"。
- **验证侧无策略换算**：`verifyPassword` 字节精确比对存储哈希（user_service.go:1519）→ 库是 argon2(明文)、客户端按策略送 hash → 必 401。
- 两处豁免各自"为兼容历史"，叠加 = 死锁。**修复与 C6 同缝**：`RegisterTrialAdmin` 声明 `password_transmission=hash` + 预哈希（与 C5 建议同一处改）；或注册侧对非 plain 策略**拒绝空串**（收紧 auth_register.go:140 的豁免）。

### 修复落地对照（2026-10-10 当日实施）

深挖节提出的修复设计 → 实际落地形态。三仓（rbac / identity / tenant）依序合并 master（硬序：tenant 新请求依赖前两者能力），CI 自动部署 dev 三连 SUCCESS；SDK 走 GitHub PR。

| 缺陷    | 深挖设计（本文件提议）                                                                                                              | 实际落地                                                                                                                                                                           | 收敛 / 差异                                                                                                                     |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| C6 治本 | 最小：identity `initial_role` 通道（X-API-Key 门）；完整：rbac **新增内部 HTTP API** `POST /internal/rbac/bootstrap-tenant`（幂等） | identity `initial_role` 通道 ✅；rbac **复用既有 gRPC `BootstrapTenantRBAC`**（幂等化改造：三角色 find-or-create + exact code 比对 + 重放测试）；tenant 试用链显式调用（先于注册） | **③ 由「新增 HTTP API」收敛为「复用既有 gRPC」**——普通建租户链本就调用该 RPC（tenant_service.go:213-221），免造新面、免新鉴权缝 |
| C5      | `RegisterTrialAdmin` 声明 `password_transmission=hash` + 预哈希口令                                                                 | 同（tenant `identity/client.go` 单点改：body 加 transmission + `sha256hex(pwd\|tenantID)`；非 2xx 错误附响应体摘要）                                                               | 完全一致；注册侧"空串豁免"本体未收紧（另一争议面）                                                                              |
| C11     | A 字段名对齐（首选）+ C 服务端 fail-loud 兜底；B 完整密钥交换支持                                                                   | SDK PR #1（A：字段名 + **双密码**预处理 + 租户配置取错修正 + symmetric/asymmetric 显式报错）；identity `changePasswordCore` fail-loud 61001670（C 兜底）                           | B 明确非目标；**单测修正注意**：旧断言是错误契约的背书，属"必须替换"而非"过时删除"                                              |
| 防线    | 开通 E2E 断言：建租户 → 管理员登录 200 → `check-role super_admin` true → `member` true                                              | `service-tenant/e2e/trial-onboard-e2e.mjs`（纯 Node：注册 → hash 登录 → check-role ×2 → hash 改密 → 新密重登 / 旧密 401 → 软删清理），真机 **9/9 绿**                              | 加 T4-T6 改密段（C11 一并入防线）                                                                                               |

**实施期新坑（E2E 首跑暴露，值得记入接入方知识）**：网关 **host × 受众双绑定**（`gateway-service.yaml` `entry.host_audiences`）——`api.<入口域>` host 仅放行 **machine** 受众，而 `check-role` 路由受众是 **user** → 经 api host 调用得 `403 40000503 route not available on this host`（登录/公开路由受众 public 不受 host 约束，恰好掩盖了这一层）。实测 `user.` / `auth.` / `cn.` host 均放行（401 非 403）；E2E 探针据此把 user 面调用改走 `user.<入口域>`。对消费方启示：**user 面路由（check-role 等）不能经 machine 入口调用**，须走对应门户 host；该行为是网关设计语义（P5 双绑定），但错误码（40000503 "route not available on this host"）对"host 对了、受众不对"的场景不具指向性，排查成本高。

### 结构性教训（对产品的通用含义）

1. **静默丢弃是本案大头**：C6 字段被丢、ApplyDefaultRoles 空表返回 0、服务端未知键忽略——"静默"让缺陷活到线上。建议公共 API 开 `DisallowUnknownFields`（或未知键告警）；内部调用链的"意图字段"必须有一端实现，另一端可测。
2. **安全策略检查别留空串豁免**：策略有默认值时，空值要么等价显式默认、要么拒绝；不能当"跳过检查"。
3. **新租户生命周期 checklist**（安全策略 / RBAC 播种 / 默认角色 / 成员物化）应有单源清单，所有开通路径共同遵守，并有 E2E 断言绑定。

## 根治（2026-10-10 当日）：形态 2「用 Autional 登录」+ CORS 墙四层断点

> 拍板形态 2：应用「用 Autional 登录」→ Autional 当 IdP（授权码 + PKCE 强制）。放弃逐客户接社交 IdP——每客户独立接 Google/微信等的路径不可规模化。本线 = SDK OAuth 方法重写对齐 SSO + CORS 四层断点根治 + skill 接入步骤（5.2b）+ 客户端注册数据链修复。通用目标：任何系统（SPA / 有后端应用 / 移动端）可接入，可用性、方便性、稳定性、安全性四维保障。

### 结论先行

| 断言                                                                      | 依据                                                                             |
| ------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| CORS 墙（D17）根因 = **四层断点叠加**，非单点配置                         | 代码级逐层追踪（下表）；空头污染与白名单两层不修，后两层修上也白修——四层全修才通 |
| 修复后应用**只需登记两样**（redirect_uri + cors_origins），浏览器直连可用 | oauth 动态 CORS，登记后 TTL 60s 生效；无需自建代理                               |
| 社交登录在 IdP 侧配置**一次**                                             | 形态 2 的 IdP 汇聚语义                                                           |
| SDK 原 OAuth 方法**必被服务端拒**（换票缺 client_id + code_verifier）     | 本次全链重写                                                                     |

### 四层断点与修复（逐层）

```
浏览器应用 origin ──▶ ①网关（core security.CORS）──▶ ④oauth 动态 CORS ──▶ 应答

断点①  core CORS：origin 未命中白名单 → Set 空 ACAO 头后放行
        → 空头与下游注入头并存 = 多值头 → 浏览器拒收；且阻断下游动态应答路径
修复    micro-middleware/security/cors.go：未命中不注入任何头、直接放行
        （OPTIONS 同样透传，由下游动态 CORS 就地应答 204）
        ⚠ 网关的 gin_pkg.WithCORS 只是该中间件的薄包装（stack.go:49 委派
          security_mw.CORS）——单点修复覆盖网关全链
断点②  网关白名单（cors.allow_origins）= 部署注入的门户域
        → 第三方应用 origin 永不在列
修复    无需改网关配置：断点①修好后未命中即透传，由下游（oauth）动态应答
断点③  oauth 客户端 cors_origins 字段「存而不用」（无消费端）
修复    新增 OriginRegistry（全客户端 cors_origins 并集；TTL 60s 惰性刷新、
        失败保留旧快照）+ DynamicCORS（命中回显精确 origin + Vary: Origin；
        OPTIONS 预检就地 204；未命中/无 Origin 透传）
断点④  客户端注册请求 DTO 无 cors_origins 字段 + handler 不映射
        → 数据入口就断（登记了也存不进库）
修复    dto.go 加字段 + handler_client.go 六处映射/回吐
```

| 层              | 文件                                                                                                        | 状态                     |
| --------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------ |
| core CORS 空头  | `service-core/micro-middleware/security/cors.go`（+ cors_test.go 14/14）                                    | 已修（未提交）           |
| oauth 动态 CORS | `service-oauth/internal/middleware/dynamic_cors.go`（11 用例）+ `repository/cors_origins.go` + main.go 接线 | 已修（未提交）           |
| oauth 数据链    | `internal/handler/dto.go`（CorsOrigins 字段）+ `handler_client.go`（六处映射/回吐，2 用例）                 | 已修（未提交）           |
| SDK SSO         | `packages/core`（pkce.ts 新建 + auth-client 重写 + token-manager 会话模式）                                 | 已修（未提交，93/93 绿） |

### 形态 2 全链（目标态时序）

```
应用（SPA/有后端）                      Autional IdP（auth.<入口域>）
─────────────────                      ────────────────────────────
loginWithOAuth({})
 └ 生成 PKCE（verifier/challenge S256）+ state（存 sessionStorage）
 └ 整页跳 /oauth/api/v1/oauth/authorize?response_type=code
     &client_id&redirect_uri&scope&state
     &code_challenge=…&code_challenge_method=S256  ──▶ 登录/同意（社交登录
                                                       Google/微信等在此接一次）
   ◀── 跳回 redirect_uri?code&state ──
handleOAuthCallback()
 └ state 校验 → POST /oauth/api/v1/oauth/token
     {grant_type:authorization_code, code, client_id, code_verifier}
     （public client 免 client_secret）                （成功响应顶层，无 data 包裹）
 └ GET /oauth/api/v1/oauth/userinfo（Bearer）填用户
 └ 会话记 SSO 模式 → 后续 refresh 自动走
     /oauth/api/v1/oauth/refresh（凭 client_id）
```

### 通用接入纪律（对任何接入方，已写进 skill 5.2b）

1. **注册应用登记两样**：redirect_uri（精确匹配）+ cors_origins（浏览器直连 origin；纯服务端调用可不登记）。TTL 60s 内生效，免重启。
2. **域分工**：API 调用 → api.<入口域>（apiUrl 含 `/bff`）；浏览器授权跳转 → auth.<入口域>（`/oauth/...` 协议标准坐标，公开路由）。api 域 authorize 对无会话浏览器 = 死路（login_required）。SDK 自动推导（api.↔auth. 同后缀），`authorizeUrl` 可显式覆盖。
3. **PKCE 强制**：public client（SPA / 移动端）无 code_challenge 直接拒；换票必带 client_id + code_verifier。机密 client（有后端）走 client_secret。
4. **响应契约**：token / userinfo 成功响应为**顶层**（无 data 包裹）；错误体为 OAuth2 标准 `{error, error_description}`——SDK 已双兼容解析（identity 风格 `{code,message}` 是另一体系）。
5. **刷新分路**：SSO 会话 refresh 走 oauth（公开 client 凭 client_id）；密码会话走 identity。SDK 按会话模式自动分派，接入方无感。
6. **边界（未做）**：浏览器直连 identity 的**密码**登录（非 SSO）仍受网关白名单约束——第三方 SPA 建议一律走 SSO；如需直连密码登录另议。

### SDK 侧修复对照（@autional/core 0.3.2；定级 minor→patch）

| 处                  | 原态（0.3.1）                              | 现态                                                                                                                       |
| ------------------- | ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| loginWithOAuth      | 跳 api 域 authorize；无 PKCE               | 跳 auth 域 + PKCE S256 + state；`OAuthOptions` 破坏性变更（clientId/scope/authorizeUrl/extraParams；appId 兼作 client_id） |
| handleOAuthCallback | 缺 client_id + code_verifier（服务端必拒） | state 校验 → 换票 → OIDC userinfo → 会话记 SSO                                                                             |
| refreshToken        | 一律 identity 路径                         | 按会话模式分派（SSO → oauth refresh）                                                                                      |
| logout              | 一律调 identity logout                     | SSO 会话不调（RP-Initiated Logout 需整页跳转，由应用发起）                                                                 |
| 新导出              | —                                          | generatePkce / generateState / buildAuthorizeUrl / resolveSsoAuthorizeUrl / PKCE session 工具                              |
| 参考实现            | —                                          | demo：SSO 按钮 + `/oauth/callback` 路由页                                                                                  |
| 验证                | —                                          | 单测 93/93（含换票参数断言、state 防 CSRF、模式分派）；typecheck 全绿                                                      |

**发布轨迹（10-11）**：PR #3 合并 `283c89f` → 发版提交 `f690c38` → npmjs 发布（tag `next` → 隔离冒烟 → 提 `latest`）→ npmmirror 同步。定级修正：minor→**patch**（旧 OAuth 路径此前无法完成换票、无可用旧行为可破坏；且 0.x minor 会级联 dependent 包 major，patch 零级联）。

### 执行清单与结果（全链闭环，2026-10-10 → 10-11 收官）

| #   | 动作                                                              | 结果                                                                                                                     |
| --- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| ①   | 提交 core CORS 修复 → tag `micro-middleware v1.0.36`              | ✅ 已提交 + 已 tag                                                                                                       |
| ②   | bump 使用方（**gateway 必含**；identity 等建议）                  | ✅ 已 bump → 各自 CI dev 部署 OK                                                                                         |
| ③   | 提交 oauth（动态 CORS + 数据链）→ CI dev                          | ✅ `960a5d8`（动态 CORS + 数据链）+ `1950a7d`（T7 refresh 修复）→ CI dev build+deploy OK                                 |
| ④   | SDK 分支 + PR（base main）+ changeset                             | ✅ PR #3 已合并（`283c89f`）→ `@autional/core@0.3.2` 已发布（npmjs；npmmirror 同步）                                     |
| ⑤   | skill 三通道发布（com web / cn web / CDN）                        | ✅ 全发：web `f3e94ed` / CDN `f3b4024`（com `v0.1.0-6cdb6716`、cn `v0.1.0-ecb907ae`）；T4 复验 34/34（见下「发布收官」） |
| ⑥   | dev E2E：注册 client（redirect_uri + cors_origins）→ SSO 全链真机 | ✅ 三腿全绿：CLI 18/18 + 浏览器 12/12 + **线上生产复验 9/9**（见下节）                                                   |
| ⑦   | lab 台账提交（本文件，feature/autional）                          | ✅ 本节                                                                                                                  |

> ⑥ 实测又挖出两个新缺陷（T7 refresh 契约 / T8 同意页提交链），并纠正一处部署拓扑误解——详见下节「SSO 接入线实证」。

## SSO 接入线实证（2026-10-11）：T7 / T8 两缺陷 + 部署拓扑纠正

> 来源：⑥ dev E2E 真机执行（CLI 腿 + 浏览器腿）→ 又挖出两个缺陷；做线上复验时纠正一处部署拓扑误解。本文为实测记录。

### 结论先行

| 断言                                                                                                                                                          | 依据                                                                       |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| **T7** = SSO 会话刷新契约缺陷：`/oauth/refresh` 只收 JSON，SDK 与 RFC 6749 §6 标准客户端发 form-urlencoded → 必 400 → 刷新静默死亡                            | 真机 E2E 实证 → 已修（`1950a7d`，form 优先 + JSON 回退）                   |
| **T8** = 公开客户端浏览器同意提交链断裂：同意页原生表单 POST 无法携 Authorization 头 → 服务端会话绑定必拒 → 任何公开客户端（SDK 默认形态）浏览器 SSO 无法完成 | 探针双路实证（A 断链 302 / B fetch 契约 200）→ 已修                        |
| **拓扑纠正**：`auth.autional.cn/.com` 线上源 = **GitHub `autional/auth`**（Vercel 双区单源）；gitee `authms/web` 是**遗留副本**，push 不触发任何部署          | 四证（见下）；**线上同意链自 2026-09-29 起已是 fetch 实现，无 T8 缺陷**    |
| 线上生产复验 9/9 PASS                                                                                                                                         | 真浏览器 × 线上 auth.autional.cn × 全链（拒绝 / 同意换票 / 零异常 / 清理） |

### T7 · SSO 刷新契约缺陷（已修 1950a7d）

- **现象（E2E 真机）**：SSO 全链跑至 refresh 步必 400 `invalid character 'g'`。
- **根因**：`RefreshToken` handler 仅 `ShouldBindJSON`；SDK `refreshSsoToken` 与 RFC 6749 §6 标准客户端发 `application/x-www-form-urlencoded`。协议面与服务面口径不一致 → 会话过期刷新**静默死亡**（用户表现为被登出，无错误提示）。
- **修复**：form 优先（PostForm，与 `/oauth/token` 同口径）+ refresh_token 为空回退 JSON（存量消费方兼容）；补 form 路径单测；swagger @Accept 同步。
- **外溢排查**：扫全部 handler 的绑定方式——除 T7 外检出 device authorize / PAR 同类（见下「台账留档」）；SDK 接入路径（authorize / token / refresh / userinfo）已全覆盖无遗漏。

### T8 · 公开客户端浏览器同意提交链断裂（已修 + 拓扑纠正）

**缺陷本体**：auth-pages 同意页用原生表单 POST `/oauth/api/v1/oauth/authorize`。浏览器原生表单**无法携 Authorization 头** → 服务端 TASK-15 会话绑定校验必拒（302 login_required）→ 公开客户端（PKCE/SPA 标准形态，即 SDK 默认模式）浏览器同意链断路。
**修复**：页面改 fetch 提交（Authorization Bearer + `Accept: application/json` + form-urlencoded body）；approve/deny 双走服务端 JSON 契约。服务端契约（TASK-15 / AUTH-47，oauth `3949cd1`，10-05）早已就绪，缺的是前端迁移。

**拓扑纠正（四证）**——先前认知「web 仓 push → auth.autional.cn 部署」有误：

```
线上事实：
  auth.autional.cn / auth.autional.com  ← GitHub autional/auth（本地 sites/auth，main）
                                          经 Vercel 双项目（cn-auth / auth 环境）部署
                                          vercel.ts 自称「唯一源站（B3 单源双区）」
遗留：
  gitee authms/web（D:\go\auth_ms_new\web）= 独立历史仓（无共同提交谱系）
  EdgeOne 部署已退役（ADR-002，域名 NXDOMAIN）；不在 CI manifest（repos.manifest 无 web）
  mf01 构建机从未执行过 web 作业 → 其 push 不触发任何 CI/部署
```

| 证               | 内容                                                                                                                                                                                                                                                                                          |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ① gh deployments | autional/auth 仓有对应 Vercel 部署记录                                                                                                                                                                                                                                                        |
| ② bundle 指纹    | 线上 deployed bundle 含 `VITE_VERCEL_GIT_COMMIT_SHA:"7a4bec5af717e4f5fc5e5176e308ab8aefc16d14"`（.cn 与 .com 同 sha）；consent chunk（.cn `page-BKwqVAv0.js` / .com `page-Ct31Wp5O.js`）含 Authorization + Accept + form-urlencoded 指纹；本地 clone `sites/auth` HEAD = `7a4bec5` 与部署一致 |
| ③ CI 台账        | mf01 processed.txt / worker.log 无 web 作业记录                                                                                                                                                                                                                                               |
| ④ 实现对照       | .cn 仓同意页自 `06627ce`（2026-09-29，「同意页冷启动/同意绑会话/rewrite 次序/回程回源」）已是 fetch 提交                                                                                                                                                                                      |

**处置**：gitee web 仓的修复（原生表单 → fetch，`0b8a767`）**对线上零影响**，价值 = 遗留仓对齐 + 硬化（deny 走服务端契约、去原生表单残留）；线上无需部署——缺陷在线上本就不存在。**教训：push 前先确认「仓 → 部署」拓扑（构建机台账 + deployed bundle sha 两证即辨）**，勿假设「同名仓 = 线上源」。

### 三腿实证（全绿）

| 腿           | 脚本                                    | 结果           | 覆盖                                                                                                                                                                                                    |
| ------------ | --------------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CLI 协议腿   | `service-oauth/e2e/sso-cors-e2e.mjs`    | **18/18 PASS** | 注册客户端（redirect_uri + cors_origins）→ per-client CORS 矩阵（含空头污染根除 / 未注册不注入）→ authorize(302+state) → PKCE 换票 → userinfo(sub 一致性) → **T7 refresh 全链**                         |
| 浏览器腿     | `service-oauth/e2e/sso-browser-e2e.mjs` | **12/12 PASS** | 真 Chromium × 进程内 vite × 修复版页面：B1 首访停留 + 拒绝回跳（形态断言：无原生表单残留）· B2 同意 → code → PKCE 换票 200 · B3 复访自动同意 · B4 零页面异常                                            |
| 线上生产复验 | 一次性脚本（已跑已删）                  | **9/9 PASS**   | 真浏览器 × `auth.autional.cn`：登录 200 → 注册公开客户端 201 → 线上可达 200 → 首访停留（captures=0）→ 拒绝回跳 error=access_denied+state → 同意回跳 code+state → PKCE 换票 200 → pageerror=0 → 清理 204 |

浏览器腿两条运维注意（已固化进 `service-oauth/e2e/README.md`）：

1. **auth-pages 自带 vite 配置的 `/oauth/` 代理会吞掉同意页**——SPA 路由 `/oauth/api/v1/oauth/authorize` 与 API 端点同路径，`/oauth/` 前缀代理把页面导航转去网关（实测 400 JSON）→ 本地渲染不出同意页；本地 harness 须用 inline config 只代理 `/bff`、`/api/v1`、`/tenant/`。
2. **回调捕获竞态**：redirect 到达捕获服务器时浏览器导航可能仍在途；立即发下一次 `goto` 会挂在在途导航（Playwright：goto 超时无提交）→ 每腿先 `waitForURL(捕获URL)` 落定再继续。

### 台账留档（记录不修，理由随附）

| 项                      | 位置（file:line）                                                                        | 缺陷                                                                                                                                                                                                           | 不修理由                                                                                                                                              |
| ----------------------- | ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| device authorize 双 gap | `device_authorization_handler.go:74-83`（+`:129-135`）                                   | ① 传输：JSON-only vs RFC 8628 §3.1 要求 form；② 响应：envelope 包裹 vs §3.2 flat 要求                                                                                                                          | 与 T7 同类但**零消费方**（仅本服务 demo + 测试）；半修产生「收 form 但响应形态不对」的更隐蔽错误                                                      |
| PAR 多层缺陷链          | `handler_internal.go:114-123` + `handler_authorize.go:417/429-459` + `domain.go:200-214` | ① 传输：JSON-only vs RFC 9126 §2；② 顺序：response_type 检查（:417）先于 PAR 解析（:432）→ 标准 `client_id+request_uri` 提交必 400；③ 模型：无 code_challenge/nonce 列 → PKCE 未持久化 → 公开客户端 PAR 不可用 | 需 DB migration + 设计变更，非单点修补；零消费方（T7 后 SDK 路径已无遗漏）                                                                            |
| atob/base64url 观察项   | 同意页 `page.tsx`（`atob(token.split('.')[1])`）                                         | WHATWG `atob()` 不接受 base64url 专属字符 `-` `_`；claims 含非 ASCII（如中文名）时编码可能产出该字符 → 解码抛错                                                                                                | 探针实测：现行 dev token payload 679 字符**无**此类字符（解码 OK，非现行缺陷）→ 记观察项；建议改用 base64url 安全解码（`-`→`+`、`_`→`/`、补 padding） |

> 判据（T7/device/PAR 的修复边界）：**SDK 接入路径（authorize / token / refresh / userinfo）= 必修**（已全覆盖）；标准协议面其余端点 = 修须全修（transport + 响应形态 + 模型），半修更糟，零消费方下留专项。

## 补充观察 · 数据层无用户隔离（上游设计；接入检查清单候选）2026-10-10

> 来源：交付后用户试用提问「不同账号看到的是不是同一份数据」→ 代码级 + 活体双验证。
> 定性：**上游 takenote 的本地演示设计**（笔记数据本就不出本机），fork 仅叠加认证层——**非 Autional / 非 skill 缺陷**；但列为**接入检查清单候选**（任何接入方都须自查「数据面与身份面是否脱节」）。

**结论先行：换账号能换「访问门」，但不能换「数据」。隔离在应用侧，不在 Autional。**

- **现象（双证据）**：
  - 代码级：笔记 / 分类 / 设置存 localStorage **固定键** `notes` / `categories` / `settings`（src/client/api/index.ts），键名**无用户维度**；登出 saga（src/client/sagas/index.ts:42-54）只结束 Autional 会话，**不触碰笔记存储**。（与 D11 相邻但不同：D11 是「清理键名写错」，此处是「根本不在清理范围」。）
  - 活体：登录后 `Object.keys(localStorage)` = `["categories","settings","notes","autional_tokens"]`（另有 webpack-dev-server 自身键）——无任何键携带用户信息；同浏览器换账号 → 同一份笔记原样可见。
- **风险场景（精确化，勿夸大）**：① 共享设备同浏览器切换账号 = 后登录者看到前者的全部笔记（局部隐私问题）；② **不是**跨用户云端泄露（数据不出本机）；③ **不是**登录校验缺陷（访问门工作正常，是门后的房间没有隔间）。
- **平台侧现状**：Autional 26 服务中**无** per-user 应用数据 API（最接近的 storage=对象存储 / profile=用户属性，均不对口）；平台提供**稳定用户 ID**（token sub / `user.id`）可用作隔离键。
- **修复三档（评估，未实施）**：

| 档                         | 做法                                                                  | 工作量                     | 边界                                                 |
| -------------------------- | --------------------------------------------------------------------- | -------------------------- | ---------------------------------------------------- |
| L2 键名空间                | 存储键加用户维度（如 `notes:<userId>`；本应用读写单点集中在一个文件） | 小（约半天–1 天）          | 仅防同浏览器串号；换设备仍不同步（本地演示语义不变） |
| L3a 数据跟人走（自建后端） | 应用加服务端存储 + 数据迁移                                           | 大（demo 周级 / 产品数周） | 须与应用方定改造方案与存量数据迁移口径               |
| L3b 平台「用户数据 API」   | 平台新增 per-user 应用数据服务                                        | 平台新服务                 | 现无此服务，属产品决策；应用侧改造量中等             |

- **接入检查清单候选**：skill 开工问询补一问「应用数据存哪？是否按用户隔离？换账号 / 换设备分别看到什么？」——把「数据隔离自查」列为正式步骤（prompt 设计建议见下节）。
- **配套已落地（2026-10-10）**：skill 强化版新增 §1.6「应用数据隔离检查」（只读检查 → 三档选项 → **整改动作须用户明确同意**）；随工作区协议强化版发布至双站 + CDN（com `v0.1.0-d7f3c177` / cn `v0.1.0-64120c4b`）。

## 给 Autional 团队的优化建议（2026-10-10 汇总）

> 依据 = 本文件 37 项问题日志。优先级：P0 = 真实用户按 skill 流程走不通；P1 = 能走通但必踩坑；P2/P3 = 体验与健壮性。

### P0 · 主链路走不通

1. **修 .com 站 references 区错配**（B1）—— 2026-10-10 复测仍在：`https://www.autional.com/ai/references/config-template.md` 头注明 `region: cn · lang: zh`，issuer=`api.autional.cn`。修产物装配，并在发布管线加「区/lang 一致性」自动校验。→ **2026-10-10 已修复上线**（web `5e9c67b`：构建期按区落位 + 双守卫；线上复验 com 站 = com 版，`issuer: api.autional.com`）。
2. **统一管理员密码传输口径（C5）+ 试用租户 RBAC 播种（C6）** —— 注册按 plain 入库、按租户策略（hash）校验 → 管理员按 skill 流程永远登不上（实验内已用改密对齐，见 C5）；且试用租户 RBAC 零播种 → 管理面门户 403 不可进。修 C5 时一并让注册链路的 `initial_role` 真正生效。→ **2026-10-10 已产品侧落地并部署 dev**（注册走 hash 传输 + 试用链补 RBAC 播种 + `initial_role` 通道；真机 E2E 9/9 绿）。
3. **补「部署形态」决策章**（D17）—— 浏览器端按 skill 配置 100% 被 CORS 拒。前置「同源反代（推荐，SDK 已内建代理模式）vs CORS 白名单」二选一，给 dev 代理 + 生产反代样例；失败处置表收录 CORS 特征串。→ **2026-10-10 产品侧根治**：改为「登记 cors_origins 即浏览器直连」为主路径（oauth 动态 CORS），代理模式作为备选；skill 5.2b 已含登记要求；见「根治」节。
4. **配置模板三处修正**（D1/D2/D3/D12）—— apiUrl 必须含 `/bff`；tenantId 传递方式（React provider 无此字段；register 需经 http 适配器注入 `X-Tenant-ID`，否则静默落到错误租户）；appId 无创建路径时的「置空 + 预期警告」指引。

### P1 · 必踩坑

5. **新增「会话生命周期」步骤**（D19）—— 登录 / 登出 / 多标签联动 / 过期四项验收；明示「登出必须调用 SDK logout，只清应用态 = 登出失效」。
6. **新增「老项目可运行性预检」**（A1-A4）—— 2020 老栈 × 现代 Node 四类阻断（node-sass / md4 / postcss exports / websocket-driver）检查清单与处置；React<18 项目 `--legacy-peer-deps` 指引（D6）；TS 项目工具链一致性说明（D9）。
7. **验证纪律升级**（Phase 8 教训）—— ① 浏览器 E2E 设为必过项（Node 集成 PASS ≠ 浏览器可用）；② 代理/网关验证必须核响应体（200 可能是 SPA 回退）。两条写进 skill 验证章。
8. **SDK `changePassword` 字段名对齐**（C11）—— SDK 发 `current_password`/`password`、服务端收 `old_password`/`new_password`，线上必 400；SDK 改名（首选）或服务端兼容别名，并注明 hash 模式下新口令传摘要。→ **2026-10-10 SDK 修复 PR #1 已提**（字段名 + 双密码预处理 + 租户配置取错修正）+ 服务端 symmetric/asymmetric fail-loud 已部署（SDK 随发版对用户生效）。

### P2 · 体验与健壮性

9. **错误面归一化**（D16/D20）—— SDK http 适配器对非 JSON 响应归一为「网关/网络错误」；AuthClient 复用 ApiClient 的重试/退避，或 skill 标注「哪层已重试、哪层没有」。
10. **公开 API 修正**（D14/D15）—— facade 无 `refreshToken()`；`logout()` 为 fire-and-forget（Promise 完成 ≠ 服务端撤销完成），文档写明。
11. **fallback 条款补 references 的 CDN 镜像路径**（B2）。
12. **邀请码能力补齐**（C1-C3/C6/C7）—— 铸造 API；SDK/流程支持邀请码注册；注册写 tenant_members；`initial_role` 生效。→ `initial_role` 已生效（2026-10-10）；邀请码铸造 / SDK 邀请注册 / `tenant_members` 物化仍开放。
13. **扩展协议面与标准对齐**（T7 同类留档）—— `/oauth/device/authorize`（RFC 8628：form 传输 + flat 响应）与 `/oauth/pushed-authorization`（RFC 9126：form + PAR 解析顺序 + PKCE/nonce 持久化）存在多层偏差（file:line 见「SSO 接入线实证」台账）；当前零消费方，建议专项全修（transport + 响应形态 + 模型），勿半修。

### P3 · 细节

14. RequireAuth 区分「未登录 vs 角色不足」（D7）· stale-user 过期回退（D10）· logout 清理正确 storage 键（D11）· RegisterRequest 类型补 `invitation_code`（D13）· 同意页 token 解析改 base64url 安全解码（非 ASCII claims 防抛错）。

### 结构性建议（prompt 设计）

- **开工先问五件事**：框架与版本 / Node 版本 / 部署形态（同源 or 直连）/ 是否 React<18 / **应用数据存哪、是否按用户隔离**（换账号 / 换设备分别看到什么）—— 提前分流，避免 Phase 4 才发现装不上、收尾才发现数据面无隔离。
- **每 Phase 留证据**（响应体片段 / 截图）—— 防两类假绿：「200 ≠ 正确」「Node ≠ 浏览器」。
- **维护「高频失败矩阵」**：CORS 报错 / 全量 404（缺 /bff）/ `Unexpected token` / 注册落错租户 / 管理员登录 401 / 改密 400（字段名）/ 管理面 403 entry plane / `403 route not available on this host`（host× 受众双绑定，user 面路由误经 machine 入口）—— 命中即查表给原因 + 处置。
- **两站同源治理**：本次仅 .com 全流程实测；两站生成器同源（core@f495cd5），.cn 结构问题大概率同构 —— 同一修单过两站，发布管线加站间 references diff 校验。→ 2026-10-10 落地上线：构建期按区落位 + 双守卫（见 B1 处置），站间 diff 校验由「按区命名镜像 + 区标记守卫」等价覆盖。

## SDK demo localhost 全链实证（2026-10-11 深夜）：接入摩擦四修 + SSO token 可调用面

> 来源：「接入方在 localhost 本地开发能不能全链跑通」的端到端验证（真实 Chromium × vite × SDK demo × .cn 生产 API）。四处摩擦已修进 SDK PR #3（`d0c66bd`..`95b7ba2`）。

### 结论先行

| 断言                                                                                                                                         | 依据                                                                  |
| -------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| **localhost 接入全链可用**：11/11 PASS（装载 → SSO 跳转 → PKCE → 换票（跨源 CORS 真验）→ 仪表盘水合 → 刷新会话保持 → 零异常 → 清理）         | `provision/demo-localhost-verify.mjs` 真机运行                        |
| **开通跨域 = 注册客户端登记 `cors_origins` + `redirect_uris`**（TTL 60s 内生效、免重启）；demo origin `http://localhost:5173` 实测直连不受阻 | per-client 动态 CORS（oauth `860a5d8`）真机；B2/E2 断言               |
| **SSO access_token 可调用 identity API 全通**：`/auth/me`、`/me/permissions`、`/me/sessions` 均 200（与登录 token 同权）                     | `provision/oauth-token-apiprobe.mjs`（node 侧全链 token → 逐条探针）  |
| **identity 裸路径 `/identity/*` 双区均 404** → 规范 `apiUrl` 必须带 `/bff`（如 `https://api.autional.cn/bff`）                               | curl 实测双区；skill 双区 config-template 已修 + 产物重建 + 五门 PASS |
| 四处接入摩擦全部修复                                                                                                                         | 见下 F1–F4                                                            |

### 修复明细（F1–F4）

| #   | 现象                                                                                    | 根因                                                                      | 修复                                                                                     |
| --- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| F1  | 浏览器进入回调地址落到 500（text/plain），SPA 路由 `/oauth/callback` 渲染不出           | 接入方 vite 代理键 `/oauth` 吞掉 SPA 路由（API 前缀与回调路径同前缀）     | demo 代理键收窄 `/oauth/api`（**接入方自查项**：代理只挡 API 形状路径）                  |
| F2  | 换票 200 后紧跟 401 "authorization code already used"，登录误报失败                     | React StrictMode 双 effect → 同 code 并发换票两次                         | SDK `handleOAuthCallback` 在飞换票幂等（同 code 复用同 Promise）+ 单测                   |
| F3  | 接入方按 skill 模板配 `apiUrl` → identity 族 API 404（auth-config 等）                  | core 的 `/bff` strip 是一等设计（apiUrl 规范形态带 `/bff`），模板漏掉后缀 | 双区 `config.{cn,com}.json` 补 `/bff` + 8 产物重建 + 五门 PASS                           |
| F4  | demo 仪表盘挂载后白屏（连 `Welcome` 都不渲染；console: `client.get is not a function`） | Dashboard `getProfile({} as any)` 传空对象 → 同步抛错 → React 掉整棵树    | 改传真实 `useAutionalContext().autional.api`；真机复验 profile 卡水合（ID/Email/Status） |

### 关键口径（接入心智模型）

```
接入方本地开发（localhost）全链：
  ① 注册公开客户端：redirect_uris=[http://localhost:5173/oauth/callback]
                     cors_origins=[http://localhost:5173]          ← 跨域开关就是这一行
  ② SDK 配置：apiUrl = https://api.autional.cn/bff                 ← 必须带 /bff
  ③ SSO 登录 → 回调页 handleOAuthCallback → token（浏览器跨源直连，实测 200）
  ④ 拿到的 access_token 可直接调 Autional API（/auth/me 等，已实证）
  ⑤ 刷新页面会话保持（persist token 水合，已实证）
```

### 验证资产（本次入库 `provision/`）

| 脚本                        | 用途                                                             | 结果       |
| --------------------------- | ---------------------------------------------------------------- | ---------- |
| `demo-register-client.mjs`  | 注册 localhost 公开客户端（台账凭据运行时解析，值不进日志/argv） | —          |
| `demo-localhost-verify.mjs` | 真 Chromium 全链 11 断言（A–G 步骤 + profile 诊断块）            | 11/11 PASS |
| `oauth-token-apiprobe.mjs`  | SSO token 可调用面探针（node 侧）                                | 4/4 200    |

> 运维备注：① demo 启动需 `VITE_AUTIONAL_APP_ID=<client_id> VITE_AUTIONAL_ISSUER=https://api.autional.cn VITE_AUTIONAL_API_URL=https://api.autional.cn/bff`；② driver 结束会清理客户端（G1），复跑前需重新注册 + 重启 demo（appId 为启动期 env）；③ profile 卡快照时序——请求稍晚于 h1 水合（≤3s）出现，等待后成功渲染；三次连跑 + 探针排除了产品缺陷。

## 发布收官（2026-10-11）：skill 三通道 v3.1 + npm 0.3.2 落地

> 本文件追踪的整条线（C5/C6/C11 根修 → 形态 2 SSO → T7/T8 → demo 实证）于 10-11 全部完成发布闭环。所有版本、散列与复验矩阵见 workspace `docs/positioning/12-skill-reachability-registry.md` §14 与 sdk `skills/CHANGELOG.md`（`4bedde2`）。

### 结论先行

| 断言                                                                            | 依据                                                                                                      |
| ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| **skill 三通道 v3.1 全发**（内容含 §5.2b SSO 步骤 + apiUrl `/bff` 修正）        | 站点 web `f3e94ed`；CDN `f3b4024`（com `v0.1.0-6cdb6716` / cn `v0.1.0-ecb907ae`）；T4 复验 **34/34** 全绿 |
| **@autional/core@0.3.2 上 npm**（OAuth 换票契约修复 + changePassword 字段对齐） | sdk PR #3 合并 `283c89f` → 发布 `f690c38`；npmjs `latest`；npmmirror 已同步                               |
| **发版时序约束（C11 教训）已遵守**：先服务端、后 npm                            | identity fail-loud 已于 10-10 提升 prod；npm 0.3.2 在 SSO 服务端修复的 `.cn` 面 E2E 全绿基线之后发布      |

### 本波附带修复（生成器与台账）

- **G3 跨平台假红根治**（sdk `3213050`）：`build-skills.mjs` 读 `_core` 源归一 CRLF→LF —— Windows autocrlf 检出与 CI 的 `coreHash` 从此一致（PR #3 CI 曾因此红，修复即绿、可复现）。
- **复验计数勘正**：T4「30 项」为矩阵行合计笔误（行和实 32）；本轮 latest 别名按区 × 4 文件逐查 → **34**；sdk `RELEASING.md` §6 已同步勘正。

### 本次发布资产坐标（远端）

| 资产           | 坐标                               | 说明                                                         |
| -------------- | ---------------------------------- | ------------------------------------------------------------ |
| skill 站点镜像 | github.com:autional/web `f3e94ed`  | 双站 `public/ai/` 镜像 + `.sha256`                           |
| skill CDN      | github.com:autional/cdn `f3b4024`  | 双区版本目录 + 指针 / rewrite 跟版                           |
| skill 内容基线 | github.com:autional/sdk `f690c38`  | 内容 `1f5af5b` + `d0c66bd`；生成器 `3213050`；台账 `4bedde2` |
| SDK 包         | npmjs `@autional/core@0.3.2`       | tags：`latest` = `next` = 0.3.2（npmmirror 同步）            |
| 接入口径       | 本文件「关键口径」节 + skill §5.2b | 登记两样（redirect_uri + cors_origins）+ apiUrl 带 `/bff`    |

## takenote 存量应用改造实证（2026-10-11 收官）：全链 12/12 + 接入摩擦 F5–F7

> 来源：把实验 fork 里**既有的密码登录表单**升级为「SSO + 密码并存」（enhancement 叠加），验证 skill v3.1 §5.2b 在**存量老应用（webpack + React 16 + Redux saga）**上的真实可用性。代码改造 5 文件：`src/client/autional.ts`（appId + .cn 引脚）、`AutionalLogin.tsx`（SSO 按钮 + authorizeUrl 引脚 + F5 注释）、`AutionalOAuthCallback.tsx`（回调新组件）、`containers/App.tsx`（回调路由注册）、`config/webpack.dev.js`（代理 target .cn + `/oauth/api` 精确前缀；另有一处测试夹具随 .cn 对齐）。真 Chromium 全链 **12/12 PASS**。

### 结论先行

| 断言                                                                                                                                                                                    | 依据                                           |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| **skill §5.2b 三步（注册客户端 → `loginWithOAuth` → 回调 `handleOAuthCallback`）在 webpack 老应用全链可用**：12/12 PASS                                                                 | `provision/takenote-sso-e2e.mjs` 真机运行      |
| **真登录页全链**（非 API 绕行）：authorize 落 auth 登录页 → 填表提交 → 同意页 approve → 回跳 code → 同源代理换票 200 → 落 `/app`（RequireAuth 通过 + `autional_tokens` `authMode=sso`） | 同上 T2–T7                                     |
| 密码表单与 SSO 并存（enhancement 叠加准则）                                                                                                                                             | T1/T3；`RequireAuth` 守卫 `/app` 复用 SDK 会话 |
| 全程零页面异常（pageerror=0 / console error=0）                                                                                                                                         | T8                                             |
| 摩擦三修 F5–F7（明细见下）                                                                                                                                                              | 实证于本波                                     |

### 修复明细（F5–F7）

| #   | 现象                                                                                                                   | 根因                                                                                                                                                                                                                                                                     | 处置                                                                                                                                                                                                                                                                       |
| --- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F5  | 点 SSO 按钮后落到「API 平面」页面：无登录 UI，静默 `error=login_required`                                              | 同源代理形态（`apiUrl=localhost:3000/bff`）下 SDK 默认 authorize 派生为**同源 `/oauth/api` 路径** → 代理转发到 **api 平面**；登录 UI 只在 **auth 平面**渲染                                                                                                              | `loginWithOAuth({ authorizeUrl: 'https://auth.autional.cn/oauth/api/v1/oauth/authorize' })` 显式引脚 auth 平面（**接入方自查项**：凡代理形态，authorize 必须显式引脚 auth 域名）                                                                                           |
| F6  | `.com` 面 SSO 全链走不通：authorize 冷启动 31.8s 挂起 → 502 → 回退 brand 门户「Choose organization…」死胡同            | `auth.autional.com` 的 `/bff` 代理 502（`.cn` 面同请求 ~1s 正常解析）——**双区部署不对等**（产品侧待查项，非接入方问题）                                                                                                                                                  | takenote 全链引脚 `.cn`（`issuer`/`apiUrl`/webpack 代理 target/`authorizeUrl` 四处对齐），并回退 `.com` 依赖                                                                                                                                                               |
| F7  | auth 登录页只渲染 OAuth 卡片（「Sign In with OAuth / Choose your provider below」），无任何可输入项 → 所有登录方式全死 | 租户 `oauth-app` 安全策略 `login_methods=["oauth"]` 且 `providers=[]` → 页面无 provider 可选（**数据层死路**）。更深一层：identity `PUT /admin/security/auth-config` **返回 200 但值不变**——写本地弃用表，读路径优先 tenant gRPC（非空遮蔽）——A-112 迁移未完成面的假成功 | 真源写路径 = tenant-service `PUT /admin/tenants/:id/auth-policy`（`login_methods` 值为 **JSON 字符串**如 `"[\"password\",\"oauth\"]"`）；修复后三读路径复验：tenant / identity / 公开 by-slug 全为 `["password","oauth"]` ✓（`provision/fix-oauth-app-login-methods.mjs`） |

### 工具链教训（webpack 侧，非产品缺陷）

- **webpack-dev-server v3 的 proxy 配置启动时读取一次，不热更**：改 `webpack.dev.js` 后必须重启 dev server（源码改动只触发热编译）；本次烧掉一轮排查——旧 proxy 仍指 `.com`、与代码的 `.cn` 引脚混平面，重启后才全链一致。
- Windows 下**孤儿 node 进程**会占住 3000 端口，新实例静默失败。探查法：`netstat -ano | grep LISTENING` 找 PID → `taskkill //PID <pid> //F`；`nodemon` 的 inspector 9229 冲突（EADDRINUSE）是旁证信号。

### 验证资产（本次入库 `provision/`）

| 脚本                              | 用途                                                                                             | 结果            |
| --------------------------------- | ------------------------------------------------------------------------------------------------ | --------------- |
| `takenote-sso-e2e.mjs`            | 真 Chromium 全链 12 断言（登录页 → authorize → 真登录 → 同意 → callback → 换票 → `/app` → 健康） | 12/12 PASS      |
| `fix-oauth-app-login-methods.mjs` | 租户 `login_methods` 修复（tenant 真源 PUT + 三读路径复验；口令运行时解析）                      | 三读全绿        |
| `cn-login-page-probe.mjs`         | auth 登录页全网络 + DOM 深探（修复后表单元素清单）                                               | inputs/按钮齐全 |
| `auth-two-plane-probe.mjs`        | 双区 authorize 冷启动对照探针（.com 502 vs .cn ~1s）                                             | 双区差异实证    |

### 对 skill 文档的反哺候选（待并入下一版）

1. §5.2b 补「**代理形态 authorize 引脚**」提示：只要 `apiUrl` 是同源代理，`loginWithOAuth` 需显式 `authorizeUrl` 指向 auth 域名（F5）。
2. 排查章节补「**登录页无可输入项 = 租户 login_methods 数据问题**」的症状 → 真源写路径对照表（F7，含 identity 假成功陷阱）。
3. 双区指引补 F6 现状（`.com` auth `/bff` 502）；在修复前，接入默认建议 `.cn` 面。
