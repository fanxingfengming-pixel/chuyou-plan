> 2026-10-17 新增本机稳定与可信度修复：[LOCAL-STABILITY](LOCAL-STABILITY.md)。下文保留原阶段日期与数量，最终本轮回归 76 项见新记录。

> 文档层级：历史技术 / 验收证据。现行唯一开发基准见 [docs 总入口](../README.md)，冻结规则见 [FROZEN_RULES](../FROZEN_RULES.md)。本文件保留原日期、实现描述和验证范围；其中“当前”指记录时点，不表示本轮复测，也不能覆盖现行需求。

最新修复：FlyAI Windows 退出异常已通过独立运行版本验证解决，当前回归共 53 项，详见 [FLYAI-RUNTIME-FIX.md](FLYAI-RUNTIME-FIX.md)。

# V2 真实服务接入记录

日期：2026-10-16，Asia/Shanghai。项目：D:\aaa飞猪。当前预览：http://127.0.0.1:5173/ 。

## 当前结论

主要规划流程已完成真实服务联调；还不能认定除图片外全部完成。当前有明确的数据缺口与运行限制。本文区分真实服务证据、自动化测试与未验收场景。

## 接入结构

网页只调用本站 /api/travel。Node 服务端负责凭据、Managed Agent Session/SSE、MCP 客户端、FlyAI CLI、数据规范化与条件过滤。

百炼沿用现有 Managed Agent 和模型 deepseek-v4-flash-0731，固定 version 11。未修改云端 Agent 提示词、工具包、Skill 或 Environment。每个结构化任务创建自己的临时会话，先订阅 SSE 再提交消息，以 idle/end_turn 确认结束，仅归档本次创建的会话。

高德使用官方 Streamable HTTP MCP。地点搜索 → POI 详情 → 逆地理编码取得坐标与行政区，不通过网页搜索猜行政区。地点图片不会因为高德返回了照片就自动当作已获授权的官网素材。

铁路使用 npm 12306-mcp 0.3.10，通过 stdio 的 get-tickets 查询。它是第三方开源 MCP，数据来源为 12306；不是官方 12306 SDK，也没有声称另行安装 Python 版 12306 Skill。

FlyAI 使用已安装 FlyAI Skill 对应的官方 @fly-ai/flyai-cli 1.0.16，服务端只开放查询命令。飞猪酒店直链取自 detailUrl，允许 HTTPS 的 fliggy.com、alitrip.com、feizhu.com 及其子域，拒绝带账号密码的 URL。无有效直链的真实酒店不会伪造首页链接。应用没有下单接口，手动确认只表示规划选择。

## 函数映射

| 能力 | 前端 service | 当前服务端实现 |
| --- | --- | --- |
| 百炼需求解析 | parseTripPrompt | agent-tasks.js / parseTripWithAgent |
| 高德地点定位 | searchPlaceWithAmapMCP | mcp.js / searchPlaces、getPlaceDetail |
| 高德行政区 | resolveDistrictWithAmapMCP | mcp.js / reverseDistrict |
| 热门区域 | getAreaRecommendations | travel-api.js / areaRecommendations：Agent 名称建议 + 高德核验 |
| 酒店品牌 | getHotelBrands | travel-api.js / hotelBrands：目的地查询结果中实际出现的品牌 |
| 铁路 | searchRailOptions | travel-api.js / railOption → mcp.js / queryRail |
| 航班 | searchFlightOptions | travel-api.js / flightOption → flyai.js / runFlyai |
| 交通比较 | compareTransportOptions | travel-api.js / compareTransport：真实查询摘要 + Agent |
| 酒店搜索 | searchHotelsWithFlyAI | flyai.js / searchLiveHotels、normalizeHotel、filterLiveHotels；travel-api.js / searchHotels 生成精选 |
| 飞猪链接 | getBookingUrl | flyai.js / validBookingUrl 规范化 detailUrl |
| 主动景点推荐 | recommendTripPlaces | travel-api.js / recommendPlaces：Agent 建议 + 高德核验 |
| 无结果建议 | getRelaxationAdvice | travel-api.js / relaxationAdvice，用户仍手动选择放宽条件 |
| 路线自然语言修改 | interpretRouteEdit | travel-api.js / routeEdit，只返回已选地点的移动、删除、替换意图 |

路线排序仍由 routeEngine.ts 按真实可用坐标进行粗粒度近邻排序，这是 V2 约定的本地算法，不冒充道路导航。自然语言修改在 live 模式由 Agent 理解，确定性操作在前端执行，替换地点需高德核验。

## 本次真实服务证据

测试日期以 2026-10-18 出发、长沙→北京为主，示例价格和余票只对应查询时刻。

