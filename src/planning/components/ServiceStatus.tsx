import { useServiceStatus } from "../serviceStatusContext";
export function ServiceStatus() {
  const { state, check } = useServiceStatus();
  return (
    <div
      className={"service-status service-status-" + state}
      role="status"
      aria-live="polite"
    >
      <span>
        {state === "online"
          ? "本地服务在线 · 外部查询以实际返回为准"
          : state === "offline"
            ? "本地服务暂不可用 · 你的草稿已保留"
            : state === "mock"
              ? "模拟查询数据 · 草稿仅保存在本机"
              : "正在确认本地查询服务…"}
      </span>
      {state === "offline" && (
        <button className="text-button" onClick={() => void check()}>
          重新检查服务
        </button>
      )}
    </div>
  );
}
