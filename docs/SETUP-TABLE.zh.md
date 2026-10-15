# 手动设定总表（照顺序做）

> **交件：10 月 11 日晚上 11:59，Google Form 交 GitHub repo 连结。**
> 10/11 前至少完成 A 区（第 1–9 步）并照 `QA-CHECKLIST.zh.md` 测过。B、C 区可以在 10/12 之后做（只是设定，不是改程式）。
> 每一步的详细点法在 `DEPLOY.zh.md`（标了对应章节）。

## A 区：上线（必做，约 2 小时）

| # | 要做什么 | 在哪里 | 怎么做（重点） | 拿到什么／填到哪 | n8n? | 时间 |
|---|---|---|---|---|---|---|
| 1 | 装软体 | 你的电脑 | Node.js 22 LTS、VS Code、GitHub Desktop | — | | 15 分 |
| 2 | 程式推上 GitHub | GitHub Desktop | Clone repo → 把 zip 全部内容（含 `.github`）放进根目录 → Commit → Push（建议照 DEPLOY 第 1 节分几次 commit） | repo 网址（交件用） | | 15 分 |
| 3 | 开 Supabase 专案 | supabase.com | New project，地区 Singapore | — | | 5 分 |
| 4 | 建资料库 | Supabase → SQL Editor | 贴上 `supabase/schema.sql` 全部 → Run | — | | 2 分 |
| 5 | 关掉 email 验证 | Authentication → Sign In / Providers → Email | Confirm email **关** | — | | 1 分 |
| 6 | 复制三把金钥 | Project Settings → API Keys | Project URL、anon/publishable、service_role/secret | 第 8、9、14 步要用 | | 2 分 |
| 7 | 申请 Groq 金钥 | console.groq.com → API Keys | Create | `GROQ_API_KEY` | AI 备援 | 3 分 |
| 8 | 本机跑起来 | VS Code 终端机 | `cd web` → `npm install` → 复制 `.env.example` 成 `.env.local` 并填好（见下方 D 区）→ `npm run seed` → `npm run dev` | 浏览器开 localhost:3000 按「Explore a sample account」 | | 20 分 |
| 9 | 部署 Vercel | vercel.com | Import repo → **Root Directory = `web`** → 加 D 区所有变数 → Deploy | **App 网址** | | 15 分 |
| 10 | 设定网址 | Supabase → Authentication → URL Configuration | Site URL = App 网址；Redirect URLs 加 `https://你的网址/auth/callback` | — | | 2 分 |
| 11 | 检查上线 | 浏览器 | 开 `https://你的网址/api/health` → `ok` 或 `degraded` | — | | 1 分 |
| 12 | 手机测试 | iPhone + Android | 照 `docs/QA-CHECKLIST.zh.md` 逐项点，坏的截图给 Claude | — | | 1.5 小时 |

## B 区：评审与上线品质（10/11 前做最好，约 1 小时）

| # | 要做什么 | 在哪里 | 怎么做（重点） | 拿到什么／填到哪 | n8n? | 时间 |
|---|---|---|---|---|---|---|
| 13 | 开分析 | Vercel → Analytics、Speed Insights | 两个都 Enable | — | | 2 分 |
| 14 | 每晚重置示范帐号 | GitHub → Settings → Secrets and variables → Actions → **Secrets** | 加 `SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY`、`DEMO_PASSWORD` → Actions → Reset demo → Run workflow | — | | 5 分 |
| 15 | 上线监控 | 同上 → **Variables** | 加 `HEALTH_URL` = `https://你的网址/api/health` → Actions → Uptime → Run workflow | 每 30 分钟检查，挂掉寄信给你 | 顺便让 n8n 不睡 | 3 分 |
| 16 | 保护 main 分支 | GitHub → Settings → Branches | 勾 Require pull request + Require status checks（选 CI） | 之后改程式都走 PR | | 3 分 |
| 17 | 真照片 | `web/scripts/demo-photos/<地点>/` | 放照片 → commit → push → Actions 跑一次 Reset demo | 评审看到真照片 | | 30 分 |
| 18 | 试用回馈表 | Google Forms | 开表单（用什么手机、最喜欢、哪里卡住、推荐 1–5）→ 复制连结 | Vercel 加 `NEXT_PUBLIC_FEEDBACK_URL` → Redeploy | | 10 分 |
| 19 | 交件 | 官方 Google Form | 填 GitHub repo 连结 | — | | 2 分 |

## C 区：加分设定（部署阶段也能做，都免费）

