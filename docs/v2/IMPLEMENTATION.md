> 文档层级：历史技术 / 验收证据。现行唯一开发基准见 [docs 总入口](../README.md)，冻结规则见 [FROZEN_RULES](../FROZEN_RULES.md)。本文件保留原日期、实现描述和验证范围；其中“当前”指记录时点，不表示本轮复测，也不能覆盖现行需求。

# V2 实现与接入说明

所有源码、依赖、素材、构建与记录位于 D:\aaa飞猪。没有另建项目，没有覆盖 sources/ 同步资料。

## 修改与新增

修改：

- src/App.tsx：12 个独立 URL 页面、流程前置条件、标题与路由转场。
- src/main.tsx：引入规划页面样式。
- src/components/Hero.tsx：复用原开场与背景，输入接入 V2。
- src/components/Navbar.tsx：从锚点导航改为规划路由。
- package.json / package-lock.json：添加 jsdom 测试环境和 Prettier 格式化工具。
- README.md / PRODUCT.md：更新产品运行与边界说明。

删除用户指定的宣传模块源码：

- src/components/Features.tsx
- src/components/FinalCTA.tsx
- src/components/AIPlannerStory.tsx

新增：

- src/planning/types.ts：TripDraft、服务 payload、地点、酒店、交通、路线类型。
- src/planning/model.ts：初始状态、修改失效规则、恢复校验。
- src/planning/TripDraftProvider.tsx：共享 Context、LocalStorage、酒店请求与超时状态机。
- src/planning/router.tsx：原生 History API 路由，支持直开、前进和后退；没有锚点流程。
- src/planning/services.ts：独立异步数据服务。
- src/planning/contracts.ts：服务返回结构及媒体 URL 校验。
- src/planning/routeEngine.ts：近邻排序、分天、移动与按天优化。
- src/planning/components/Common.tsx：进度、摘要、重置确认、等待动画与复用控件。
- src/planning/components/DualRangeSlider.tsx：鼠标 / 触摸指针 / 键盘双把手价格范围。
- src/planning/components/SetupPages.tsx：Hero 输入、信息补全、模式与城际交通。
- src/planning/components/LocationPages.tsx：区域、品牌、地点搜索。
- src/planning/components/HotelPages.tsx：筛选、结果、最多 3 家对比、酒店显式确认。
- src/planning/components/ItineraryPages.tsx：景点、市内交通、路线生成与编辑。
- src/planning/planning.css：沿用原设计语言的规划页面与响应式样式。
- public/mock/v2/catalog.json：可被真实 fetch 读取的模拟目录。
- scripts/prepare-v2-mock.mjs：模拟目录生成脚本。
- tests/v2.test.tsx：V2 关键规则、异步状态与恢复测试。
- docs/v2/：本说明、验收、素材与设计记录。
- artifacts/v2/：验收截图与命令结果。

## 实际路由

| URL                    | 页面 / 顺序                              |
| ---------------------- | ---------------------------------------- |
| /                      | 原 Hero、开始规划、全部重置、继续草稿    |
| /plan/details          | 解析与信息补全                           |
| /plan/mode             | 先选区域 / 先找酒店                      |
| /plan/transport        | 模式之后的城际交通                       |
| /plan/area             | 区域分支：景点 / 商圈 + 核心地点         |
| /plan/hotel-preference | 酒店分支：目的地品牌偏好 / 跳过          |
| /plan/hotels           | 酒店筛选                                 |
| /plan/results          | 精选与更多结果                           |
| /plan/compare          | 最多 3 家对比                            |
| /plan/places           | 搜索景点，主动请求才推荐                 |
| /plan/local-transport  | 目的地内出行偏好                         |
| /plan/route            | 确认生成、粗粒度路线、拖拽与自然语言编辑 |

共享状态挂在路由外层，页面卸载不会丢失。缺少必要信息时路由会回到应补齐的步骤。SPA 部署需 index.html fallback。

## tripDraft

采用 React Context + 函数式更新，不增加状态管理库。LocalStorage 键 tripDraft，version=2。完整类型见 src/planning/types.ts。

- 需求：rawPrompt、parsedPrompt、parseSource、originCity、destinationCity。
- 日期人数：dateMode、departureDate、returnDate、fuzzyDateText、tripDays、adults、children。
- 住宿分支：planningMode、selectedPlaces（最多 3）、primaryPlace（单个或 null）、recommendedDistricts、brandPreference。
- 城际交通：intercityTransportPreference、selectedTransportMode、transportOptions。
- 酒店：hotelFilters、hotelSearchStatus、hotelSearchError、hotelResults、compareHotelIds（最多 3）、selectedHotel。
- 景点路线：tripPlaces、localTransportPreference、routeDraft。
- 恢复：lastUpdatedAt、lastRoute、version。

