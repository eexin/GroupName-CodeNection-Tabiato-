# 上线测试清单

部署后用**手机**照着点一遍（标 💻 的用电脑）。每项打勾；不对的截图（含网址列）给 Claude。

## A. 进入 App
- [ ] 💻 打开网址 → 左边介绍、右边登入；有「Explore a sample account」按钮
- [ ] 按 Explore a sample account → 直接进到首页地图，看得到 Bali、Tokyo、Seoul 的 pin
- [ ] 手机 Safari／Chrome → 加入主画面 → 从图示打开是全萤幕
- [ ] 登出 → 用新 email 注册 → 介绍三页 → 设定名字和 @username → 进首页（空的）
- [ ] 开飞航模式重新整理 → 出现金鱼「You're offline」画面
- [ ] 登出 → Forgot password? → 填自己的 email → 收到信 → 点连结 → 设新密码 → 用新密码登入
- [ ] 登出 → Continue with Google → 选帐号 → 第一次会进介绍页和个人设定

## B. 地图与旅行
- [ ] 首页地图有颜色（水世界），pin 点下去进旅行
- [ ] 💻 首页是左地图、右清单
- [ ] Trips 页：Memory trips／Planned 切换；Planned 有 Osaka
- [ ] Tokyo：上方有「TODAY SO FAR」、今天天气、Trip intel（附近真的有灾害才会出现警报）
- [ ] Tokyo：「2 photos need a place」→ 在地图点一下 → Place → 照片变成一个地点
- [ ] Tokyo 时间轴分页按天排列
- [ ] 💻 旅行页是左地图、右内容

## C. 上传照片（这项一定要用手机）
- [ ] Tokyo → 相机按钮 → From library 选 3 张**有定位**的照片 → 显示「Located」
- [ ] 选 1 张截图（没定位）→ 显示「No location」，上传后出现在「need a place」
- [ ] Take a photo 当场拍 → 显示「Here」→ 上传后出现在现在的位置
- [ ] iPhone 选 HEIC 照片 → 能上传、能显示

## D. 地点
- [ ] 开一个地点 → 照片、花费、评分、笔记、留言都在
- [ ] 加一笔 **JPY** 花费 → 显示「JPY … ≈ RM …」
- [ ] 空白笔记按「Let Ato draft it」→ 出现草稿和「Ato drafted this」
- [ ] 点星星评分、留言、改名都会保存（重新整理后还在）
- [ ] 点照片 → 全萤幕检视，可左右切换

## E. 结束旅行与回忆书
- [ ] Bali → Trip story：路线、精选、花费、回忆书入口
- [ ] Write the story → 产生中画面 → 封面有「with Max & Qii」
- [ ] 翻页到最后：**五条 Ato 发现**（5★ 都在早上 9 点前、黄金时段、Food 65%、站点少的日子分数较高、Ee Xin 拍了 76%）
- [ ] Export as PDF → 列印预览有封面和每一页
- [ ] Tokyo（自己当 owner）→ End this trip → 确认 → 进回忆书

## F. Planner
- [ ] Planned → Osaka → Edit → 改步调 → Save and generate
- [ ] 产生中画面有百分比和 Cancel
- [ ] 行程页第 1 天上方有「WHAT I LEARNED FROM YOUR LAST TRIPS」
- [ ] Dotonbori 在第 2 天、19:00 之后，有「yours」标签
- [ ] 必去地点页搜寻「Universal Studios」→ Add → 出现在清单
- [ ] Ato suggests 有真实地点 → + 加入
- [ ] 必去地点清单用 ▲▼ 调顺序 → 把某个地点移到第一 → 重新产生行程 → 它在第 1 天
- [ ] Group preferences → 看得到你和 Max 的差异
- [ ] Start trip → 变成进行中旅行

## G. 天气、警报、资讯
- [ ] 警报（要测的话：`npm run seed -- --demo-alert` 会加一个标明 DEMO 的台风）→ 「WHAT THIS CHANGES」→ Reschedule Day … → 重排画面 → 回旅行显示「Day X and Day Y are swapped」
- [ ] 警报 Mute → 回旅行页警报消失
- [ ] Trip intel → 有「You've logged RM … of spending」，以及英国外交部的官方建议（**这项我没实测过，空的话截图给我**）和新闻

