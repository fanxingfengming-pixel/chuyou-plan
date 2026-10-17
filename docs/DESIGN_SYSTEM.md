---
name: 出游plan · 奶油旅行手账
description: 以奶油纸面、陶土重点和明确选择状态组织旅行规划。
colors:
  accent: "#a74b35"
  accent-hover: "#8c3e2c"
  bg: "#fff9ef"
  surface: "#fffdf8"
  surface-raised: "#f3e8db"
  surface-warm: "#f2e7d9"
  ink: "#3c2b23"
  muted: "#756357"
  quiet: "#806b5b"
  label-ink: "#654d3d"
  support-ink: "#4b382c"
  line: "#e3d5c7"
  content-border: "#d9c5b4"
  control-border: "#ccb6a3"
  message-surface: "#f5eadb"
  error-ink: "#8d3524"
  error-surface: "#fbe6dc"
typography:
  display:
    fontFamily: "'Manrope', 'PingFang SC', 'HarmonyOS Sans SC', 'Microsoft YaHei', sans-serif"
    fontSize: clamp(42px, 6vw, 92px)
    fontWeight: 500
    lineHeight: 1.22
    letterSpacing: -0.025em
  headline:
    fontFamily: "'Manrope', 'PingFang SC', 'HarmonyOS Sans SC', 'Microsoft YaHei', sans-serif"
    fontSize: clamp(34px, 4.4vw, 64px)
    fontWeight: 500
    lineHeight: 1.28
    letterSpacing: -0.025em
  mode-title:
    fontFamily: "'Manrope', 'PingFang SC', 'HarmonyOS Sans SC', 'Microsoft YaHei', sans-serif"
    fontSize: clamp(28px, 3vw, 42px)
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: -0.02em
  title:
    fontFamily: "'Manrope', 'PingFang SC', 'HarmonyOS Sans SC', 'Microsoft YaHei', sans-serif"
    fontSize: 24px
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: -0.02em
  body:
    fontFamily: "'Manrope', 'PingFang SC', 'HarmonyOS Sans SC', 'Microsoft YaHei', sans-serif"
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: normal
  description:
    fontFamily: "'Manrope', 'PingFang SC', 'HarmonyOS Sans SC', 'Microsoft YaHei', sans-serif"
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.9
    letterSpacing: normal
  support-body:
    fontFamily: "'Manrope', 'PingFang SC', 'HarmonyOS Sans SC', 'Microsoft YaHei', sans-serif"
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.85
    letterSpacing: normal
  field:
    fontFamily: "'Manrope', 'PingFang SC', 'HarmonyOS Sans SC', 'Microsoft YaHei', sans-serif"
    fontSize: 15px
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: normal
  label:
    fontFamily: "'Manrope', 'PingFang SC', 'HarmonyOS Sans SC', 'Microsoft YaHei', sans-serif"
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: normal
  action:
    fontFamily: "'Manrope', 'PingFang SC', 'HarmonyOS Sans SC', 'Microsoft YaHei', sans-serif"
    fontSize: 13px
    fontWeight: 700
    lineHeight: 1.6
    letterSpacing: normal
  secondary-action:
    fontFamily: "'Manrope', 'PingFang SC', 'HarmonyOS Sans SC', 'Microsoft YaHei', sans-serif"
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: normal
rounded:
  compact: 5px
  field: 6px
  action: 7px
  media: 8px
  tray: 9px
  route: 10px
  surface: 12px
  circle: 50%
spacing:
  gutter-desktop: 56px
  gutter-tablet: 40px
  gutter-mobile: 20px
  gap-inline: 14px
  gap-standard: 24px
  gap-grid: 35px
  action-padding: 16px 22px
  secondary-padding: 12px 17px
  field-padding: 14px 16px
  route-padding: 26px
  route-padding-mobile: 20px 17px
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.bg}"
    typography: "{typography.action}"
    rounded: "{rounded.action}"
    padding: "{spacing.action-padding}"
  button-primary-hover:
    backgroundColor: "{colors.accent-hover}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.label-ink}"
    typography: "{typography.secondary-action}"
    rounded: "{rounded.field}"
    padding: "{spacing.secondary-padding}"
  button-secondary-pressed:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.bg}"
  button-secondary-selected:
    backgroundColor: "#a74b3520"
    textColor: "{colors.label-ink}"
  input-field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.field}"
    rounded: "{rounded.field}"
    padding: "{spacing.field-padding}"
  input-command:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.tray}"
    padding: 8px 9px 8px 22px
  navigation-progress:
    textColor: "{colors.muted}"
    typography: "{typography.label}"
    padding: 0 0 20px
  chip-recommendation:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.surface}"
    rounded: "{rounded.compact}"
    padding: 3px 7px
  card-mode:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.surface}"
    padding: 12px 12px 24px
  card-route:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.route}"
    padding: "{spacing.route-padding}"
  message-info:
    backgroundColor: "{colors.message-surface}"
    textColor: "{colors.label-ink}"
    rounded: "{rounded.field}"
    padding: 15px 18px
  message-error:
    backgroundColor: "{colors.error-surface}"
    textColor: "{colors.error-ink}"
    rounded: "{rounded.field}"
    padding: 15px 18px
  packing-item:
    textColor: "{colors.ink}"
    padding: 16px 0
