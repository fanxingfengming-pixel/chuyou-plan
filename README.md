> **梧桐团队参赛作品** · 主要提交人 [@fanxingfengming-pixel](https://github.com/fanxingfengming-pixel)
>
> 出游plan 将一句旅行想法转化为可选择、可修改的旅行规划，结合百炼 Managed Agent、FlyAI 和高德查询，最终生成旅行备忘录与 PDF。
>
> [公开仓库体验与复现](docs/PUBLIC_GUIDE.md) · [参赛介绍](docs/COMPETITION.md)
>
> 当前仅本地体验，尚未部署公开在线 Demo；下方 127.0.0.1 是本机入口。公开仓库不包含私密配置、本地数据库和内部历史资料。
# 出游plan · 旅行规划产品 V2

项目：D:/aaa飞猪。保留中文品牌、Hero结构与GSAP开场，采用A「奶油旅行手账」暖色视觉；通过独立 URL 完成旅行规划，共享本地 tripDraft。

**开发唯一基准：[docs/README.md](docs/README.md)。开发前先读 [AGENTS.md](AGENTS.md)。**
规范与历史验收分开；本次运行修复见[本机稳定运行记录](docs/v2/LOCAL-STABILITY.md)。

## 日常使用

双击项目中的 **启动出游plan.cmd**，等待构建与启动完成，然后打开 http://127.0.0.1:5173/ 。同一 Node 服务提供网页与查询接口，后台独立于 Codex 对话。停止时双击 **停止出游plan.cmd**。不设置开机自启，不结束其他项目进程。

所有命令在项目目录执行：

```powershell
Set-Location -LiteralPath 'D:\aaa飞猪'
Get-Location
npm.cmd run build
npm.cmd run start
npm.cmd run status
npm.cmd run stop
```

源码变更后先 build；start 使用已有构建。端口占用明确报错，不换端口。日志和运行状态保存在 data/runtime/，草稿仍在当前浏览器 LocalStorage。

## 开发与构建检查

首次安装依赖：npm.cmd install --cache 'D:\aaa飞猪\.npm-cache'。开发使用 npm.cmd run dev，同时启动网页 5173 与 API 3001；请先停止稳定模式，避免占用同一端口。生成的 PDF、截图及图片缓存排除源码监听。

npm.cmd run preview 仅用于构建检查，地址 4173，真实查询还需现有 API。它不是日常稳定运行入口。不同端口和不同浏览器的草稿互不自动同步。

## 数据与验证

- 私密服务端配置在 .env.server；.env.local 仅放公开配置，禁止将凭据放进 VITE_ 变量。
- 当前接入百炼 Managed Agent、高德 MCP、12306 MCP 与 FlyAI 官方 CLI；健康状态只证明本地服务，不证明供应方在线。
- D-12已删除距地铁筛选，旧草稿自动移除该已删除条件。数字星级、评论数量、设施筛选仍显示“暂不支持”，其旧值仍需用户主动清除；单家未知资料保持待核实。
- 酒店为供应方每晚起价，房型、床位、人数适用性与最终金额在飞猪核对。推荐只依据本次候选可核实字段。
- 离线演示需显式设置 VITE_TRAVEL_DATA_MODE=mock 并重启 / 重建；真实失败不静默改为模拟数据。
- npm.cmd run verify 执行类型检查、前端/服务端回归与构建。本轮 49 + 27 = 76 项通过；真实与模拟验收分别见[验收矩阵](docs/ACCEPTANCE_MATRIX.md)。
- 本轮用户手动确认夸克首页可打开；Chrome/Edge 完整流程仍未验收。具体证据和限制见[修复记录](docs/v2/LOCAL-STABILITY.md)。

草稿自动恢复，仅作用于同浏览器同来源；首页二次确认后全部重置。没有账号、云端中心、订单或支付。完成路线后可导出 PDF。


## 2026-10-17 · 暖色与素材库

五城共30地点与实图收录清单见[PLACE_CATALOG](docs/PLACE_CATALOG.md)。已收录目的地优先本地读取，未知地点首次核实后保存；酒店和交通继续沿用现有服务模式。清单、核心移除决定和备注保存在当前浏览器，PDF包含清单。完整本轮交付与验证见[WARM_V3](docs/WARM_V3_DELIVERY.md)。
