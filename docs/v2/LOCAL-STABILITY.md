> 技术实施与验收记录；现行规范见 [docs 总入口](../README.md)。日期：2026-10-17（Asia/Shanghai）。

# 本机稳定运行与数据可信度修复

用户已明确要求实施本机稳定运行方案；授权记录 D-08。涉及 FR-007/008/010/011/012/015/018/019/022/023/025/026，沿用暗色 UI、共享草稿、现有百炼 Agent 和模型。没有新增订单、账号、公网监听或开机自启。

## 日常使用

在 D:/aaa飞猪 双击「启动出游plan.cmd」：先构建，再启动独立后台服务。随后在本机浏览器打开 http://127.0.0.1:5173/ 。双击「停止出游plan.cmd」停止本项目拥有的进程。命令行等价方式：

```powershell
Set-Location -LiteralPath 'D:\aaa飞猪'
npm.cmd run build
npm.cmd run start
npm.cmd run status
npm.cmd run stop
```

start 不重新构建；修改源码后先 build，或使用双击入口。服务由现有 Node 同时提供 dist 网页与 /api/travel 查询，独立路由正常回退。关闭 Codex 对话不会结束这一后台服务；关闭 Windows 后需手动再次启动。开发仍用 npm run dev，不能与稳定模式同时占用 5173。vite preview 只用于构建检查，不作为日常运行入口。

端口冲突明确报错，不擅自换端口或结束其他进程。自身已运行时复用。后台只管理自身创建的子进程，通过本项目私有控制管道停止；运行状态和脱敏日志在 data/runtime/，不向网页提供。子进程异常在 60 秒窗口内最多重启 3 次，连续失败明确停止；不自动重放任何 Agent / 供应方请求。

## 修复依据

原开发日志记录 Vite 监听 artifacts/pdf/browser-1440.pdf 时发生 Windows 文件锁 EBUSY，前端退出后旧启动脚本联动结束 API。生成文件被当成源码监听，是这次本地查询断开的直接原因；供应方故障不能据此一概归因于文件锁。

开发监听现排除 artifacts、data、PDF QA、缓存等生成目录。日常稳定模式不运行源码监听。健康接口只说明本地服务可用，并明确“凭据已配置”不代表供应方在线。

统一请求客户端区分本地服务断开、超时、供应方公开错误及额度不足，显示中文恢复操作；保留输入和草稿。状态检查只读健康与能力接口，服务恢复后仍需用户主动重试业务查询。

## 能力与推荐口径

- GET /api/travel/capabilities 声明数据源可支持的筛选。当前禁用地铁距离、数字星级、评论数量、设施；保留可得数据的价格、评分、用户评分、装修年份和行政区条件。单家未知字段仍待核实。
- 旧草稿保留未支持条件，明确列出并阻止查询；用户点击「清除未支持条件」才清除相应字段，其余条件保持。服务端也会在调用供应方前返回 UNSUPPORTED_FILTERS / 422。
- 价格两端统一由 shared/price-bounds.js 转换：0 作为下界表示 0；作为上界表示 200；2000 作为上界表示不设上限。已修复原 ≤200 档误当最高 0 元的缺陷，旧草稿无需改变格式。
- Agent 只在真实候选 ID 中选择综合推荐。价格、距离等由程序比较；文案只引用已知字段，距离明确为直线，价格明确为供应方每晚起价。未知房型、设施、入住人数和交通便利性不补造。
- Agent 不可用时仍返回真实供应方候选，显示「AI 推荐暂未生成」，按已知数据整理；没有静默切换模拟酒店。
- 价格、位置标签针对本次候选，其他精选项在剩余候选中比较，不承诺全城最低或位置最优。对比页说明起价及距离口径；独立针对对比集合的新 AI 摘要仍列 K-003，未冒充完成。
- 图片失败有独立兜底，不再拖垮地点 / 酒店查询。原图片缓存、来源标签和远程图片防护保留。
- 模糊日期仍可规划，实际报价前补精确日期。不同浏览器不会自动同步 LocalStorage 草稿。

## 本轮证据

| 类型 | 实际范围与结果 |
| --- | --- |
| 构建与回归 | npm run verify：49 项前端、27 项服务端，共 76 项；类型检查和构建通过。原 verify.txt、server-tests.txt 保留较早阶段，最终记录为 artifacts/stability/verify-final.txt |
| 真实服务与内置浏览器 | 长沙→杭州，2026-10-18，4 天、2 成人。真实 FlyAI 查询得到 10 家候选，百炼选择有效候选 ID；浏览器 10 张酒店图片均加载；高德搜索西湖、灵隐寺并手动加入 |
| 用户确认与路线 | 手动确认酒店后生成 4 天、2 个景点的粗粒度路线；西湖移到第 3 天，出现「重新优化路线」 |
| 停止与恢复 | 实际停止服务后出现中文不可用提示，输入西湖保留；重新启动后主动重试成功。再次停止 / 启动后，酒店、两个景点、西湖第 3 天及待优化标志恢复 |
| PDF 与文件锁 | 在真实页面多次点击导出均显示「PDF 已生成并发起下载」，网页与 API 继续在线。另用 Windows 独占锁保持本项目 PDF 产物，实际 Vite watcher 未监听该生成目录且无 EBUSY；见 watch-lock-check.json |
| PDF 下载边界 | 本轮浏览器下载事件捕获工具超时，未取得这轮下载文件路径；不将 UI 成功提示当作已重新核验下载文件内容。中文、分页和渲染保留 PDF 专项历史证据 |
| 外部浏览器 | 用户手动反馈夸克可以打开首页；仅将此项记为人工验证。Chrome / Edge 完整规划及实际下载流程未完成本轮验收，当前自动化环境未提供可控制的 Edge |
| 页面 | 桌面 1280 宽、手机 390×844 检查未横向溢出；最终新页面 console warn/error 为空。截图在 artifacts/stability/ |
| 安全边界 | 实际图片 HTTP 复测、私密路径拒绝、配置值泄漏扫描；最终报告见 artifacts/integration/image-http-checks.json、secret-scan.json |

模拟测试明确涵盖供应方额度不足 / 未知失败、请求超时与取消、旧筛选主动清除、旧 AI 文案不再显示、重启预算。另实际启动隔离的 Node 子进程验证崩溃重启并到达有限上限，健康子进程继续运行。没有故意耗尽真实供应方额度，也未模拟为真实故障发生。

## 文件与接口

运行：scripts/local-service.mjs、supervisor.mjs、dev.mjs、根目录启动/停止入口、package.json、vite.config.ts、.gitignore。Node：server/app.js、static-site.js、capabilities.js、travel-api.js、flyai.js、image-sources.js。共享契约：shared/hotel-capabilities.json、hotel-ranking.js/.d.ts、price-bounds.js/.d.ts。

前端：App.tsx、planning/serviceClient.ts、ServiceStatusProvider.tsx、serviceStatusContext.ts、filterCapabilities.ts、services.ts、TripDraftProvider.tsx、types.ts、planning.css，以及 ServiceStatus / HotelPages / LocationPages / ItineraryPages 组件。新增针对稳定运行、请求错误、能力与价格端点的测试；保留现有 PDF 实现。

Agent / 高德 MCP / 12306 MCP / FlyAI 的既有服务映射未改变；健康和能力接口不会调用模型。搜索、推荐、路线修改仍经既有 services → server/travel-api.js。没有升级或替换云端 Agent。