---

# Design System: 出游plan · 奶油旅行手账

## Overview

**Creative North Star: "奶油旅行手账"**

像打开一本干净、温暖的旅行手账：奶油背景托住纸面，陶土色只点亮操作与选择，暖棕文字和真实照片承担信息。界面延续项目既有 Manrope 与中文回退字体、Hero 结构和 GSAP，纸感由色面、细边界和轻微卷角形成。

规划页面以完成下一次决策为中心。留白容纳大标题、旅行摘要与可扫描的候选，推荐、已选、待确认、加载与失败保持可区分；来源、模拟和报价说明留在相应内容旁。用户选定的 A 方向提供气质参考，最终参数以完成代码的有效级联为依据。

**Key Characteristics:**
- 奶油纸面与暖棕文字形成连续阅读底色。
- 陶土重点同时用于主操作、当前步骤和已确认状态。
- 照片和内容优先，纸感来自克制的色面、边界与留白。
- 每页一个清晰主任务，手机保留同样的选择语义与反馈。

基准：CP-V2-2026-10-17；本次按已授权 D-09 刷新，关联 FR-026/027/028 与 FZ-002/008/010/017/018。本文是 [docs/README.md](README.md) 指定的唯一设计规范；功能、分支、确认与持久化规则由 [功能需求](FUNCTIONAL_REQUIREMENTS.md)、[冻结规则](FROZEN_RULES.md) 和 [状态与数据契约](STATE_AND_DATA_CONTRACT.md) 定义，不在本文复制成第二份要求。

提取依据：`src/main.tsx` 的样式顺序为 `src/styles.css` → `src/planning/planning.css` → `src/planning/warm-theme.css`；暖色覆盖最后生效。组件抽样为 `Common`、`PackingList`、`HotelPages`、`LocationPages`、`ItineraryPages`，转场来自 `src/App.tsx`。已对照 `artifacts/warm-v3/browser` 的桌面与手机捕获；其中全流程报告明确为模拟数据，专项报告另列本地真实资料库、故障注入和动态偏好范围。设计提取不代表补做产品全量验收。

上方 YAML 只记录当前复用参数；`.impeccable/design.json` 是由本文生成的展示缓存，承载影子 DOM 组件、动态、断点与辅助色阶，不能覆盖本文。旧 V1 专属 token 已退出当前系统；其原文仍保留在 [归并前快照](archive/2026-10-17-before-unification/DESIGN.md)。

## Colors

奶油色铺底、纸面轻分层、暖棕字迹与陶土重点构成当前唯一色彩语言。上方 YAML 的值为规范参数，下文说明使用场景。

### Primary

- **陶土重点**（`accent`）：主按钮、当前步骤编号、核心选择、推荐标签和确认标识。
- **深陶土悬停**（`accent-hover`）：主按钮与首页提交动作的悬停色。

### Neutral

- **奶油底纸 / 明亮纸面**（`bg` / `surface`）：全页底色与输入、模式入口、路线日卡、确认对话框。
- **浅暖叠纸 / 暖纸衬底**（`surface-raised` / `surface-warm`）：媒体占位、所选区域条、悬停、确认及辅助面板；两种实装色保留不同角色。
- **深棕墨 / 辅助棕 / 占位棕**（`ink` / `muted` / `quiet`）：主标题正文、次级说明、占位文字。
- **标签棕 / 支持棕**（`label-ink` / `support-ink`）：表单标签与次级动作、事实和路线说明。
- **纸缝 / 内容边界 / 控件边界**（`line` / `content-border` / `control-border`）：细分隔线、内容框与输入边界，不能把不同来源的边界统一成同一种深度。

