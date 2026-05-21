import { useState, useCallback, useRef, useMemo } from "react";
import ProjectDetail from "./ProjectDetail";
import TaskPage from "./TaskPage";

type Nav =
  | { view: "board" }
  | { view: "project"; id: string }
  | { view: "task"; projectId: string; taskId: string };

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
  archived?: boolean;
  createdAt?: string;
  notes?: string;
}

export interface KanbanData {
  projects: Project[];
}

function uid() { return Math.random().toString(36).slice(2, 10); }

export function ensureKanbanData(raw: unknown): KanbanData {
  if (raw && typeof raw === "object") {
    const r = raw as Record<string, unknown>;

    // Current format
    if (Array.isArray(r["projects"])) return raw as KanbanData;

    // v2 store wrapper
    if (r["version"] === 2 && r["kanban"]) return ensureKanbanData(r["kanban"]);

    // v2 inner: tasks[] + tags[] → group by tag → one project per tag
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

    // v1 memos format
    if (Array.isArray(r["memos"])) {
      const memos = r["memos"] as Array<{ kanban?: unknown }>;
      for (const m of memos) if (m.kanban) return ensureKanbanData(m.kanban);
    }
  }
  return { projects: [] };
}

const SECTIONS: Array<{ status: ProjectStatus; label: string }> = [
  { status: "doing",   label: "Doing" },
  { status: "waiting", label: "Waiting" },
  { status: "todo",    label: "Todo" },
  { status: "done",    label: "Done" },
];

interface Props {
  kanban: KanbanData;
  onChange: (data: KanbanData) => void;
}

interface DragState { projectId: string; fromStatus: ProjectStatus }

