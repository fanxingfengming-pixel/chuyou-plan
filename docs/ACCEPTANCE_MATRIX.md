# 需求验收矩阵

基准：CP-V2-2026-10-17。**原基线为文档整理与静态核对；D-08 本机修复的新增验收见下方 E-STABLE，不将历史证据重算为本轮。**
“历史证据”表示旧文件记录的范围，不表示服务此刻在线或当前代码已全面通过。规范验收条件在[功能需求](FUNCTIONAL_REQUIREMENTS.md)；差异在[KNOWN_GAPS](KNOWN_GAPS.md)。

## 证据索引

| 代号 | 文件 / 记录 | 范围 |
| --- | --- | --- |
| E-V2 | [V2 验收](v2/ACCEPTANCE.md)、[V2 测试](../tests/v2.test.tsx) | 原模拟交互、状态 / 恢复规则及历史联调范围 |
| E-LIVE | [真实接入](v2/INTEGRATION.md)、[浏览器记录](../artifacts/integration/browser-live.json)、[服务边界测试](../tests/server/integration.node.mjs) | 主要为长沙→北京特定日期；不是全城市商业验收 |
| E-IMG | [图片专项](v2/IMAGES.md)、[缓存测试](../tests/server/image-cache.node.mjs)、[杭州图片记录](../artifacts/integration/hangzhou-browser-images.json) | 高德 / FlyAI 对应图片、缓存、安全与通用图 |
| E-PDF | [PDF 专项](v2/PDF-EXPORT.md)、[PDF 测试](../tests/trip-pdf.test.ts)、[浏览器下载记录](../artifacts/pdf/browser-checks.json)、[渲染检查](../artifacts/pdf/pdf-checks.json) | 中文、分页、修改后导出、桌面手机与字体失败重试；使用明确模拟目录 |
| E-RUNTIME | [FlyAI 运行修复](v2/FLYAI-RUNTIME-FIX.md)、[运行验证记录](../artifacts/integration/flyai-runtime-verification.json) | 当时专用 Node 环境的有限轮次查询与异常退出保护 |

历史总数来自不同阶段：运行修复记录 46 项、接入 / 图片阶段 53 项、PDF 阶段 59 项。它们不是互相替代的当前统一测试总数；不得把 PDF 的模拟验证写成又一次真实供应方验收。

## 逐项追踪

| 需求 | 实现线索 / 历史证据 | 当前记录状态与下一次必要验收 |
| --- | --- | --- |
| FR-001 | App / Hero；E-V2；中文化记录 | 有历史证据；复查首页真实跳转、重置位置、三块宣传页不恢复 |
| FR-002 | SetupPages / services；E-V2、E-LIVE | 有历史证据；覆盖三种日期、可修改字段、失败与缺失补全 |
| FR-003 | App / router；E-V2 | 有历史证据；独立 URL、两分支、直接打开、浏览器前后退分别复测 |
| FR-004 | SetupPages / travel-api；E-LIVE | 部分真实场景；自驾未支持、国外 / 复杂中转未全面验收，K-002 |
| FR-005 | LocationPages；E-V2、E-LIVE | 模拟交互 + 真实区域接口证据；两组横滑、手动核心和自定义地点完整浏览器复测 |
| FR-006 | LocationPages / hotelBrands；E-V2、E-LIVE | 有历史证据；国外目的地品牌适用性待广泛验证 |
| FR-007 | HotelPages / flyai；E-V2、E-LIVE | 部分；字段缺口 K-001，不宣称所有真实筛选条件均可满足 |
| FR-008 | DualRangeSlider；E-V2 | 拖动 / 键盘历史证据；低端映射 K-005 待核验 |
| FR-009 | HotelPages / filterLiveHotels；E-V2 | 有历史交互；年份下限方向与未知数据硬筛选复测 |
| FR-010 | Provider / HotelPages；E-V2、E-LIVE | 六态历史测试；放宽能力 K-003、真实故障覆盖 K-011 待补 |
| FR-011 | HotelResults / selectHighlights / 服务精选；E-LIVE | 有历史展示；不重复与定位事实依据需覆盖候选不足 / 距离未知，K-003 |
| FR-012 | HotelCompare / selectHighlights；E-V2、E-LIVE | 上限和参数有历史证据；当前对比集 AI 摘要完成度不足以确认，K-003 |
| FR-013 | getBookingUrl / validBookingUrl；E-V2、E-LIVE | 有链接安全证据；未登录提示与真实酒店外跳复测；没有下单验收 |
| FR-014 | HotelConfirmation / model；E-V2、E-LIVE | 有手动确认、换酒店保留项历史证据；确认与外链分离必须回归 |
| FR-015 | PlacesPage / MCP；E-V2、E-LIVE | 有搜索 / 主动推荐 / 加入证据；多地点提醒和零景点边界 K-008 |
| FR-016 | LocalTransportSelector；E-V2、E-LIVE | 有流程证据；返回保留和进入路线的前置条件复测 |
| FR-017 | RoutePlanner / routeEngine；E-V2、E-LIVE | 有粗粒度路线证据；地点数确认、手选内容、无分钟假精度复测 |
| FR-018 | routeEngine / Agent 编辑；E-V2、E-LIVE | 移动 / 替换浏览器、删除接口和拖拽历史证据范围不同；需完整编辑浏览器回归 |
| FR-019 | Provider / restoreDraft；E-V2、E-LIVE | 有保存 / 新页面 / 重启历史证据；损坏、旧格式、保存异常和中断请求分别复测 |
| FR-020 | Common / Hero；E-V2 | 有取消 / 确认重置测试；验证重开不会恢复与不误提交 |
| FR-021 | model / Provider；E-V2 | 目的地 / 酒店已定义；日期人数模式残余确认状态 K-006 未完全确认 |
| FR-022 | image-cache / SafeImage；E-IMG | 有杭州实图与缓存历史证据；官网素材授权 K-004 未完成 |
| FR-023 | tripPdf / TripPdfExport；E-PDF | 有真实 PDF 生成下载证据；产物文件锁和服务稳定 K-007 待复测 |
| FR-024 | App / 产品边界；E-V2 | 当前代码线索符合主要范围；预算 K-009 不自动恢复，普通开发检查无新增全局浮窗 |
| FR-025 | Node / Agent / MCP / FlyAI；E-LIVE、E-RUNTIME | 部分真实场景；K-001、K-002、K-007、K-010、K-011 不可写成已全量通过 |
| FR-026 | 现行设计 / 样式 / GSAP；E-V2、E-LIVE、E-PDF | 有桌面与 390px 历史证据；不能推断所有手机 / 动态偏好已实机验收，K-012 |

