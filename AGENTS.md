# 出游plan 项目开发入口

项目目录：D:/aaa飞猪。适用范围：本目录及子目录。

## 开发前必读

1. [文档总入口](docs/README.md)：当前基准、文档权限与阅读顺序。
2. [冻结规则](docs/FROZEN_RULES.md)。
3. [功能需求](docs/FUNCTIONAL_REQUIREMENTS.md)和[用户流程](docs/USER_FLOWS.md)。
4. 按任务阅读[状态与数据](docs/STATE_AND_DATA_CONTRACT.md)、[架构](docs/PROJECT_ARCHITECTURE.md)、[开发标准](docs/PROJECT_STANDARDS.md)、[设计系统](docs/DESIGN_SYSTEM.md)。
5. 开工前检查[验收矩阵](docs/ACCEPTANCE_MATRIX.md)与[已知差异](docs/KNOWN_GAPS.md)。

## 工作约束

- 当前唯一项目基准是 docs/README.md 指定的 CP-V2-2026-10-17 文档体系。根目录 PRODUCT.md、DESIGN.md 仅为跳转入口；docs/v2、docs/archive 和 .impeccable 不是现行功能要求。
- 用户当前明确指令及更高优先级指令优先。用户明确更改冻结项时记录新决定；旧聊天、助手建议、现有代码、测试通过或历史截图不能自行覆盖冻结要求。
- 修改前说明受影响的 FR / FZ 编号。普通缺陷修复、文档维护和已授权开发无需重复请示；只有实质更改已冻结行为且本次未获授权时先确认具体取舍。
- 不得为了让实现显得完成而删减需求、放宽验收、把模拟数据改称实时数据，或用当前代码反向改写用户已确认的需求。
- 不重建项目、不恢复已删除的 V1 宣传页、不擅自更换 UI 体系、Agent、模型、云端提示词、工具包或环境。
- 所有项目命令在 D:/aaa飞猪 执行；初始化前检查当前位置。源码、依赖、缓存、数据、截图和产物留在本项目。不得在 C 盘创建项目副本。
- 不读取或输出无关私密配置；Key 仅在本地私密配置或服务端环境，禁止进入文档、前端、聊天、日志和提交。
- 不修改同步 sources/ 资料；不借文档任务修改产品代码、删除个人数据或初始化 Git。
- 交付说明变更、关联需求、实际检查及未验证范围；按开发标准更新验收矩阵和变更记录。
