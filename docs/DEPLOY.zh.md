# 部署教学（从零开始，照着做）

> 📋 **先看 `SETUP-TABLE.zh.md`**——所有要手动做的事、哪些跟 n8n 有关、每个金钥填到哪，都在那一张表里。这份是每一步的详细点法。

> **交件：10 月 11 日晚上 11:59 前**，用官方 Google Form 交 GitHub repo 连结。
> 10/11 之后进入部署阶段，**不能再推大功能**，只能修小 bug——所以请在 10/11 前就部署、照 `QA-CHECKLIST.zh.md` 测一遍。
> 评审会**自己打开网址**，团队不在场，所以登入页的「Explore a sample account」一定要能用。

总共约 1 小时。顺序不能换：GitHub → Supabase → 本机试跑 → Vercel → 监控。

---

## 1. 把程式放进 GitHub（用 GitHub Desktop，不用打指令）

> 档案超过 100 个，而且有 `.github` 隐藏资料夹，网页拖拉上传会漏掉，所以改用 GitHub Desktop。

1. 下载安装 **GitHub Desktop**（desktop.github.com），用你的 GitHub 帐号登入
2. File → **Clone repository** → 选 `GroupName-CodeNection-Tabiato-` → 选一个本机资料夹 → Clone
3. 把 `tabiato-dev.zip` 解压，把里面**所有东西**（`web/`、`supabase/`、`n8n/`、`docs/`、`.github/`、`CLAUDE.md`、`BUILD_PLAN.md`）复制到刚刚 clone 下来的资料夹**根目录**，跟 `README.md` 放同一层。
   - Mac 要先按 `Cmd + Shift + .` 才看得到 `.github`；Windows 在档案总管 → 检视 → 勾「隐藏的项目」
4. 回到 GitHub Desktop，**分 5 次 commit**（评分表的「version control」会看纪录，一次倒进去看起来像最后一刻赶出来的）。
   在左边 Changes 清单里，只勾这一次要的档案，填 Summary，按 Commit；重复 5 次：
   1. 只勾 `supabase/` → `Database schema and row-level security`
   2. 只勾 `web/`（但**不勾** `web/tests` 和 `web/scripts`）→ `Next.js app: features and screens`
   3. 勾 `web/tests` 和 `.github/` → `Tests, CI and uptime monitoring`
   4. 勾 `web/scripts` 和 `n8n/` → `Demo data and n8n AI workflow`
   5. 勾剩下的（`docs/`、`CLAUDE.md`、`BUILD_PLAN.md`）→ `Docs: setup, QA checklist, architecture`
   最后右上 **Push origin**
5. 到 GitHub 网页 → **Actions** 分页，会看到 CI 自动开始跑。绿色勾 = 测试全过

---

## 2. Supabase（资料库）

1. supabase.com → New project
   - Name：`tabiato` · Region：**Southeast Asia (Singapore)** · 设一个资料库密码（记下来）
2. 左栏 **SQL Editor** → New query → 打开 `supabase/schema.sql`，**全部复制贴上** → 右下 **Run**。看到 `Success. No rows returned` 就对了
3. 左栏 **Authentication → Sign In / Providers → Email**：把 **Confirm email 关掉** → Save（否则注册后要收信才能登入）
4. 左栏 **Project Settings → API Keys**，记下三个值：
   - Project URL（`https://xxxx.supabase.co`）
   - **Publishable / anon** key（前端用）
   - **Secret / service_role** key（只给伺服器和 seed 用，**绝对不能外流**）

---

## 3. 本机先跑起来

需要先装 **Node.js 22 LTS**（nodejs.org）。

