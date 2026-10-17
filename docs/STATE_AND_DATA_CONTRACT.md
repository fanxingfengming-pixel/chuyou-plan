# 状态与数据契约

基准：CP-V2-2026-10-17。行为以 FR-019 至 FR-021 和本契约为准。字段类型实现见 [types.ts](../src/planning/types.ts)、[model.ts](../src/planning/model.ts)、[contracts.ts](../src/planning/contracts.ts)；代码用于核对实现，不自行覆盖需求。

## tripDraft

现有实现为 React Context + 函数式更新，LocalStorage 键 tripDraft，version=2。共享 Provider 在页面路由外层，切页不丢状态。

| 字段 | 语义 / 约束 |
| --- | --- |
| rawPrompt、parsedPrompt、parseSource | 用户原文、解析信息、mock / live 来源 |
| originCity、destinationCity | 出发地和目的地；目的地改变触发关联数据失效 |
| dateMode、departureDate、returnDate、fuzzyDateText | exact / fuzzy / range；模糊日期不猜成精确入住日期 |
| tripDays、adults、children | 天数、成人、儿童；必要信息补齐才能继续 |
| planningMode | area / hotel / 未选 |
| selectedPlaces、primaryPlace | 区域阶段位置最多 3 个；核心最多 1 个且属于已选位置，须手动指定 |
| recommendedDistricts、brandPreference | 高德确认的推荐行政区；酒店分支前置品牌偏好 |
| intercityTransportPreference、selectedTransportMode、transportOptions | 城际偏好、手动选择方式、查询候选 |
| hotelFilters | 见下表，不含品牌 |
| hotelSearchStatus、hotelSearchError、hotelResults | 六态、公开错误说明和候选；不能因恢复而补造成功 |
| compareHotelIds | 去重、最多 3 个、必须来自当前结果 |
| selectedHotel | 只有用户手动确认的酒店，null 表示未确认 |
| tripPlaces | 正式已加入的景点；不同于 selectedPlaces / 推荐列表，不设硬上限 |
| localTransportPreference | 酒店与景点确认后的市内偏好 |
| routeDraft | 分天/用户顺序、高德酒店锚点、真实legs和核实状态；D-10契约见V2.1 |
| lastUpdatedAt、lastRoute、version | 保存元数据 / 恢复位置 / 格式版本，不是行程精确时间 |

现有表单支持天数 1–30、成人 1–20、儿童 0–20，日期检查返程不早于出发。以上是 2026-10-17 源码中的实施约束，不是用户明确冻结的人数 / 天数上限，也不证明供应方支持多人多房或全部儿童场景；后续调整须验证服务边界。

## 筛选和酒店 payload

hotelFilters 包含 priceRange、minRenovationYear、overallRating、selectedDistricts、starLevel、reviewCount、userScore、facilities。设施集合覆盖早餐、停车、健身房、洗衣房、亲子、禁烟房；品牌单独来自 brandPreference。

HotelSearchPayload 在这些条件上携带 originCity、destinationCity、dateMode、departureDate、returnDate、fuzzyDateText、tripDays、adults、children、selectedPlaces、primaryPlace、recommendedDistricts、brandPreference、selectedTransportMode。

- 每晚价格是供应方起价，不得解释为完整房间、全部同行人数或总价。价格元组维持旧格式：下界 0 不设最低限制，上界 0 表示 200，上界 2000 不设最高限制；统一 shared/price-bounds.js 转换。K-005 现有自动化修复记录不冒充真实低价报价验收。
- 装修年份 0 表示不限，其余表达最低年份，不是装修上限。
- D-12：距地铁不再是筛选条件。Hotel.subwayDistance作为可选酒店资料保留，未知仍为null；核心直线距离必须标明，不能称为步行或道路距离。
- 供应方没有对应字段时，UI 保留待核实，不能用模拟值补空。
- 传递成人儿童字段不等于供应方已支持入住人数 / 房间组合；缺口见 K-001。

## 修改与失效矩阵