## 以后如何更新

每次验证追加：日期、代码状态 / 提交（若有）、FR 编号、模式、场景 / 日期参数、执行方法、实际结果、证据文件和未验证范围。只有证据覆盖的用例能记“通过”；失败保留，修复后的成功另记。不要重写历史文件来掩盖早期失败。

## E-STABLE · 2026-10-17 本机稳定与数据可信修复

用户已批准 D-08，未初始化 Git。FR-007/008/010/011/012/015/018/019/022/023/025/026 的具体本轮覆盖见 [LOCAL-STABILITY](v2/LOCAL-STABILITY.md)。最终 npm run verify：49 前端 + 27 服务端 = 76 项、类型检查与构建通过，日志 [verify-final.txt](../artifacts/stability/verify-final.txt)。真实长沙→杭州酒店/景点/图片/路线、服务停止和启动后恢复、Windows PDF 独占文件锁与重复 UI 导出完成；用户人工确认夸克首页可打开。供应方失败、额度、超时和旧条件恢复分别属于模拟测试。Chrome/Edge 完整流程与本轮下载文件内容未验收，独立 AI 对比总结仍列 K-003。

## E-WARM · 2026-10-17 D-09 素材与暖色改版

本机代码状态：未初始化 Git；A 为用户在六张预览后明确选择。详细 T1–T9 结果见[本轮交付](WARM_V3_DELIVERY.md)。

| 需求 / 任务 | 本轮执行与实际结果 | 证据及范围 |
| --- | --- | --- |
| FR-001/026 · T1/T2/T8 | 六张预览、两张AI入口图接入，A暖色全流程；四组桌面/390px截图；审查提出的三项修正全部resolved | [风格](../artifacts/warm-v3/styles/index.html)、[浏览器记录](../artifacts/warm-v3/browser/report.json)、[独立复核](../artifacts/warm-v3/finish-review.md)；不是逐像素复刻验收 |
| FR-005/022 · T3 | 五城各3景点+3商圈，30/30本地实景照片；实际高德核实，两张Commons补图有作者与许可来源 | [逐条清单](PLACE_CATALOG.md)、[采集报告](../artifacts/warm-v3/catalog-report.json)；不等于所有供应方宣传素材的商用授权审计 |
| FR-005/010/025 · T3/T4 | 10次资料库命中无外部地点调用；广州图书馆首次库外搜索成功、第二次复用；正式入口五城6张图159–304ms | [缓存与真实搜索](../artifacts/warm-v3/catalog-verification.json)、[浏览器专项](../artifacts/warm-v3/browser/focused-checks.json)、[进程重启](../artifacts/warm-v3/restart-checks.json)；本机单轮数据，非公网SLA |
| FR-010/028 · T4/T5 | 慢网骨架、等待时间、无虚假比例；503失败保留输入/重试；缺项定位和直接地址门禁 | 专项中延迟/503为注入模拟；真实等待由SSE回调，协议分块与断流不重放有测试 |
| FR-015/017/019 · T6 | 核心首次加入、去重；主动移除后刷新/重建不回填，更换核心保留旧点 | [核心状态测试](../tests/warm-v3.test.ts)、四组浏览器流程中的移除恢复；路线仍为粗粒度顺序建议 |
| FR-019/023/027 · T7 | 自定义、名称/备注编辑、勾选、删除、恢复；四份PDF实际下载并抽取清单/备注/准备状态 | [PDF检查](../artifacts/warm-v3/browser/pdf-checks.json)、PDF渲染第1–3页；不含实时天气 |
| FR-003/014/018/020/026 · T5/T8/T9 | 两分支×1440/390完整流程、酒店手动确认、前后退、路线移动/恢复/优化、清单编辑删除、取消/确认重置；焦点与减少动态专项 | 浏览器流程明确使用mock酒店/交通；真实报价、下单和多设备不是本轮验收 |
| 工程 · T9 | 类型检查、57前端+30服务端测试通过；最终构建通过 | [完整检查](../artifacts/warm-v3/verify-final.txt)、[最终构建](../artifacts/warm-v3/build-final.txt)；PDF字体独立分包体积仍有构建提示 |