### Feedback

- **暖提示纸**（`message-surface`）：普通操作与状态说明。
- **砖红错误 / 浅杏错误纸**（`error-ink` / `error-surface`）：错误消息、保存异常与缺项反馈；同时提供可理解的中文信息。

**The Paper & Ink Rule.** 内容先落在奶油背景与纸面上；主文字、辅助说明、边界分别使用各自角色，不能把整段正文降成低透明度。

**The One Accent Rule.** 主操作、当前步骤、核心选择与确认状态共用陶土重点；警告和失败通过文字与结构同时说明。

## Typography

**Display Font / Body Font:** 本地 Manrope，中文按 PingFang SC → HarmonyOS Sans SC → Microsoft YaHei → sans-serif 回退。项目实际加载 Manrope 的 400、500、600、700、800 字重；当前主要内容以 400/500 为主，主操作用 700。

**Character:** 大标题保持轻而清楚的中文阅读节奏，正文和说明有足够行高；价格、进度计数、对比和完成数使用等宽数字特性，方便扫描。

### Hierarchy

| 角色 | 实装用途 | 响应式说明 |
| --- | --- | --- |
| `display` | 首页两行主标题 | 手机（≤650px）改为 clamp(34px, 8vw, 48px)，保留暖色标题行高 |
| `headline` | 各规划步骤主标题 | ≤767px 为 38px；≤650px 为 34px |
| `mode-title` | 两个住宿模式入口名称 | ≤650px 为 30px |
| `title` | 筛选小节等内容标题的常用层级 | 酒店、路线和分组标题按自身内容保持约 21–30px，不假装存在单一统一组件 token |
| `body` | 默认正文 | 全局阅读基础 |
| `description` | 主标题下导语 | 最长 70ch；≤767px 为 14px |
| `support-body` | 次要说明 | 通常不超过 80ch |
| `field` | 常规输入与选择框 | 保持清楚的输入层级 |
| `label` | 来源、进度与事实标签的常用层级 | 9–10px 的既有附属文案不是新增正文基准 |
| `action` | 主操作 | 稳定字重与可点击轮廓 |
| `secondary-action` | 次级操作 | 沿用正文行高，不套用辅助段落的更高行高 |

**The Readable Chinese Rule.** 保持既有字体栈与实际层级；中文标题不为模仿英文增加负字距，附属图片署名的小字号不升级为正文标准。

## Layout

版心保留既有页面网格：全局最大宽度（1680px），规划内容最大宽度（1440px）；桌面侧距使用 `gutter-desktop`，≤1200px 使用 `gutter-tablet`，≤767px 使用 `gutter-mobile`。规划页距顶部（126px），手机（96px）；主导航桌面初始高（86px）、步骤页固定高（74px）、手机高（72px）。

页面顺序为进度 → 旅行摘要 → 主标题与导语 → 当前操作 → 上一步与下一步。标题组桌面外边距（30px 0 42px），≤650px（22px 0 30px）；摘要允许换行，手机将日期、天数与同行人数移到单独一行。

- 旅行信息为两列表单，最大宽度（1000px），≤767px 变单列；日期与人数仍在各自小网格内保持两列。
- 模式入口为两列、间距（26px），≤767px 改单列。图片高（clamp(190px, 18vw, 270px)），≤650px 固定（190px），图片填满并裁切；这是代码实装，效果图不提供额外尺寸约束。
- 区域卡片桌面一组容纳三张，局部横滑；手机卡片宽约（83%）并保留下一张的阅读提示。通用地点媒体桌面高（205px）、手机高（190px），保持占位与成图尺寸一致。
- 酒店筛选桌面主栏与辅助栏比例（1.5:1），≤900px 单列；精选酒店桌面三列，≤900px 转为图文行，≤767px 单列；更多结果桌面两列，手机单列。
- 路线日卡桌面两列，≤900px 单列；清单桌面两列、列距（32px），≤650px 单列。对比表最小宽度（670px），仅在局部容器横滑。
- 常规字段最小高（50px）；主操作桌面内边距引用 `action-padding`，手机页脚缩为（14px 17px）；信息与错误不能通过改变整页尺寸伪装为结果。

进度导航允许水平滚动；路由切换时将当前步骤滚入并居中，保留 `aria-current="step"`。它不会要求整页横向滚动。当前断点（1200px、900px、767px、650px）分别服务密度、列数、手机排版与简化动态，不能合并为一个臆造断点。

