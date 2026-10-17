> 文档层级：历史技术 / 验收证据。现行唯一开发基准见 [docs 总入口](../README.md)，冻结规则见 [FROZEN_RULES](../FROZEN_RULES.md)。本文件保留原日期、实现描述和验证范围；其中“当前”指记录时点，不表示本轮复测，也不能覆盖现行需求。

# FlyAI Windows 退出异常修复

日期：2026-10-16（Asia/Shanghai）。项目：D:\aaa飞猪。

## 结论

本机 FlyAI 查询已改为独立使用 Node 24.20.0；连续三轮酒店与航班查询，以及服务重启后的真实网页代理查询均正常退出。本轮没有修改系统默认 Node、主服务运行版本、百炼 Agent 模型或 MCP 配置。

此前 Node 24.19.0 查询成功后出现退出码 3221226505，stderr 为 UV_HANDLE_CLOSING 断言。它属于 Windows 上退出阶段异步句柄关闭的已知问题类型，参考 [Node 官方问题记录](https://github.com/nodejs/node/issues/56645)。本机版本对照支持通过更换 FlyAI 子进程运行版本解决当前触发场景；没有进行底层崩溃堆栈分析，也不将有限次数验证等同于所有未来环境均无问题。

## 实际修改

- 新增 server/flyai-runtime.js：读取服务端 FLYAI_NODE_PATH、FLYAI_NODE_VERSION，启动前检查文件存在和实际版本。配置错误直接报错，不退回旧版本。
- server/flyai.js：通过独立运行环境启动官方 CLI，保留超时和 JSON/供应方状态校验。非零退出或退出断言明确失败，不再接受“完整成功 JSON + 异常退出”作为成功。
- server/app.js：健康接口增加运行版本、查询次数和异常进程次数，绝不公开本机可执行文件路径或 Key。
- .env.server：仅新增 FlyAI 专用 Node 路径和固定版本；原凭据保持私密。模板 .env.example 增加无私密值的说明。
- scripts/probe-flyai.mjs：改用同一服务调用方式，避免诊断脚本继续启动旧运行环境。
- 新增 scripts/verify-flyai-runtime.mjs、scripts/verify-flyai-http.mjs 和 4 项运行环境回归测试。

本机指定 Node executable 是既有安装，没有安装新软件。未来若这个安装被移动、卸载或自动升级，版本校验会明确拒绝查询；重新选择已验证的 Node 路径/版本并重启服务后再验收。

## 真实验收

相同项目主进程仍运行 Node 24.19.0，FlyAI 子进程独立运行 v24.20.0。

| 轮次 | 酒店原始条目 | 航班条目 | 退出码 | stderr 断言 |
| --- | --- | --- | --- | --- |
| 1 | 11 | 10 | 两次均为 0 | 无 |
| 2 | 11 | 10 | 两次均为 0 | 无 |
| 3 | 11 | 10 | 两次均为 0 | 无 |

重启 npm run dev 后，经 http://127.0.0.1:5173/api/travel 查询：

- POST /flight/search：HTTP 200，source=live、available=true。
- POST /flyai/search-hotels：HTTP 200，8 家候选均为 live，均有飞猪直链。
- 健康接口：runtimeVersion=v24.20.0、queryCount=2、failedProcessCount=0、cliExitWarning=false。

原始条目数与酒店最终候选数可能不同，后者还经过规范化、过夜酒店排除规则和条件筛选；实时供应方候选数量也可能变化。

npm run verify 通过：34 项前端测试 + 12 项服务端测试，共 46 项，包含异常退出拒绝、环境缺失/版本不匹配拒绝、完整 JSON 与业务状态检查；正式构建通过。密钥扫描未发现已配置 Key 出现在源码、构建、文档或联调产物中。

## 证据与复测

证据：

- artifacts/integration/flyai-runtime-verification.json
- artifacts/integration/flyai-runtime-http.json
- artifacts/integration/flyai-fix-build-tests.txt
- artifacts/integration/secret-scan.json

复测命令，均在 D:\aaa飞猪 执行：

    npm run verify
    npm run verify:flyai
    node scripts/verify-flyai-http.mjs

verify:flyai 会调用真实供应方三轮酒店与航班，可能消耗查询额度。HTTP 复测需要本地服务运行。普通 verify 仅做本地回归与构建，不调用真实旅行供应方。

当前预览仍是 http://127.0.0.1:5173/ 。酒店字段不完整等业务数据缺口仍按 INTEGRATION.md 的说明处理，本次只解决退出异常。
