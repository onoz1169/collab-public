export type ProjectStatus = "doing" | "waiting" | "todo" | "done";

export interface ProjectTask {
  id: string;
  title: string;
  done: boolean;
  dueDate?: string;
  notes?: string;
  createdAt?: string;
}

export interface Project {
  id: string;
  name: string;
  status: ProjectStatus;
  tasks: ProjectTask[];
  createdAt?: string;
  notes?: string;
}

export interface KanbanData {
  projects: Project[];
}

export function uid() { return Math.random().toString(36).slice(2, 10); }

export const SECTIONS: Array<{ status: ProjectStatus; label: string }> = [
  { status: "doing",   label: "Doing" },
  { status: "waiting", label: "Waiting" },
  { status: "todo",    label: "Todo" },
  { status: "done",    label: "Done" },
];

export const STATUS_ORDER: ProjectStatus[] = ["doing", "waiting", "todo", "done"];
export const STATUS_LABELS: Record<ProjectStatus, string> = { doing: "Doing", waiting: "Waiting", todo: "Todo", done: "Done" };

export function ensureKanbanData(raw: unknown): KanbanData {
  if (raw && typeof raw === "object") {
    const r = raw as Record<string, unknown>;

    if (Array.isArray(r["projects"])) {
      const projects = (r["projects"] as Array<Record<string, unknown>>).map((p) => {
        if (p["archived"]) { const { archived: _, ...rest } = p; return { ...rest, status: "done" }; }
        const { archived: _, ...rest } = p; return rest;
      });
      return { projects } as KanbanData;
    }

    if ((r["version"] === 2 || r["version"] === 3) && r["kanban"]) return ensureKanbanData(r["kanban"]);

    if (Array.isArray(r["tasks"])) {
      type OldTask = {
        id: string; title: string; tag?: string;
        dueDate?: string; notes?: string; archived?: boolean; createdAt?: string;
      };
      const tasks = r["tasks"] as OldTask[];
      const tags: string[] = Array.isArray(r["tags"]) ? (r["tags"] as string[]) : [];
      const allKeys = [...new Set([...tags, ...tasks.map((t) => t.tag ?? "")])];
      const byKey = new Map<string, ProjectTask[]>();
      for (const k of allKeys) byKey.set(k, []);
      for (const t of tasks) {
        const k = t.tag ?? "";
        byKey.get(k)!.push({
          id: t.id, title: t.title, done: t.archived ?? false,
          ...(t.dueDate ? { dueDate: t.dueDate } : {}),
          ...(t.notes ? { notes: t.notes } : {}),
          ...(t.createdAt ? { createdAt: t.createdAt } : {}),
        });
      }
      const projects: Project[] = [];
      for (const [key, ptasks] of byKey) {
        if (!key && ptasks.length === 0) continue;
        projects.push({ id: uid(), name: key || "その他", status: "todo", tasks: ptasks });
      }
      return { projects };
    }

    if (Array.isArray(r["memos"])) {
      const memos = r["memos"] as Array<{ kanban?: unknown }>;
      for (const m of memos) if (m.kanban) return ensureKanbanData(m.kanban);
    }
  }
  return { projects: [] };
}