1. 打开终端机，进到你 clone 的资料夹的 `web`：`cd <你的资料夹>/web`
2. 复制设定档：`cp .env.example .env.local`（Windows：`copy .env.example .env.local`）
3. 用记事本打开 `.env.local`，至少填这三行：
   ```
   NEXT_PUBLIC_SUPABASE_URL=第 2 步的 Project URL
   NEXT_PUBLIC_SUPABASE_ANON_KEY=第 2 步的 publishable/anon key
   SUPABASE_SERVICE_ROLE_KEY=第 2 步的 secret/service_role key
   ```
   有 Groq 金钥的话填 `GROQ_API_KEY`（console.groq.com → API Keys）。`OSM_USER_AGENT` 填 `Tabiato/1.0 (你的email)`
   **示范帐号**：`DEMO_EMAIL=eexin@demo.tabiato.app`，`DEMO_PASSWORD` 自己取一个（不要用文件里写的预设值，repo 是公开的）
4. `npm install`（第一次要几分钟）
5. `npm run seed` → 会印出 4 个示范帐号，密码 `tabiato-demo-2026`
6. `npm run dev` → 打开 http://localhost:3000 → 用 `eexin@demo.tabiato.app` 登入，点一点看看

> ⚠️ `.env.local` 不会被 commit（已经在 .gitignore 里），金钥不会上传到 GitHub。

---

## 4. Vercel（正式上线）

1. vercel.com → 用 GitHub 登入 → **Add New → Project** → Import `GroupName-CodeNection-Tabiato-`
2. **Root Directory** → Edit → 选 `web` ← **最重要的一步，选错会建置失败**
3. 展开 **Environment Variables**，把 `.env.local` 里有填的每一行都加进去（名字和值一样）
4. **Deploy**，等 2–3 分钟，拿到网址例如 `https://tabiato-xxx.vercel.app`
5. 回 Supabase → **Authentication → URL Configuration** → Site URL 填这个网址 → Save
6. 打开 `https://你的网址/api/health`，看到 `"status":"ok"`（或 `"degraded"`，代表 AI 还没设）就成功了

之后每次 push 到 main，Vercel 会**自动重新部署**；开 Pull Request 会给你一个预览网址。

---

## 5. 监控（Deployment 满分要的「自动监控」）

1. Vercel 专案 → **Analytics** 分页 → Enable；**Speed Insights** 分页 → Enable（程式已经接好）
2. GitHub repo → **Settings → Secrets and variables → Actions → Variables** → New variable：
   - Name：`HEALTH_URL` · Value：`https://你的网址/api/health`
3. **Actions** 分页 → 左边 **Uptime** → **Run workflow** 试跑一次，绿勾就对了。之后每 30 分钟自动检查，挂掉 GitHub 会寄信给你
4. **Settings → Branches → Add branch ruleset**（或 Add rule）→ 分支填 `main` → 勾 **Require a pull request before merging** 和 **Require status checks to pass** → 选 `lint · types · tests · build · smoke` → Save
   - 之后大家改程式都要开 PR，CI 没过就不能合并 —— 这就是评分表的「sound practices」

---

## 5a. 忘记密码要能寄信（免费，用 Gmail）

Supabase 内建的寄信**只会寄给你们团队成员**，一小时只有 2 封，真实使用者收不到重设密码的信。改用 Gmail 寄：

1. 用一个 Gmail 帐号（建议开一个团队专用的）→ myaccount.google.com → **安全性** → 开启**两步骤验证**
2. 打开 myaccount.google.com/apppasswords → 名称填 `Supabase` → 建立 → 复制那组 **16 位密码**
3. Supabase → **Authentication → Emails → SMTP Settings**（或 Project Settings → Authentication）→ 开启 **Custom SMTP**：
   - Host `smtp.gmail.com` · Port `465`
   - Username：完整的 Gmail 地址 · Password：刚才那 16 位
   - Sender email：同一个 Gmail · Sender name：`Tabiato`
4. **Authentication → Rate Limits** → 寄信上限调到每小时 30
5. **Authentication → URL Configuration → Redirect URLs** 加两行：
   `https://你的网址/auth/callback` 和 `http://localhost:3000/auth/callback`
6. 测试：登入页 → Forgot password? → 填你自己的 email → 收信 → 点连结 → 设新密码

## 5a-2. Continue with Google（免费）

