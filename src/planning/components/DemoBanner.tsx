import "./DemoBanner.css";

export function DemoBanner() {
  if (import.meta.env.VITE_PUBLIC_DEMO !== "true") return null;
  return (
    <aside className="public-demo-banner" aria-label="演示数据说明">
      <strong>交互演示版</strong>
      <span>使用模拟数据 · 不调用百炼、FlyAI 或高德实时服务</span>
      <small>可体验北京、杭州、上海、东京等示例城市；价格与路线不可用于实际出行。</small>
    </aside>
  );
}