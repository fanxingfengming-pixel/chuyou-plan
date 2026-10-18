## 参赛项目名称

**出游plan｜从一句旅行想法，到一份可执行的旅行备忘录**

## 团队 / 作者与奖品领取人

- 团队名称：梧桐
- 主要提交人 GitHub ID（仅 1 位，必填）：fanxingfengming-pixel

## 旅行场景与目标用户

出游plan 面向自行安排旅行、希望减少攻略整理和多平台切换的中文用户，覆盖出发前的交通比较、住宿选择、景点筛选和逐日行程规划。

用户往往已经有了旅行想法，却还需要分别查询交通、筛选酒店、核对地点，再把零散信息整理成行程。出游plan 将这些选择串成连续的规划流程，让用户逐步作出决定，并随时返回修改。

## 我做了什么

我开发了一款结合阿里云百炼、FlyAI 与地图服务的旅行规划 Web 应用，将自然语言需求转化为可选择、可修改、可保存的旅行计划。

核心功能包括：

- **一句话开始规划**：解析出发地、目的地、日期、天数和同行人数，展示结果供用户核对与补全；模糊日期保留原意。
- **两种住宿规划路径**：支持“先选区域”和“先找酒店”，分别从想去的地点或酒店品牌偏好出发。
- **交通与酒店辅助决策**：比较查询到的铁路、航班信息，支持酒店条件筛选、六槽候选展示、指定酒店名称搜索和多家对比。
- **可编辑的逐日路线**：搜索景点、按需获取推荐，支持移动、跨天、添加、删除和替换；编辑后重新计算路段，保留用户安排的顺序。
- **旅行备忘录与 PDF**：汇总住宿、每日路线、交通、重要地点和携带清单，支持返回编辑、PDF 导出和本地草稿恢复。

作品的特色是将 AI 建议、外部查询结果和用户确认分开处理：百炼负责理解与推荐，外部服务提供可核实的数据，用户保留最终决定。

推荐景点需要用户选择后才加入行程，酒店外链不代表已经预订；未知资料保留“待核实”，查询失败明确提示。界面采用暖色旅行手账风格，用分步骤流程组织信息，适配桌面和窄屏浏览器。

## 百炼使用说明（必填）

**原项目的真实服务模式在运行时调用阿里云百炼。** 为便于直接体验，公开在线 Demo 独立使用模拟数据，页面明确标注，不消耗真实服务额度。

- **百炼能力 / 模型：** 阿里云百炼 Managed Agent，用于自然语言理解、结构化信息抽取和辅助推荐。
- **调用方式：** Node.js 服务端通过百炼 Managed Agent HTTP API 调用，创建 Session、先订阅 SSE 再提交任务，确认本轮完成后读取并校验 JSON 结果。
- **使用环节与输入输出：**
  - 旅行描述 → 城市、日期类型、天数、成人及儿童人数等结构化字段。
  - 实际交通查询摘要与用户偏好 → 交通比较建议。
  - 目的地、酒店和已选景点 → 候选景点名称，再经高德核实。
  - 真实酒店候选与筛选偏好 → 候选集合内的推荐酒店 ID。
  - 无结果查询条件 → 调整建议，由用户主动选择是否修改。
- **Skill 名称（如有）：** FlyAI，配套酒店和航班查询；服务端通过官方 CLI 调用。
- **其他工具 / 技术栈：** React、TypeScript、Vite、GSAP、Node.js、高德 MCP、第三方开源 12306 MCP、FlyAI CLI、SQLite 地点资料库、LocalStorage、pdf-lib。

真实服务模式中的路线距离与耗时来自高德查询。密钥和其他敏感配置保存在服务端，不进入前端或公开仓库。

## 效果展示

**项目演示视频**

[观看 / 下载演示视频（约 3 分 53 秒）](https://github.com/fanxingfengming-pixel/chuyou-plan/raw/refs/heads/main/docs/media/demo.mp4)

视频展示旅行信息填写、住宿筛选、景点选择、逐日路线及旅行备忘录的操作流程。

**百炼 Managed Agent 会话记录**

![百炼 Managed Agent 会话列表](https://raw.githubusercontent.com/fanxingfengming-pixel/chuyou-plan/main/docs/screenshots/bailian-sessions.png)

**百炼结构化任务与交通比较结果**

![百炼结构化任务输入与交通比较摘要](https://raw.githubusercontent.com/fanxingfengming-pixel/chuyou-plan/main/docs/screenshots/bailian-transport-summary.png)

截图展示服务端提交的结构化任务和 Agent 返回的交通比较摘要；其中时长与价格对应当时的查询输入。

**酒店候选与独立名称搜索**

![酒店候选与独立名称搜索](https://raw.githubusercontent.com/fanxingfengming-pixel/chuyou-plan/main/docs/screenshots/hotels.png)

**旅行备忘录与路线草图**

![旅行备忘录与路线草图](https://raw.githubusercontent.com/fanxingfengming-pixel/chuyou-plan/main/docs/screenshots/travel-memo.png)

以上为本地联调的实际运行截图。部分前置信息由测试草稿提供，后续酒店名称查询、地点定位与路线按联调记录调用真实接口。截图价格只对应当时查询；公开在线 Demo 使用独立的模拟数据。

## 项目链接与复现方式

- **在线 Demo：** [打开出游plan交互演示](https://chuyou-plan-demo.fengmingfanxing.chatgpt.site)
- **GitHub 仓库：** [fanxingfengming-pixel/chuyou-plan](https://github.com/fanxingfengming-pixel/chuyou-plan)
- **复现指南：** [配置与运行说明](https://github.com/fanxingfengming-pixel/chuyou-plan/blob/main/docs/PUBLIC_GUIDE.md)

**在线体验：** 无需配置密钥。输入“2026年11月10日从长沙去北京玩3天，2成人”，依次完成住宿方式、交通、酒店和景点选择，生成路线后查看旅行备忘录并导出 PDF。演示仅支持目录内的示例城市和地点，价格、耗时与路线均不可用于实际出行。

**真实服务复现：** 安装项目依赖，按仓库 `.env.example` 在本地配置自己的百炼 Workspace、Agent、Environment，以及高德和 FlyAI 服务，再构建并启动。云端 Agent 和服务凭据需自行配置，仓库不包含密钥。

酒店确认属于行程规划选择，实际房型、人数适用性、库存和最终金额需在飞猪核对；订单与支付由供应方平台完成。

> **奖品说明：**每个团队最多发放 1 份奖品。同一团队即使提交多个参赛作品，也只登记 1 位奖品领取人；其他团队成员可以共同署名，但不重复发放奖品。