## H. 好友与社群
- [ ] Friends → Jim 的好友请求 → Accept
- [ ] Add friend → 搜 `@max` 有结果；搜 `max@demo.tabiato.app` 有结果；搜 `max@demo` 没结果
- [ ] Add friend 有 Kai 在「You travelled with them」
- [ ] Share link → Copy；Show my QR code → 用另一支手机相机扫 → 打开 /u/eexin
- [ ] Scan QR → 允许相机 → 扫另一支手机的 QR → 跳到对方的页面（**iPhone 和 Android 都要测**）
- [ ] Community：For you／Nearby（允许位置）／Budget／Saved 都有结果
- [ ] Profile →「Your travel style」：Early riser · Slow pace · Lingers over meals · Loves food · Skips shopping
- [ ] Plan a trip → Preferences 预选 Food、Nature，Pace 预选 Slow，旁边有 Ato 的提示
- [ ] Osaka → Build → 每天 7:45 开始、美食点约 90 分钟、6:30pm 后不再加新地点；Board 每人显示「out by …」
- [ ] Community：顶部「Trending destinations」点进去只显示该城市；「Happening now」有最新动态
- [ ] Nearby：拒绝位置权限 → 出现提示，按钮恢复可按；切到别的分类再按回来也能按
- [ ] 已结束的 trip（Bali）→ 地点列表下方有「Add photos」→ 上传后 Ato 提议重写故事
- [ ] Tokyo →「2 photos need a place」→ 搜索「Senso-ji」→ 选结果 → 地图飞过去 → Place 2 photos here
- [ ] iPhone：上传页有 Options → Location 的提示；照片选取时打开后能自动定位
- [ ] Hokkaido → 花费 RM 1,800、Ato 比价、Follow、按赞、Save
- [ ] Community 点作者 Max → 他的 profile：地图 + 2 趟行程（Hokkaido 公开、Seoul, two days 标 FRIENDS）；Following / Friends ✓ / Message
- [ ] 点不是朋友的人（例如 Jason）→ 只看到公开行程，有 Add friend，底下写「Some … trips may be for friends only」
- [ ] 行程 → ••• → Who can see it：私人 / Friends / Everyone 三选一；选 Friends 后不出现在 Community，但朋友的 profile 看得到
- [ ] 放照片搜索「Shanghai Disneyland」→ 结果写「Theme park · Pudong, Shanghai, China」→ 地图缩放到整个园区、中间有大红针 →「Check this spot on Google Maps」能打开正确位置
- [ ] Use this as a starting point → 新计划里有 Hokkaido 的地点
- [ ] Message Max → 送出 → Profile → Messages 看得到对话

## H2. 钱（预算、分账、公账、扫收据）
- [ ] Tokyo → 「RM 2,568 of RM 4,000」卡片 → Money：进度条、「about RM 477 a day for 3 days」
- [ ] Tokyo → Money → Settle up：「Max pays you RM 957.80」；Kitty：两人放进日币、剩下的按比例退回
- [ ] Bali → Money → 「Qii pays you」→ Mark as paid → 出现「Qii paid you」、按 Undo 可撤回
- [ ] Bali → Money → Set a budget（只有旅行主人看得到）→ 输入 2000 → Save budget
- [ ] Add expense → Paid by 选 Kitty、Split 取消 Kai → 显示「From the kitty · split 3 ways」、「RM 30 each」
- [ ] 地点页 → Spent here → 选 Max 付、只跟 Max 分 → 「Max paid, split 2 ways」
- [ ] Scan a receipt → 拍一张收据 → Ato 说「I read RM … at …」并填好金额（照片不会存）；没设 AI 时会叫你手动输入
- [ ] 上传照片后的 Memory details → 输入金额 → 勾「split it equally with everyone who was there」
- [ ] 360 宽的手机上 Money 页没有横向滚动、按钮没有被挡住

## I. 设定与权限
- [ ] Profile → 地图主题切 Night Sky → 回首页地图变夜空
- [ ] 关掉「Auto-pin photos by location」→ 上传有定位的照片 → 变成「No location」
- [ ] Bali → Members → Kai 是 view-only；「•••」→ Let them add photos
- [ ] 自己建一趟旅行 → 邀请一个好友 → 在 Pending 按 Remind → 对方的 Messages 收到提醒
- [ ] 示范帐号：Options → Delete trip → 出现「shared sample account」提示，**旅行没被删**
- [ ] Privacy & sharing 页说明正确
- [ ] Send feedback 打开你们的 Google Form

## J. 网站本身
- [ ] `https://你的网址/api/health` → `"status":"ok"`（或 `degraded`，代表 n8n 没设或在睡）
- [ ] GitHub → Actions：CI 是绿勾；Uptime 和 Reset demo 手动 Run 一次都是绿勾
- [ ] Vercel → Analytics 有流量