| 操作 | 保留 | 清空 / 失效 |
| --- | --- | --- |
| 仅切页或返回 | 整个有效草稿 | 无 |
| 修改目的地 | 出发地、日期、天数、人数、原需求等通用信息 | 区域、核心、品牌、行政区、目的地交通候选与选择、酒店筛选重置为新目的地默认、结果 / 对比 / 已选酒店、景点、市内偏好、路线 |
| 手动更换已选酒店 | 筛选、核心、区域、品牌、景点、市内偏好 | 旧路线 |
| 修改景点 / 市内偏好 / 天数 | 未受影响的信息 | 旧路线；明确的移动 / 删除 / 替换需原子更新相关景点与路线 |
| 修改酒店检索条件 | 旅行信息和新条件 | 当前请求、旧结果与对比；已确认酒店等剩余状态见 K-006 |
| 修改日期 / 人数 / 出发地 / 模式 | 规范明确的通用信息 | 与新查询不相符的结果必须失效；更细的确认状态未冻结，见 K-006 |
| 手动移动 / 拖拽 | 指定天数分配与顺序 | D-10：旧legs失效并自动重算高德；不自动重排 |
| 主动重新优化 | 用户指定分天 | 仅优化各天内顺序 |
| 导出 PDF | 草稿全部 | 不产生任何业务失效 |
| 确认全部重置 | 图片缓存、服务配置、无关数据 | tripDraft、选择、路线、挂起请求 |

K-006 所述未决事项不能被此表解释为允许保留不对应新条件的有效报价，也不能据此未经授权重置所有用户选择。

## 异步与恢复

idle → loading → success / empty / error；超过软超时进入 timeout，但原请求可继续。继续等待使用原请求；重新搜索取消旧请求；payload 变化与重置使旧响应失效。现有软超时为 15 秒。

本地数据不可信，恢复检查结构、枚举、数值、关联和来源。loading / timeout 不跨刷新恢复为真实请求，转为 idle；未知酒店字段仍未知。旧版本 / 损坏草稿安全回退。保存异常有说明，当前页面仍可操作。格式升级必须设计兼容 / 迁移，不能不告知地丢弃用户数据。

## 返回数据与 URL

- Place 至少含稳定 ID、名称、城市、类型、行政区、地址、真实坐标与 source；未知地点不编造坐标。
- Hotel 包含供应方 ID、名称、目的地、报价、可核实的评分 / 地理数据、reason、source、bookingUrl 和图片来源；未知参数保持 null。
- 综合展示分数可由供应方 5 分用户评分换算到 10 分，必须可追踪；不是独立 AI 评分或认证等级。
- source 区分 live / mock；不能以模拟目录补真实库存或缺失字段。
- bookingUrl 仅允许 HTTPS 的 fliggy.com / alitrip.com / feizhu.com 及其真实子域，拒绝账号密码、伪装域和危险协议。
- 前后端契约验证不等于验证供应方商业事实，房型 / 库存 / 政策仍须供应方页面核对。

## 路线

routeDraft = days[{day, stops[{id, kind, placeId, name, period}]}] + needsOptimization + generatedAt。kind 为 place / meal；period 为早上 / 中午 / 下午 / 晚上。generatedAt 只表示元数据，不生成分钟级行程。

已选地点由稳定 ID 关联。D-10使用逐日直接编辑，替换/添加地点先定位并由用户选择，原子更新景点与路线；自动重算保留手动分天/顺序。原自然语言接口仅为兼容留存，不在页面使用。

## 图片与持久缓存

- 实体键为 amap:<POI ID> / flyai:<酒店 ID>，data/image-cache 保存首次成功结果与索引。相同 ID 后续沿用，服务重启复用。
- 同实体并发去重；确定无图可记无图；临时网络失败后续允许重试。
- 当前图片最大转换尺寸 1200×900、WebP 内容哈希文件名，页面通过 /api/travel/media/<hash>.webp 访问；一年 immutable 缓存为现有实现，不是永久冻结的基础设施选择。
- 限定 HTTPS CDN，拒绝 URL 凭据、私网地址、未知重定向，不开放任意 URL 代理。保留 5 MB 下载 / 3600 万像素解码上限或更严格限制，兼容问题不能靠关闭防护解决。
- 阿里图片可尝试已验证的 1200 缩略图，再安全尝试原图；不修改签名地址、不重复缩放。
- 无图显示通用风景及“非实景”标签；图片来源和授权边界见 [ASSETS](v2/ASSETS.md)。
- 当前为单实例本地缓存；多实例 / 账号存储不属于本轮保证。

## 服务与私密数据