| # | 要做什么 | 在哪里 | 怎么做（重点） | 拿到什么／填到哪 | n8n? | 时间 |
|---|---|---|---|---|---|---|
| 20 | 忘记密码能寄信 | Gmail + Supabase | Gmail 开两步骤验证 → 建应用程式密码 → Supabase → Authentication → Emails → SMTP：`smtp.gmail.com` / `465` / Gmail / 16 位密码（DEPLOY 5a） | — | | 10 分 |
| 21 | Google 登入 | Google Cloud Console + Supabase | 建 OAuth Client（Web）→ redirect URI 填 Supabase 给的那串 → 贴进 Supabase Google provider → **Publish app**（DEPLOY 5a-2） | Vercel 加 `NEXT_PUBLIC_ENABLE_GOOGLE=true` → Redeploy | | 15 分 |
| 22 | 旅游新闻 | newsdata.io | 注册 → Dashboard 复制 key | `NEWSDATA_API_KEY` | | 3 分 |
| 23 | n8n 资料库 | supabase.com | **另开第二个**专案（不要用 App 那个），复制 Session pooler 的 host / user / 密码 | 第 24 步要用 | ✅ | 5 分 |
| 24 | n8n 主机 | huggingface.co → New Space → Docker | 上传 `n8n/space/Dockerfile` 和 `README.md` → Settings 加 Secrets（见 `n8n/README.md` 表格）→ 等建置 | n8n 网址 `https://帐号-space名.hf.space` | ✅ | 15 分 |
| 25 | n8n 帐号 | n8n 网址（**直接开 hf.space，不要从 huggingface.co 开**） | 建 owner 帐号 | — | ✅ | 2 分 |
| 26 | n8n 凭证 | n8n → Credentials → Header Auth ×2 | `Tabiato secret`：`x-tabiato-secret` / 自取长密码；`Groq API key`：`Authorization` / `Bearer gsk_…` | 那组长密码 = `N8N_SECRET` | ✅ | 5 分 |
| 27 | n8n 工作流 | n8n → Import from file | 汇入**最新的** `n8n/tabiato-ai.json` → 两个节点选凭证 → Save → Active | Webhook 网址 = `N8N_WEBHOOK_URL` | ✅ | 5 分 |
| 28 | 接回 App | Vercel → Environment Variables | 加 `N8N_WEBHOOK_URL`、`N8N_SECRET` → Redeploy | `/api/health` 的 `ai_n8n` 变 ok | ✅ | 3 分 |

---

## D 区：环境变数总表（填在哪）

| 变数 | 值从哪来 | `.env.local` | Vercel | GitHub Secret |
|---|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | 第 6 步 Project URL | ✅ | ✅ | `SUPABASE_URL`（同值） |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 第 6 步 anon key | ✅ | ✅ | |
| `SUPABASE_SERVICE_ROLE_KEY` | 第 6 步 service_role | ✅ | ✅ | ✅ |
| `DEMO_EMAIL` | 固定 `eexin@demo.tabiato.app` | ✅ | ✅ | |
| `DEMO_PASSWORD` | **自己取**，三处一样，不要用预设值 | ✅ | ✅ | ✅ |
| `GROQ_API_KEY` | 第 7 步 | ✅ | ✅ | |
| `OSM_USER_AGENT` | `Tabiato/1.0 (你的email)` | ✅ | ✅ | |
| `NEWSDATA_API_KEY` | 第 22 步 | 选填 | ✅ | |
| `N8N_WEBHOOK_URL` | 第 27 步 | 选填 | ✅ | |
| `N8N_SECRET` | 第 26 步 | 选填 | ✅ | |
| `NEXT_PUBLIC_FEEDBACK_URL` | 第 18 步 | | ✅ | |
| `NEXT_PUBLIC_ENABLE_GOOGLE` | 第 21 步做完才填 `true` | | ✅ | |
| `HEALTH_URL` | `https://你的网址/api/health` | | | Variable（不是 Secret） |

⚠️ Vercel 的变数改完一定要 **Deployments → 最新那个 → Redeploy** 才生效。
⚠️ `.env.local` 永远不要 commit（已在 `.gitignore` 里）。

---

## E 区：哪些功能用到 AI（经过 n8n）

没设 n8n 时，App 会自动改用 Groq 直连；Groq 也没设，就用模板文字。**任何情况都不会坏。**

| 功能 | 画面 | n8n 任务 | 没有 AI 时 |
|---|---|---|---|
| 回忆书文字 | 25b → 26 → 27 | `memory_book` | 用资料写成的模板句；五条「Ato 发现」不受影响（本来就是程式算的） |
| 旅行洞察那一句 | 14 | `insight` | 显示第一条观察 |
| 行程每天的标题 | 31 | `plan_titles` | 不显示标题 |
| 下雨改行程建议 | 32 | `rain_replan` | 「X 点到 Y 点 80% 会下雨，把 A 移到明天早上？」 |
| 灾害警报建议 | 33 | `hazard_advice` | 固定的安全提醒 |
| 资讯解读 | 34 | `intel_notes` | 不显示 Ato 的解读，官方资讯和新闻照常 |
| Ato 起草笔记 | 10 | `note_draft` | 「X 张照片，从几点开始，我给了 N 星」 |
| 搜寻总结 | 13 | `search_summary` | 「6 个里有 5 个是美食」这类统计句 |
| 扫描收据 | Money、地点页 | `receipt_scan` | 告诉你读不到，请手动输入金额（照片读完就丢，不存） |

不需要 AI、也不需要 n8n 的：地图、上传照片与定位、分群成地点、行程排程（程式算的）、天气、灾害、换汇、社群、讯息、PDF。