1. console.cloud.google.com → 建一个专案 `Tabiato`
2. **APIs & Services → OAuth consent screen**（新版叫 Google Auth Platform）：App name `Tabiato`、填支援 email、对象选 **External** → 完成后按 **Publish app**（不发布的话只有你加进测试名单的人能登入）
3. **Credentials → Create credentials → OAuth client ID** → 类型 **Web application** → Authorized redirect URIs 填：
   `https://<你的supabase专案>.supabase.co/auth/v1/callback`（Supabase 的 Google 设定页上有这串，直接复制）
4. 复制 **Client ID** 和 **Client secret** → Supabase → **Authentication → Sign In / Providers → Google** → 开启 → 贴上 → Save
5. 确认 5a 第 5 步的 Redirect URLs 已经加了
6. Vercel 加环境变数 `NEXT_PUBLIC_ENABLE_GOOGLE` = `true` → Redeploy。登入页和注册页就会出现 Google 按钮（没设这个变数按钮会隐藏，不会出现坏掉的按钮）

## 5b. 示范帐号每晚自动重置（评审用）

评审和试用者都用同一个示范帐号，会改到资料。每晚 4 点自动恢复原状：

1. GitHub repo → **Settings → Secrets and variables → Actions → Secrets** → New repository secret，加三个：
   - `SUPABASE_URL` = Supabase 的 Project URL
   - `SUPABASE_SERVICE_ROLE_KEY` = secret／service_role key
   - `DEMO_PASSWORD` = 跟 Vercel 上一样的密码
2. **Actions** → 左边 **Reset demo** → **Run workflow** 试一次，绿勾就对了
3. 想用**真的照片**：把照片放进 `web/scripts/demo-photos/<地点资料夹>/`（资料夹名称在那里的 README），commit、push。每晚重置都会用它们。**repo 是公开的，只放可以公开的照片**

## 5c. 试用者回馈（Google Form）

1. 开一个 Google Form，建议问：用什么手机？最喜欢哪个功能？哪里卡住或看不懂？会推荐给朋友吗（1–5）？
2. 发布 → 复制连结 → Vercel 加环境变数 `NEXT_PUBLIC_FEEDBACK_URL` → Redeploy
3. Profile 页和电脑版侧栏会出现「Send feedback」

## 6. 装到手机上（变成 App）

Tabiato 是 **PWA**：从浏览器装到主画面后，全萤幕开启、有自己的图示，用起来就是 App，不需要 App Store。

- **iPhone**：用 **Safari** 打开你的网址 → 下方「分享」按钮 → **加入主画面** → 新增
- **Android**：用 Chrome 打开 → 会跳出「安装 Tabiato」，或 Profile 页最上面的 **Install** 按钮
- 装好后从主画面的金鱼图示打开。断网时会显示离线画面，不会是浏览器的错误页

> 决赛 demo 建议：前一天先在 demo 用的手机装好、登入、扫一次 QR（让相机权限先允许），当天直接从主画面打开。

---

## 7. AI（n8n）

App 只有 Groq 金钥也能跑。要接 n8n 照 `n8n/README.md`，完成后在 Vercel 加 `N8N_WEBHOOK_URL` 和 `N8N_SECRET`，然后 **Deployments → 最新那个 → Redeploy**（环境变数改了一定要重新部署才会生效）。

---

## 出问题怎么办

| 症状 | 原因 / 解法 |
| --- | --- |
| Vercel 建置失败 | 九成是 Root Directory 没设成 `web` |
| 打开网站一直跳到 `/setup` | Vercel 没填 Supabase 那两个变数，或填了没 Redeploy |
| 注册后登入不了 | Supabase 的 Confirm email 没关 |
| `npm run seed` 说缺变数 | `.env.local` 没填 `SUPABASE_SERVICE_ROLE_KEY` |
| 地图空白 | 网路挡了 OpenFreeMap，换网路试试 |
| 其他错误 | Vercel 专案 → **Logs**，把红色那几行截图给 Claude |