前端只请求本站服务，服务端保存凭据、校验输入与公开错误。API 的详细映射见[架构](PROJECT_ARCHITECTURE.md)。Managed Agent 返回必须完成且结构校验通过再使用；MCP / Skill 数据和 LLM 意图不直接执行为任意代码。密钥、Environment 标识的私密值、本机账户配置与原始异常不进入本规范。

## D-08 · 能力与运行状态

GET /api/travel/capabilities 返回 version、provider、hotelFilters 布尔声明。D-12删除subwayDistance筛选能力键；当前无数据条件禁用但不删除：starLevel、reviewCount、facilities。其旧值仍由用户主动清除，服务端拒绝未支持条件。被明确删除的旧hotelFilters.subwayDistance在草稿恢复、状态更新和请求构造时移除，其他字段保留；旧请求即使含该字段也不再用于过滤或阻拦。

Hotel 可含 recommendationSource（agent / rules）及 rankingNotice；旧 reason 不能当作已核实事实继续展示，live 页面按已知字段重建理由。localService/本地状态只代表当前 Node，供应方是否可用以实际查询为准；健康轮询不触发业务请求。tripDraft 版本及键仍为 version=2 / tripDraft。


## D-09 · 资料库、进度与草稿增量

- tripDraft键与version=2保留，增加corePlaceDecisions、packingItems、suppressedPackingIds；旧草稿缺新字段时填空默认值，不丢已有酒店、地点和路线。损坏的新字段单独安全回退。
- corePlaceDecisions按稳定地点ID记录included/excluded。自动加入只处理尚未排除的当前核心；用户删除后excluded，主动重新加入后included。目的地改变清除核心记录。补记已存在核心的决定不会清除原路线。
- packingItems含id、name、note、packed、origin(suggested/custom)、可选customized。更新自动建议时沿用用户定制与勾选，删除建议保存到suppressedPackingIds。更换目的地保留custom项及建议物品的用户编辑/勾选；自动建议重算，不再适用但已编辑或勾选的物品保留为备忘，主动删除继续由suppressedPackingIds记忆。清单修改不失效路线；全部重置清空。当前实现上限300项，名称80字符、备注300字符，属于实施约束。
- data/place-catalog.sqlite持久保存地点资料、城市推荐关联、查询别名与匿名耗时样本。图片仍在data/image-cache；资料来源source保持live/mock，本次读取方式loadedFrom另行区分catalog/search，核对日期checkedAt不等于实时开放或库存保证。
- 显式mock从资料库导出public/mock/v2/catalog.json和本地public/images/places文件；真实失败不静默转模拟。更新素材不覆盖用户草稿中的酒店确认。
- POST接受可选Accept:text/event-stream，事件progress/result/error；原JSON接口兼容。progress含stage、可选completed/total、elapsedMs、estimateRangeMs。只按可测数量给比例；至少5次同类成功查询的近期耗时样本才估计范围，目录命中不混入外部搜索耗时。断流不自动重放业务。
- 确认全部重置只清tripDraft与挂起请求，保留共享地点资料库及图片缓存。

## D-10 · V2.1增量

新增候选槽、可空POI酒店价格、高德酒店锚点、真实路段、路线状态、全局编号与完成状态的契约/迁移见 [V2.1第7节](TRAVEL_V2_1_PRODUCT_SPEC.md)。旧路线保留顺序但待重新核实；旧异步响应不能覆盖新签名。

## D-11 · 品牌与路线错误恢复

brandPreference只接受七个品牌偏好组，空数组为不限。历史移出范围的值原样保留并提示重新选择，下一次用户选择时按白名单更新；服务端拒绝过期值。卡片选择用函数式更新，多选为并集；品牌与已知子品牌的查询匹配规则集中在shared/hotel-brands.js，未知不自动归组。

市内amap/route不读取铁路结果。错误码按AMAP_/RAIL_分开；高德Key/权限/额度/参数/超时/JSON错误输出固定安全信息，不输出上游URL、原文或密钥。MCP连接/格式故障只向同一高德官方HTTP服务后备一次（12秒上限），不更换数据来源、不改模拟。原酒店POI失效时按名称重新核实；多分店需用户确认。部分路段失败仍保留酒店与景点真实坐标、原顺序与虚线点位示意，距离/耗时未知保持null，不能导出为完整已核实路线。