export default function KanbanPane({ kanban: rawKanban, onChange }: Props) {
  const kanban = useMemo(() => ensureKanbanData(rawKanban as unknown), [rawKanban]);

  const [captureText, setCaptureText] = useState("");
  const [nav, setNav] = useState<Nav>({ view: "board" });
  const [collapsed, setCollapsed] = useState<Record<ProjectStatus, boolean>>(
    { doing: false, waiting: false, todo: false, done: true },
  );
  const [showArchived, setShowArchived] = useState(false);
  const [draggingProjectId, setDraggingProjectId] = useState<string | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<ProjectStatus | null>(null);

  const dragState = useRef<DragState | null>(null);
  const sectionEls = useRef<Map<ProjectStatus, HTMLElement>>(new Map());

  const update = useCallback((id: string, patch: Partial<Project>) => {
    onChange({ projects: kanban.projects.map((p) => p.id === id ? { ...p, ...patch } : p) });
  }, [kanban, onChange]);

  const updateTask = useCallback((projectId: string, taskId: string, patch: Partial<ProjectTask>) => {
    onChange({
      projects: kanban.projects.map((p) =>
        p.id === projectId
          ? { ...p, tasks: p.tasks.map((t) => t.id === taskId ? { ...t, ...patch } : t) }
          : p
      ),
    });
  }, [kanban, onChange]);

  const remove = useCallback((id: string) => {
    onChange({ projects: kanban.projects.filter((p) => p.id !== id) });
  }, [kanban, onChange]);

  const addProject = useCallback((name: string, status: ProjectStatus) => {
    const p: Project = { id: uid(), name, status, tasks: [], createdAt: new Date().toISOString() };
    onChange({ projects: [...kanban.projects, p] });
    setNav({ view: "project", id: p.id });
  }, [kanban, onChange]);

  const calcOverStatus = useCallback((y: number): ProjectStatus | null => {
    for (const { status } of SECTIONS) {
      const el = sectionEls.current.get(status);
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (y >= r.top && y <= r.bottom) return status;
    }
    return null;
  }, []);

  const handleDragStart = useCallback((e: React.PointerEvent, projectId: string, fromStatus: ProjectStatus) => {
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragState.current = { projectId, fromStatus };
    setDraggingProjectId(projectId);
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragState.current) return;
    setDragOverStatus(calcOverStatus(e.clientY));
  }, [calcOverStatus]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    const ds = dragState.current;
    if (!ds) return;
    dragState.current = null;
    const target = calcOverStatus(e.clientY);
    if (target && target !== ds.fromStatus) update(ds.projectId, { status: target });
    setDraggingProjectId(null);
    setDragOverStatus(null);
  }, [calcOverStatus, update]);

  // Navigation rendering
  if (nav.view === "task") {
    const proj = kanban.projects.find((p) => p.id === nav.projectId);
    const task = proj?.tasks.find((t) => t.id === nav.taskId);
    if (proj && task) {
      return (
        <TaskPage
          task={task}
          projectName={proj.name}
          onBack={() => setNav({ view: "project", id: nav.projectId })}
          onUpdate={(patch) => updateTask(nav.projectId, nav.taskId, patch)}
        />
      );
    }
  }

  if (nav.view === "project") {
    const proj = kanban.projects.find((p) => p.id === nav.id);
    if (proj) {
      return (
        <ProjectDetail
          project={proj}
          onBack={() => setNav({ view: "board" })}
          onOpenTask={(taskId) => setNav({ view: "task", projectId: nav.id, taskId })}
          onUpdate={(patch) => update(nav.id, patch)}
          onArchive={() => { update(nav.id, { archived: true }); setNav({ view: "board" }); }}
        />
      );
    }
  }

  const archivedProjects = kanban.projects.filter((p) => p.archived);

  return (
    <div
      className={`kanban-board${draggingProjectId ? " kanban-board-dragging" : ""}`}
      onPointerMove={draggingProjectId ? handlePointerMove : undefined}
      onPointerUp={draggingProjectId ? handlePointerUp : undefined}
    >
      {/* Quick capture */}
      <div className="kanban-capture">
        <input
          className="kanban-capture-input"
          placeholder="案件を追加... (Enter で Todo へ)"
          value={captureText}
          onChange={(e) => setCaptureText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              const name = captureText.trim();
              if (name) { addProject(name, "todo"); setCaptureText(""); }
            }
            if (e.key === "Escape") setCaptureText("");
          }}
        />
      </div>

      {SECTIONS.map(({ status, label }) => {
        const projects = kanban.projects.filter((p) => p.status === status && !p.archived);
        const isOver = dragOverStatus === status;
        const isCollapsed = collapsed[status];

        return (
          <div
            key={status}
            ref={(el) => { if (el) sectionEls.current.set(status, el); else sectionEls.current.delete(status); }}
            className={`kanban-status-section${isOver ? " kanban-section-drop-target" : ""}`}
          >
            <div
              className="kanban-section-header"
              onClick={() => setCollapsed((c) => ({ ...c, [status]: !c[status] }))}
            >
              <span className="kanban-section-chevron">{isCollapsed ? "▸" : "▾"}</span>
              <span className={`kanban-status-label kanban-status-${status}`}>{label}</span>
              <span className="kanban-section-count">{projects.length}</span>
              <button
                className="kanban-section-add-task"
                onClick={(e) => { e.stopPropagation(); addProject("新規案件", status); }}
              >+</button>
            </div>

            {!isCollapsed && (
              <div className="kanban-section-body">
                {projects.map((project) => {
                  const doneCnt = project.tasks.filter((t) => t.done).length;
                  const totalCnt = project.tasks.length;
                  const isDragging = draggingProjectId === project.id;

                  return (
                    <div
                      key={project.id}
                      className={`project-card${isDragging ? " project-card-dragging" : ""}`}
                      onClick={() => { if (!isDragging) setNav({ view: "project", id: project.id }); }}
                    >
                      <span className="project-card-name">{project.name}</span>
                      {totalCnt > 0 && (
                        <span className="project-card-meta">{doneCnt}/{totalCnt}完了</span>
                      )}
                      <span
                        className="project-card-drag"
                        onPointerDown={(e) => { e.stopPropagation(); handleDragStart(e, project.id, status); }}
                      >⠿</span>
                      <button
                        className="project-card-delete"
                        onClick={(e) => { e.stopPropagation(); remove(project.id); }}
                      >×</button>
                    </div>
                  );
                })}

                {projects.length === 0 && (
                  <div className="kanban-section-empty">案件なし</div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {archivedProjects.length > 0 && (
        <div className="kanban-archived-section">
          <div className="kanban-archived-toggle" onClick={() => setShowArchived((v) => !v)}>
            {showArchived ? "▾" : "▸"} アーカイブ済み ({archivedProjects.length})
          </div>
          {showArchived && archivedProjects.map((project) => (
            <div key={project.id} className="project-card project-card-archived">
              <span className="project-card-name">{project.name}</span>
              <button
                className="project-card-restore"
                onClick={() => update(project.id, { archived: false, status: "todo" })}
                title="復元"
              >↩</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
