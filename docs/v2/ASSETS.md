> 文档层级：历史技术 / 验收证据。现行唯一开发基准见 [docs 总入口](../README.md)，冻结规则见 [FROZEN_RULES](../FROZEN_RULES.md)。本文件保留原日期、实现描述和验证范围；其中“当前”指记录时点，不表示本轮复测，也不能覆盖现行需求。

# V2 图片策略

保留原 Hero、视觉体系和历史素材来源记录。真实地点使用高德对应 POI 返回的图片；真实酒店使用 FlyAI 返回的 mainPic。卡片标注“高德地点图片”或“飞猪供应方图片”，不把它们称为已经取得授权的官网宣传素材。品牌暂无素材时使用通用风景示意图。

## 自动获取与复用

图片由服务端直接获取与转换，不经过百炼 Agent，不做视觉识别。因此图片这一步新增模型 token 为 0；需求解析、推荐等其他 Agent 调用仍正常计费，高德或供应方的接口额度另计。

以高德 POI ID / FlyAI 酒店 ID 为键，首次成功的图片保存到 data/image-cache/，之后相同地点与酒店沿用原图，服务重启后仍可恢复。浏览器只接收本站图片 URL，不接收 Key 或缓存索引中的上游地址。

没有图片时使用 public/images/fallback-landscape.webp，明确标注“通用风景示意图 · 非实景”。确认无图的结果也缓存，避免反复查询；临时网络错误不会永久记为无图，后续可以重试。

## 通用图来源

作者：Dmytro Yarish / Unsplash。

照片页面：https://unsplash.com/photos/misty-mountains-reflected-in-a-calm-lake-LyudO7gnERc

许可：https://unsplash.com/license 。2026-10-16 核对许可页面，允许免费商用与修改。该照片只作通用示意，不能当作西湖、杭州或任何指定酒店实拍。来源记录见 ASSETS.json 和 public/images/fallback-landscape.webp.json。

## 边界

本轮没有逐个搜索所有机构官网，也没有完成全部供应方图片的独立授权审计。现有实现从已接入的高德 / FlyAI 取得对应图片；后续若有经确认可用的官网素材，可通过 image / imageSource 替换并登记来源。

图片缓存和验证记录见 [IMAGES.md](IMAGES.md)。
