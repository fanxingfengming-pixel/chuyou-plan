import { useEffect, useRef, useState, type FormEvent } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useTripDraft } from "../TripDraftProvider";
import { reconcilePacking } from "../packing";
export function PackingList() {
  const { draft, patch } = useTripDraft(),
    [name, setName] = useState(""),
    [message, setMessage] = useState("");
  const previousNames = useRef(new Map<string, string>());
  const signature = JSON.stringify([
    draft.destinationCity,
    draft.tripDays,
    draft.children,
    draft.selectedTransportMode,
    draft.suppressedPackingIds,
  ]);
  useEffect(() => {
    patch((previous) => {
      const items = reconcilePacking(previous);
      return JSON.stringify(items) === JSON.stringify(previous.packingItems)
        ? {}
        : { packingItems: items };
    });
  }, [signature, patch]);
  const edit = (
    id: string,
    change: Partial<(typeof draft.packingItems)[number]>,
  ) =>
    patch((previous) => ({
      packingItems: previous.packingItems.map((p) =>
        p.id === id
          ? {
              ...p,
              ...change,
              customized:
                change.name !== undefined || change.note !== undefined
                  ? true
                  : p.customized,
            }
          : p,
      ),
    }));
  const add = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setMessage("请填写物品名称。");
      return;
    }
    if (draft.packingItems.length >= 300) {
      setMessage("清单已达到300项，请先整理现有物品。");
      return;
    }
    patch((previous) => ({
      packingItems: [
        ...previous.packingItems,
        {
          id: "custom-" + crypto.randomUUID(),
          name: name.trim(),
          note: "",
          packed: false,
          origin: "custom",
        },
      ],
    }));
    setName("");
    setMessage("物品已加入，自动保存到本机草稿。");
  };
  return (
    <section className="packing-list" aria-labelledby="packing-title">
      <header>
        <h2 id="packing-title">出发前，带上这些。</h2>
        <span>
          {draft.packingItems.filter((p) => p.packed).length} /{" "}
          {draft.packingItems.length} 已备好
        </span>
      </header>
      <p className="quiet-copy">
        根据天数、同行人数与交通方式提供基础建议，按你的需要增减。未接入实时天气。
        点击物品名称或备注即可编辑，修改会自动保存。
      </p>
      <div className="packing-items">
        {draft.packingItems.map((item) => (
          <div
            key={item.id}
            className={"packing-item " + (item.packed ? "packed" : "")}
          >
            <label className="packing-check">
              <input
                type="checkbox"
                checked={item.packed}
                onChange={(e) => edit(item.id, { packed: e.target.checked })}
                aria-label={"已备好" + item.name}
              />
            </label>
            <div>
              <label>
                <span className="sr-only">物品名称</span>
                <input
                  aria-label={"物品名称 " + item.name}
                  value={item.name}
                  maxLength={80}
                  onChange={(e) => {
                    if (item.name.trim())
                      previousNames.current.set(item.id, item.name);
                    edit(item.id, { name: e.target.value });
                  }}
                  onBlur={() => {
                    if (!item.name.trim()) {
                      edit(item.id, {
                        name:
                          previousNames.current.get(item.id) || "未命名物品",
                      });
                      setMessage("物品名称不能为空，已恢复名称，请重新编辑。");
                    }
                  }}
                />
              </label>
              <label>
                <span className="sr-only">物品备注</span>
                <input
                  aria-label={item.name + "备注"}
                  placeholder="添加备注，如数量、放在哪个包里…"
                  value={item.note}
                  maxLength={300}
                  onChange={(e) => edit(item.id, { note: e.target.value })}
                />
              </label>
            </div>
            <button
              type="button"
              className="icon-button"
              aria-label={"删除物品" + item.name}
              onClick={() => {
                patch((previous) => ({
                  packingItems: previous.packingItems.filter(
                    (p) => p.id !== item.id,
                  ),
                  suppressedPackingIds:
                    item.origin === "suggested"
                      ? [
                          ...new Set([
                            ...previous.suppressedPackingIds,
                            item.id,
                          ]),
                        ]
                      : previous.suppressedPackingIds,
                }));
                setMessage("已移除" + item.name + "。");
              }}
            >
              <Trash2 size={17} />
            </button>
          </div>
        ))}
      </div>
      <form onSubmit={add} className="packing-add">
        <label>
          <span className="sr-only">新增物品</span>
          <input
            aria-label="新增物品"
            placeholder="还有什么要带？"
            value={name}
            maxLength={80}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <button className="secondary-button">
          <Plus size={17} />
          添加物品
        </button>
      </form>
      {message && (
        <p role="status" className="quiet-copy">
          {message}
        </p>
      )}
    </section>
  );
}