原49+27等历史结果保留其日期，不与本轮87项相加。供应方长期故障/真实额度耗尽没有新增全量验收。

## D-10 · V2.1本轮验收（2026-10-17）

规范与逐条验收ID见 [V2.1](TRAVEL_V2_1_PRODUCT_SPEC.md)，对应结果、证据与未验证边界见 [V2.1交付](V2_1_DELIVERY.md)。

| 验收ID / FR | 本轮结果与证据范围 |
| --- | --- |
| V21-01/02/04 · FR-011/014/029 | 桌面3×2、390px单列；无酒店地图，搜索独立、取消/指定槽替换/刷新、整卡确认；真实飞猪名称搜索，更多结果保留 |
| V21-03/11 · FR-028/029 | 未知报价null、主动高德兜底；503/空结果为模拟注入，恢复高德为真实查询；反馈/防重发/减少动态测试与浏览器通过 |
| V21-05/06 · FR-017/025 | 高德三种交通查询和两天五段实际往返；无AI距离/耗时；点列补充来源明确，未补齐标虚线 |
| V21-07 · FR-018 | HTML拖拽、跨天、删除、真实搜索添加/更换、自动重算与顺序/时段保持通过 |
| V21-08/09/10 · FR-019/023/029 | 完成进memo、PDF附属、H与跨天编号、返回/刷新/完成失效通过；旧路线迁移有单元验证 |
| V21-12 · FR-023/027 | 四次真实浏览器PDF下载，中文/地图/备注/编号/字体/分页边界检查通过，文件均2页A4；服务仍在线 |
| V21-13 · 回归 | 65前端+35服务端及构建通过；先前旅行信息/交通为注入草稿，不冒充本轮铁路或Hero真实验收 |

## E-BRAND-ROUTE · 2026-10-17 D-11

FR-006/010/017/018/025：固定八项品牌、多选刷新与旧值重选；提供者错误拆分与一次官方HTTP恢复；失效酒店POI重定位；铁路失败不影响市内逐日往返。67前端+45服务端=112项、类型与构建通过。真实12306失败后高德两日五段成功；原浏览器4天2地点行程实际成功，地图与最终备忘录可用，桌面及390px无横向溢出。错误分类/断连触发为明确模拟，HTTP后备实际查询。详细文件与边界见[本轮报告](BRAND_ROUTE_FIX.md)。历史截图那次上游唯一原因无法追溯，不将本轮成功冒充已确认历史根因。

## E-NO-SUBWAY · 2026-10-17 D-12

FR-007/010/019/023、FZ-007：酒店筛选页删除距地铁控件及占位，评分为单列；能力声明/搜索请求/前后端过滤与校验/放宽建议/PDF筛选摘要不再包含该条件。旧草稿恢复、状态更新和请求构造移除旧字段，其他预算、偏好及已选酒店/景点保留；其他暂不支持条件的主动清除测试保持。

类型检查、69前端+46服务端=115项及生产构建通过，见[本轮日志](../artifacts/remove-subway-verify.txt)。已通过Windows后台重启加载最终代码，实际接口确认无subwayDistance能力键。CUA实际浏览器1280px/390px无横向溢出、控件数0、文案不存在，刷新仍保持，控制台无错误/警告；见[浏览器记录](../artifacts/remove-subway-browser.json)。手机为视口模拟，本轮未重复查询供应方实时报价。原酒店地铁资料和市内路线能力保持，历史验收记录不重写。
