import { useState, useEffect, useCallback } from "react";
import KanbanPane, { type KanbanData, ensureKanbanData } from "./KanbanPane";

interface KanbanStore {
  version: 3;
  kanban: KanbanData;
}

export default function MemoPane() {
  const [kanban, setKanban] = useState<KanbanData | null>(null);

  useEffect(() => {
    window.api.memosLoad()
      .then((raw) => setKanban(ensureKanbanData(raw)))
      .catch(() => setKanban({ projects: [] }));
  }, []);

  const handleChange = useCallback((data: KanbanData) => {
    setKanban(data);
    const store: KanbanStore = { version: 3, kanban: data };
    window.api.memosSave(store).catch(() => {});
  }, []);

  if (!kanban) return <div className="memo-pane" />;

  return (
    <div className="memo-pane">
      <KanbanPane kanban={kanban} onChange={handleChange} />
    </div>
  );
}
