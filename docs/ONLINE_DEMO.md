# 出游plan · 在线交互 Demo

地址：[https://chuyou-plan-demo.fengmingfanxing.chatgpt.site](https://chuyou-plan-demo.fengmingfanxing.chatgpt.site)

团队：梧桐；主要提交人：fanxingfengming-pixel。

本演示明确使用模拟数据，不调用百炼、FlyAI 或高德实时服务。可体验输入需求、两条住宿分支、交通比较、酒店筛选与确认、景点搜索、逐日路线编辑、旅行备忘录、携带清单、本地草稿恢复及PDF导出。仅支持目录内示例城市和地点；无订单或支付。

建议输入：`2026年11月10日从长沙去北京玩3天，2成人`，选择「先找酒店」，不限品牌，选择模拟酒店，搜索「故宫」并加入行程，即可生成示例路线和备忘录。

## 本地构建

在项目目录运行 `node scripts/build-public-demo.mjs`，产物在 `work/online-demo/dist`。构建仅通过当前进程设置模拟模式，不改写 `.env.local` 或本机真实服务产物。预览：`node node_modules/vite/bin/vite.js preview --outDir work/online-demo/dist --host 127.0.0.1 --port 4178 --strictPort`。

## 本轮验证（2026-10-18）

类型检查、生产演示构建、97项前端与58项服务端测试通过。浏览器从输入需求走到旅行备忘录，刷新后保留酒店与路线，实际下载PDF（约6.46MB）。390px视口检查未发现横向溢出。在线首页、独立路由 `/plan/details`、模拟目录和演示标识文件匿名HTTPS均返回200，站点公开访问。

范围：以上流程为模拟数据验收，不作为线上实时百炼或供应方调用证据。真实手机触控、微信内置浏览器、海外网络和长期可用性未在本轮验证。服务不依赖本机开机；平台服务和网络仍可能影响访问。