hotelFilters 包含 priceRange、minRenovationYear、overallRating、subwayDistance、selectedDistricts、starLevel、reviewCount、userScore、facilities，不包含品牌。

修改目的地清空区域、核心地点、品牌、行政区、交通推荐、酒店筛选与结果、酒店选择、景点、市内偏好和路线，保留出发地、日期、人数。重新选择酒店保留筛选、核心地点、已选景点与市内交通，只清除旧路线。

routeDraft 包含 days[{day,stops[{id,kind,placeId,name,period}]}]、needsOptimization、generatedAt。period 仅为早上 / 中午 / 下午 / 晚上。generatedAt 是保存元数据，不是行程中的时间。

## 异步服务与 mock

明确启用的本地模拟通过 fetch('/mock/v2/catalog.json') 读取，再执行真正的筛选与计算，没有固定延时假装成功。酒店请求状态 idle/loading/success/empty/error/timeout：

- 15 秒软超时，原请求继续等待；继续等待复用原请求。
- 重新搜索会取消前一个请求。
- 空结果保留条件，由用户主动选择 3 套放宽方案之一，先回筛选检查，再搜索。
- 目的地或 payload 改变时，旧成功结果不会污染新草稿。
- 刷新会中断网络请求，恢复到 idle，保留条件可重新搜索。

当前默认 live 模式，已实现真实服务端代理，接入证据见 INTEGRATION.md。模拟目录仅用于明确启用的离线模式及自动化测试。城市参考预算仍为静态预设，路线仍是本地粗粒度算法。酒店供应方缺失参数保留 null，不用模拟值填充。

## 当前服务接线

| 能力                | 前端 service                                               | 本站代理 endpoint              |
| ------------------- | ---------------------------------------------------------- | ------------------------------ |
| 需求解析 AI         | parseTripPrompt(prompt)                                    | POST /parse-trip               |
| 高德 MCP 地点定位   | searchPlaceWithAmapMCP(query,city,signal)                  | POST /amap/search-place        |
| 高德 MCP 行政区     | resolveDistrictWithAmapMCP(place,signal)                   | POST /amap/resolve-district    |
| 12306 MCP         | searchRailOptions(draft,signal)                            | POST /rail/search              |
| FlyAI 航班          | searchFlightOptions(draft,signal)                          | POST /flight/search            |
| 交通比较            | compareTransportOptions(draft,signal)                      | POST /transport/compare        |
| FlyAI 酒店          | searchHotelsWithFlyAI(payload,signal)                      | POST /flyai/search-hotels      |
| 按需景点推荐        | recommendTripPlaces(draft,signal)                          | POST /recommend-places         |
| 飞猪 Skill 酒店链接 | 搜索返回 Hotel.bookingUrl，getBookingUrl(hotel) 校验并使用 | 已随供应方结果返回真实 detailUrl |

VITE_TRAVEL_API_BASE 可设为同源代理前缀，例如 /api/travel。这是接口路径，绝不能放 Key。当前已实现真实后端代理，默认 live；只有显式设置 VITE_TRAVEL_DATA_MODE=mock 才使用模拟模式。请求失败会报错，不会静默退回 mock。

真实后端必须负责 Skill/MCP 调用、供应方字段规范化、服务端输入验证、限额与密钥保护。返回数据需符合 types.ts 和 contracts.ts；React 仅渲染文本。飞猪链接只允许 HTTPS 下的 fliggy.com / alitrip.com / feizhu.com 及其子域。

酒店 payload 除筛选条件外，还携带出发地、目的地、精确 / 模糊 / 往返日期、天数、成人儿童人数、区域、核心地点、行政区、品牌偏好和城际交通方式。模糊日期必须在真实供应方要求精确入住离店日期时再补齐，不应猜测实时房价。

## 当前限制

路线没有实时路况、开放时间、门票预约、营业日期或容量校验；只是酒店出发的近邻顺序建议。修改天数会清除旧路线。手动移动保留天数分配，重新优化只调整各天内部顺序。live 模式的自然语言修改通过百炼理解简称与移动、删除、替换意图，再校验已选地点和有效天数；mock 模式保留有限规则。

此项目无账号、云端保存、我的行程中心、订单、付款或酒店详情页。没有全局 AI 浮窗。