- 百炼真实 SSE 完成需求解析，模糊时间“11月上旬”保持模糊；浏览器精确日期需求回填长沙、北京、4 天、2 成人。
- 12306 独立探测返回 5 条高铁；浏览器比较查询返回 8 条铁路和 10 条航班候选。不同调用的数量与报价可能变化。
- 区域接口真实返回 6 个已核验地点：故宫、八达岭、颐和园，以及北京 SKP、三里屯太古里、王府井步行街。各自具有高德行政区及坐标。
- 酒店广范围实查返回 11 个供应方条目，浏览器显示 3 家不同精选并完成三家对比。随后已排除名称明确为计时、钟点或休息室的候选，避免误当普通过夜酒店。
- 最终酒店接口以故宫为核心并筛选东城区，实际得到 2 家符合条件的酒店，返回核心直线距离、真实行政区和飞猪直链。
- 浏览器只在手动“我已选择这家酒店”后显示确认状态。
- 高德搜索故宫、景山并手动加入；景点页初始没有主动推荐。
- 浏览器生成 4 天粗粒度路线，Agent 将“故宫”简称理解为已选故宫博物院并移到第三天。
- 初次接口替换意图测试出现非 JSON 输出；已补充仅对已完成的无效格式进行一次纠正。最终新页面真实执行“把景山换成天坛公园”，Agent 理解操作、高德确认天坛，路线成功替换。
- 删除意图的真实接口测试通过；本轮未在最终浏览器草稿中删除景点。拖拽交互的浏览器验收沿用前一轮 V2 记录，本轮状态测试继续通过。
- 重启前后端后重新打开路线页，酒店、景点、故宫第三天及待优化状态完整恢复。
- 手机 390×844 检查没有横向溢出，最终全新页面 console error / warning 为 []。

## 自动化与防护证据

npm run verify 通过：35 项前端测试 + 18 项服务端测试，共 53 项；正式构建通过。测试包含未知酒店字段恢复、飞猪链接校验、严格筛选、JSON 格式纠正、网络失败不重复提交、跨站拒绝、非法输入以及模糊日期错误边界。

全量 npm audit 结果为 0 个已知漏洞。12306 的间接 SDK 依赖通过限定 override 更新到 1.32.1，并重新安装依赖解决；没有使用盲目的强制升级。

.env.server、.env.local、/@fs 对应环境文件、server 源码及内部联调 JSON 通过开发预览访问均返回 403。已扫描源码、public、dist、server、文档、脚本和测试产物中的已配置 Key，未发现明文泄漏。服务只监听本机，不向网页发送 Key 或原始上游异常。

error/timeout/empty 等状态有自动化测试；没有把断网、供应方超时或真实额度耗尽写成完整浏览器验收。

## 仍有的缺口与范围

1. 酒店地铁距离、评论数量、设施和数字星级没有由当前 FlyAI 返回完整数据。UI 显示待核实；启用相关硬性筛选会排除未知候选，不能假装满足。供应方“经济型/舒适型”等等级文字不当成已认证星级。
2. 综合展示评分是供应方 5 分用户评分的等比例 10 分换算，不是独立 AI 评分。价格为查询报价，实际房型、人数、儿童政策、早餐、取消规则和库存仍需飞猪页面核对。当前酒店 CLI 未提供入住人数/房间组合参数，不能声称结果已保证容纳全部同行者。
3. FlyAI CLI 的 Windows 退出异常已通过专用 Node 24.20.0 解决当前本机场景，连续三轮真实查询与重启后的代理接口均通过，详见 FLYAI-RUNTIME-FIX.md。配置错误或再次异常退出会明确失败。
4. 实时票价/酒店查询要求精确日期；模糊日期可以解析与保存，但报价前需要补齐，不猜测入住日。
5. 自驾尚未查询真实道路，当前不可推荐。地图展开只是坐标相对分布，非交互道路底图。路线没有实时路况、营业时间、预约容量或门票可订性；这是当前 V2 粗粒度范围。
6. 国外目的地、复杂中转、多房间/多人、多儿童、真实额度不足、长时间断网和正式部署尚未完成全面验收。本次不是全量城市或商业上线验收。
7. 地点与酒店已接入高德 / FlyAI 图片并持久缓存；无图时使用明确标注的通用风景示意图。品牌及各机构官网素材仍待补齐与授权核对，当前供应方图片不冒充官网授权素材。详见 IMAGES.md。
8. 没有订单、支付或实际预订验收；产品按要求跳飞猪完成后续操作。

## 文件与配置

新增 server/config.js、managed-agent.js、sse.js、agent-tasks.js、mcp.js、flyai.js、travel-api.js、app.js、errors.js；scripts/dev.mjs 与若干可复用探测脚本；tests/server/integration.node.mjs；.env.example。

更新 package.json / lockfile、Vite 同源代理与文件访问限制、src/planning/services.ts / contracts.ts / types.ts / model.ts、各步骤页面的真实字段显示。拆出 draftContext.ts 与 payload.ts，减少开发热更新的上下文混用。

配置值仅在本地私密文件中：.env.server 的百炼配置和 AMAP_MAPS_API_KEY；.env.local 的 VITE_TRAVEL_API_BASE=/api/travel、VITE_TRAVEL_DATA_MODE=live。FlyAI 沿用用户已有本机私密配置，也支持服务端 FLYAI_API_KEY。不得把凭据复制进云端提示词或前端环境变量。

证据位于 artifacts/integration/：verify.txt、audit-full.json、http-boundaries.json、secret-scan.json、agent-live-parse.json、area-live.json、amap-normalized.json、rail-live-query.json、live-api-acceptance.json、browser-live.json，以及 live-route-desktop.jpg / live-route-mobile.jpg。live-api-acceptance.json 保留首次替换输出失败，最终修复后的浏览器成功见 browser-live.json 与截图，未抹去早期失败。

依赖和项目均未复制到 C 盘；所有最终代码、配置、截图和记录均在本项目目录。