**The One Decision Rule.** 每页保留进度、摘要、一个主标题与明确下一步；区域和对比的横向滚动限制在各自容器内。

## Elevation & Depth

界面主要以奶油底纸、明亮纸面、细边界和留白分层，常驻卡片没有通用抬升阴影 token。导航采用奶油半透明色和底部分隔线，暖色覆盖关闭了原有导航毛玻璃。确认对话框使用深棕遮罩（#3c2b2366），原有背景模糊（7px）保留以聚焦当前决定。

卷角只在桌面路由切换中短暂出现：纸面到边界的渐变配合轻柔投影（drop-shadow(-8px -5px 12px #0002)），结束后不可见；手机隐藏卷角。不得把此投影扩展为所有卡片的常驻样式。

**The Quiet Depth Rule.** 常驻内容主要用纸面色、细边界和留白分层；卷角阴影只服务短暂转场，不成为卡片的常驻装饰。

## Shapes

形状以温和矩形为主。模式入口、地点卡与确认对话框复用 `surface` 圆角；输入和次级按钮复用 `field`；主按钮为 `action`；路线日卡为 `route`。标签、媒体与底部对比条保留 `compact`、`media`、`tray` 的差别，不以“统一”抹去组件用途。

边界通常是细线（1px）。模式入口选中时使用陶土边界与额外描边（1px），图片本身不叠加第二圈选中线；勾选与清楚的名称说明共同表达选择。圆形只用于图标按钮、勾选标记和滑块把手等紧凑控件。图片容器裁切内容，保持照片与圆角一致。

## Components

### Buttons

主动作是实心陶土与奶油字，使用 `button-primary`。悬停变深并轻抬（-2px），按下轻沉（1px）；颜色与位移过渡（0.25s）。等待或禁用保持可辨识，主按钮禁用透明度（0.6）。

次级动作使用纸面、标签棕、细控件边界和 `secondary-padding`；悬停转浅暖纸并以陶土强调边界。`aria-pressed="true"` 为实心陶土；酒店确认采用 `selected` 状态时保持浅陶土底，文字与勾选明确表示“已选择这家酒店”。不要把这两种实际状态混成同一个样式。

### Inputs / Fields

常规字段使用纸面、控件边界和 `input-field`。全局可见焦点为陶土描边（2px）、外偏移（4px）；首页命令输入同样使用外偏移（4px），描边同为陶土色。焦点不会靠去掉边界表达。首页命令框、地点搜索框与普通字段保持各自外层结构。价格双把手标签避让，装修单滑块清楚表达下限；原生或自定义滑块继续支持键盘。

行前清单的名称与备注可直接编辑，有轻量边界、纸面底色、占位提示与“点击物品名称或备注即可编辑，修改会自动保存”的可见说明。鼠标悬停加深边界、聚焦变陶土；已备好由勾选、完成数与名称删除线共同表示。当前清单名称沿用字段层级，备注使用较小辅助字（12px）；不把被高特异性通用规则覆盖的紧凑声明记作已生效尺寸。

### Navigation

主导航承载品牌、旅行信息、住宿、行程与继续规划；窄屏折叠菜单提供展开状态。规划进度以两位编号、文字与当前步骤下划线区分状态，手机将当前步骤自动滚入。路由切换后主标题获得焦点；缺项反馈给出具体原因并定位到对应控件。菜单键盘行为、焦点恢复与滑块操作仍按 FR-026 的可操作性要求验收。

### Chips / Labels

推荐标签是酒店名称旁的短标签，显示在同一个标题内；使用陶土底、纸面字与 `chip-recommendation`。字号（12px）、字重（500）、行高（1.5），由名称带出推荐类型；不再作为名称上方独立的装饰小标题。所选区域与核心状态依靠标签文字、按下状态和操作按钮表达。

### Cards / Containers

模式入口使用两张明确标注的 AI 氛围图，选中后保持完整按钮轮廓和勾选。地点卡与酒店结果让照片、实体名称、事实、来源和动作连续可扫描；真实地点图片、飞猪供应方图片、氛围素材与通用兜底按来源显示不同说明。

酒店结果提供“查看酒店”外链与独立的“我已选择这家酒店”，确认后使用单独状态条；对比勾选和底部对比条表达已有数量和上限。此处只规定视觉与语义呈现，确认规则引用 FR-013/014。

路线日卡使用 `card-route`；标题为天数和地点数。酒店名称下方正文说明“每天从这里出发”，每日日卡保留出发、时段、地点与返回说明；拖拽、移动、删除与主动优化保持可见动作。清单和 PDF 位于已有路线之后，保留来源、限制与当前草稿的含义。

### Feedback / Waiting

普通消息与错误使用 `message-info` / `message-error`，分别提供 status / alert 语义。未满足条件时下一步仍可触发缺项说明和定位；请求期间防重复提交；不支持的筛选维持禁用并说明原因。

加载期间显示固定媒体与文本占位的骨架，分开处理加载、空结果、失败和超时。阶段进度仅在有真实 completed / total 时展示确定完成比；未知进度显示阶段、实际等待秒数与往复轨道。近期耗时样本只生成带不确定性说明的估计区间，无样本明确无法估计。轨道运动（1.6s ease-in-out），轨道宽度响应（0.25s）；减少动态时静止显示并保留文字。

### Motion / Accessibility

保持现有开场及显式跳过、首页静态图缓慢漂移及暂停控件。规划页 GSAP 转场桌面（0.48s，expo.out），手机（0.28s，expo.out）；前进从右偏移（10px），返回从左偏移（-10px），桌面角部短暂收拢。完成后清理 clip-path、transform 和 opacity，组件卸载回收 GSAP context。

减少动态时跳过开场与页面卷角，关闭循环、平滑滚动和相关过渡，状态仍可直接读取。保留跳至主要内容、按钮/字段焦点、状态与错误播报；不要仅凭 CSS 或本文存在宣称真实键盘、设备与辅助技术验收通过。

**The Visible Choice Rule.** 选择状态同时提供文字、描边、勾选或 aria 状态；推荐标签和供应方外链不能替代用户手动确认。

**The Truth Beside Content Rule.** 图片来源、非实景、模拟报价、未知字段与路线局限跟随对应内容；等待只展示收到的阶段、实际等待时间或有依据的完成数。

**The Motion Yields Rule.** 前进与返回的短转场对应方向；手机简化卷角，减少动态时跳过开场和卷页，清楚的状态变化立即可见。

## Do's and Don'ts

### Do:

- **Do** 按上方角色复用奶油、纸面、暖棕与陶土参数，保留实装中纸面色和控制边界的层次。
- **Do** 让推荐标签紧邻酒店名称，让“每天从这里出发”的说明位于酒店名称下方正文。
- **Do** 保留两种住宿入口、手机当前步骤自动滚入和可见的上一步、下一步、缺项反馈。
- **Do** 为清单名称与备注保留可见编辑边界、说明文字、键盘焦点与已备好状态。
- **Do** 在对应图片与结果旁保留来源、非实景、模拟与起价口径；让确认文案表达真实用户选择。
- **Do** 遵守减少动态设置，并在新界面变更时实测桌面、手机、键盘和无整页横向溢出。

### Don't:

- **Don't** 从未挂载的 V1 样式或历史截图恢复暗色矿物绿、宣传面板、预算模块或全局 AI 浮窗。
- **Don't** 把概念效果图作为逐像素尺寸要求，或为了“纸感”新增贴纸、花哨装饰和常驻卷角阴影。
- **Don't** 只靠颜色区分推荐、已加入和已确认，或把打开飞猪链接呈现成已选酒店、已预订。
- **Don't** 把加载、空结果和失败合成一个状态，或把未知进度呈现成确定百分比、承诺倒计时。
- **Don't** 把 AI 氛围图和通用风景图冒充指定地点实拍，或隐藏价格、距离与路线的限制说明。
- **Don't** 把本文的代码提取、截图或本地测试记录当作供应方可订、支付或生产全功能验收。

## D-10 · V2.1增量呈现

暖色参数、字体、Hero与GSAP沿用。酒店六槽桌面3列、平板2列、手机1列；整卡选中边框/浅陶土/勾选与短反馈，搜索加载/失败/空结果独立呈现。路线页每一天直接编辑，计算有真实进度；草图仅显示H、连续编号、逐日路线和图例。备忘录桌面双列、手机地图先于逐日内容；右上角编辑/导出/完成。交互详细正文见 [V2.1第3/5/6节](TRAVEL_V2_1_PRODUCT_SPEC.md)，本轮实测布局见 [交付记录](V2_1_DELIVERY.md)。
