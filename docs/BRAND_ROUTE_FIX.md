# 品牌与最终路线修复交付

日期：2026-10-17（Asia/Shanghai）。项目：D:/aaa飞猪，原地修改，未初始化Git。授权D-11，影响FR-006/010/017/018/025及FZ-006/013/014/016/018。沿用现有A暖色旅行手账、页面路由、酒店手动确认和草稿结构。

## 已确认的问题与证据边界

1. 品牌选项原来由一次FlyAI搜索返回的brandName决定，所以截图会只显示锦江/花筑/格兰云天。这是目录来源错误，已改成共享固定偏好白名单。
2. 原MCP适配器把isError或Error:文本一律改成MCP_QUERY_FAILED和「地图或铁路服务未能完成查询」，上游原因丢失。市内路线本来就没有调用铁路；原提示不能证明铁路导致地图失败。连接建立后缓存的客户端也没有在断连时失效，重试可能复用坏连接。
3. 在原浏览器草稿中实际核对到：飞猪酒店名「青枫—Z设计师青年旅舍(武林广场沈塘桥地铁站店)」与高德名称短横线不同，不能直接当作唯一同名分店。通过页面确认高德返回的莫干山路110号华龙商务大厦F9层后，原行程可实际生成。该人工确认边界保留。
4. 另以真实高德查询复现：已保存的酒店POI标识失效时，旧接口返回422 HOTEL_UNRESOLVED并终止整份规划。修复后按酒店名称重新核实；只在唯一精确匹配时继续，多分店仍交给用户确认。
5. 已核实当前Key存在，官方MCP连接、工具schema、酒店搜索、路径查询成功；前端经同源/api/travel代理，未发现本轮CORS或前后端连接错误。坐标经度在前、纬度在后，均为GCJ-02，发送精度限定六位。

**历史限制：截图中的那一次通用错误本轮未再次稳定触发，且旧代码没有保留原始上游错误。不能宣称它唯一由Key、额度、网络或铁路引起。上面第2项是已证实的诊断缺陷，第3/4项是实际复现的位置核实问题。**

## 修复结果

- 选项固定为不限品牌、华住会、希尔顿、万豪、洲际、凯悦、雅高、首旅。七组支持多选/取消、不限清空；函数式更新避免连续点击丢选择。旧移出范围的偏好保留并提示重选，不静默放宽。
- 移除品牌图片占位文案和供应方目录加载依赖；集团与已知子品牌共享匹配表。多选为并集，供应方关键词没有已知OR协议，因此不再把多个集团拼成一个关键词。仅过滤供应方本次返回候选，不承诺搜索覆盖所有库存。
- AMAP与RAIL错误独立；高德区分Key类型、权限/白名单、频率/额度、参数、POI、超时、JSON和HTTP错误。只输出固定安全文案与错误码，密钥和原始URL不进入页面。
- MCP连接/输出格式故障允许一次12秒上限的高德官方HTTP查询；Key/权限/额度错误不自动重试。失效客户端不继续缓存，主动取消不触发后备查询；实际来源正确标注。
- 每个活动日按酒店→已定景点顺序→酒店规划，空闲日不造路段；三种市内方式独立结算。失败路段保留真实点位与虚线示意，未知距离/耗时保持null；失败原因保留到路段，不能冒充导航或完整已核实行程。
- 最终备忘录显示酒店H、连续景点编号、分日草图和路线摘要。铁路错误不影响市内接口，酒店位置歧义不自动确认。

## 修改文件

| 范围 | 文件 |
| --- | --- |
| 品牌策略与筛选 | shared/hotel-brands.js、shared/hotel-brands.d.ts（新增）；src/planning/components/LocationPages.tsx；src/planning/services.ts；server/travel-api.js；server/flyai.js |
| 地图服务与显示 | server/amap-service.js（新增）；server/mcp.js；server/route-planning.js；server/app.js；src/planning/components/RouteMap.tsx |
| 自动化验证 | tests/v2.test.tsx；tests/server/amap-service.node.mjs、tests/server/brand-route.node.mjs、scripts/verify-brand-route-live.mjs（新增） |
| 规范与交付 | docs/FUNCTIONAL_REQUIREMENTS.md、FROZEN_RULES.md、STATE_AND_DATA_CONTRACT.md、USER_FLOWS.md、DECISION_LOG.md、CHANGELOG.md、ACCEPTANCE_MATRIX.md、KNOWN_GAPS.md及本报告 |

## 本轮验证

| 方式 | 结果 | 证据 |
| --- | --- | --- |
| 完整本地回归 | 类型检查、67前端+45服务端=112项测试、生产构建通过 | [最终日志](../artifacts/brand-route-verify-final.txt) |
| 真实服务 | 官方MCP工具参数和酒店/步行实查成功；真实12306超出售票期查询失败后，市内高德仍返回两天三景点五段路线，均酒店往返、保持顺序 | [真实服务记录](../artifacts/brand-route/live-verification.json) |
| 恢复验证 | 真实失效酒店POI恢复成功；显式模拟MCP断连后，真实高德HTTP返回有效距离与耗时 | 同上；断连为故障注入，不称为自然网络故障 |
| 错误回归 | Key/权限/额度、超时/非JSON/HTTP、取消、分店歧义、部分/全部路段失败、铁路HTTP失败隔离、空坐标拒绝 | 上述112项中的专项测试；错误场景为模拟 |
| 实际浏览器 | 原有4天2景点草稿重新规划成功，2个活动日4段，余下2天空闲；酒店+景点3点和78段轨迹元素；进入最终备忘录；桌面/390px无横向溢出；多品牌选择刷新保留；两页无控制台错误/警告 | [浏览器记录](../artifacts/brand-route/browser-verification.json)，截图留在本次聊天 |
| 运行 | 已重启并加载最终代码，稳定服务保留在127.0.0.1:5173；草稿与图片缓存保留 | 本轮启动和健康检查 |

手机为视口模拟，非真实设备验收。未外推所有城市/海外、极长行程、供应方自然额度耗尽、实时导航或所有库存覆盖。PDF独立包仍有既有体积提示，本次没有修改PDF。

## 核对依据

- [高德路径参数规范](https://developer.amap.com/api/webservice/guide/api/direction)：经度、纬度顺序和精度，服务端Web服务Key，状态与infocode。
- 集团匹配参考官方页面：[华住](https://ir.hworld.com/zh-hans)、[希尔顿](https://www.hilton.com/zh-hans/brands/)、[万豪](https://www.marriott.com.cn/brands.mi)、[洲际](https://www.ihg.com.cn/content/cn/zh/about/brands)、[凯悦](https://world.hyatt.com/content/gp/zh-hans/privacy/guest-policy.html)、[雅高](https://all.accor.com/a/zh/destination/city/hotels-beijing-v5004.html)、[首旅如家](https://www.bthhotels.com/About)。匹配表为本次已知名称集合，非完整品牌/运营权数据库。
