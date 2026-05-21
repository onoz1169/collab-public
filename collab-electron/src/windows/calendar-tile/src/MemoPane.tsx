import { useState, useEffect, useCallback } from "react";
import KanbanPane, { type KanbanData } from "./KanbanPane";

interface KanbanStore {
  version: 2;
  kanban: KanbanData;
}

function migrate(raw: unknown): KanbanData {
  if (raw && typeof raw === "object") {
    const r = raw as Record<string, unknown>;
    if (r["version"] === 2 && r["kanban"]) return r["kanban"] as KanbanData;
    if (r["version"] === 1 && Array.isArray(r["memos"])) {
      const memos = r["memos"] as Array<{ kanban?: KanbanData }>;
      for (const m of memos) {
        if (m.kanban) return m.kanban;
      }
    }
  }
  return { tasks: [], tags: [] };
}

export default function MemoPane() {
  const [kanban, setKanban] = useState<KanbanData | null>(null);

  useEffect(() => {
    window.api.memosLoad()
      .then((raw) => setKanban(migrate(raw)))
      .catch(() => setKanban({ tasks: [], tags: [] }));
  }, []);

  const handleChange = useCallback((data: KanbanData) => {
    setKanban(data);
    const store: KanbanStore = { version: 2, kanban: data };
    window.api.memosSave(store).catch(() => {});
  }, []);

  if (!kanban) return <div className="memo-pane" />;

  return (
    <div className="memo-pane">
      <KanbanPane kanban={kanban} onChange={handleChange} />
    </div>
  );
}
