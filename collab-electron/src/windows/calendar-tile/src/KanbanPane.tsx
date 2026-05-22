import { useState, useCallback, useMemo, useEffect } from "react";
import { type ProjectStatus, type ProjectTask, type Project, type KanbanData, uid, ensureKanbanData, SECTIONS, STATUS_ORDER, STATUS_LABELS } from "./kanbanTypes";
import { useKanbanDrag } from "./useKanbanDrag";
import ProjectDetail from "./ProjectDetail";
import TaskPage from "./TaskPage";
import { formatDueDate } from "./dateUtils";

// Re-export for backward compat (MemoPane / ProjectDetail / TaskPage import from here)
export type { ProjectStatus, ProjectTask, Project, KanbanData };
export { ensureKanbanData };

function useFocusOnCreate(dataAttr: string) {
  const [focusId, setFocusId] = useState<string | null>(null);
  useEffect(() => {
    if (!focusId) return;
    const el = document.querySelector(`[${dataAttr}="${focusId}"]`) as HTMLElement | null;
    if (el) {
      el.focus();
      const range = document.createRange();
      range.selectNodeContents(el);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
      setFocusId(null);
    }
  }, [focusId, dataAttr]);
  return setFocusId;
}

type Nav =
  | { view: "board" }
  | { view: "project"; id: string }
  | { view: "task"; projectId: string; taskId: string };

interface Props {
  kanban: KanbanData;
  onChange: (data: KanbanData) => void;
}

export default function KanbanPane({ kanban: rawKanban, onChange }: Props) {
  const kanban = useMemo(() => ensureKanbanData(rawKanban as unknown), [rawKanban]);

  const [nav, setNav] = useState<Nav>({ view: "board" });
  const [collapsed, setCollapsed] = useState<Record<ProjectStatus, boolean>>(
    { doing: false, waiting: false, todo: false, done: true },
  );
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());

  const drag = useKanbanDrag(kanban.projects, onChange);

  const setFocusProjectId = useFocusOnCreate("data-project-name-id");
  const setFocusTaskId = useFocusOnCreate("data-task-id");

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

  const toggleExpand = useCallback((id: string) => {
    setExpandedProjects((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const addProject = useCallback((status: ProjectStatus) => {
    const p: Project = { id: uid(), name: "新規案件", status, tasks: [], createdAt: new Date().toISOString() };
    onChange({ projects: [...kanban.projects, p] });
    setExpandedProjects((prev) => new Set([...prev, p.id]));
    setFocusProjectId(p.id);
  }, [kanban, onChange, setFocusProjectId]);

  const addTaskToProject = useCallback((projectId: string) => {
    const task: ProjectTask = { id: uid(), title: "新規タスク", done: false, createdAt: new Date().toISOString() };
    onChange({
      projects: kanban.projects.map((p) =>
        p.id === projectId ? { ...p, tasks: [...p.tasks, task] } : p
      ),
    });
    setFocusTaskId(task.id);
  }, [kanban, onChange, setFocusTaskId]);

  if (nav.view === "task") {
    const proj = kanban.projects.find((p) => p.id === nav.projectId);
    const task = proj?.tasks.find((t) => t.id === nav.taskId);
    if (proj && task) {
      return (
        <TaskPage
          task={task}
          projectName={proj.name}
          onBack={() => setNav({ view: "board" })}
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
          onArchive={() => { update(nav.id, { status: "done" }); setNav({ view: "board" }); }}
        />
      );
    }
  }

  return (
    <div className={`kanban-board${drag.draggingProjectId ? " kanban-board-dragging" : ""}`}>
      {SECTIONS.map(({ status, label }) => {
        const projects = kanban.projects.filter((p) => p.status === status);
        const isOver = drag.dragOverStatus === status;
        const isCollapsed = collapsed[status];

        return (
          <div
            key={status}
            data-section={status}
            className={`kanban-status-section${isOver ? " kanban-section-drop-target" : ""}`}
          >
            <div
              className="kanban-section-header"
              data-section={status}
              onClick={() => setCollapsed((c) => ({ ...c, [status]: !c[status] }))}
            >
              <span className="kanban-section-chevron">{isCollapsed ? "▸" : "▾"}</span>
              <span className={`kanban-status-label kanban-status-${status}`}>{label}</span>
              <span className="kanban-section-count">{projects.length}</span>
              <button
                className="kanban-section-add-task"
                onClick={(e) => { e.stopPropagation(); addProject(status); }}
              >+</button>
            </div>

            {(!isCollapsed || drag.draggingProjectId) && (
              <div className="kanban-section-body" data-section={status}>
                {isCollapsed && drag.draggingProjectId && (
                  <div className="kanban-section-drop-zone" data-section={status} />
                )}
                {!isCollapsed && projects.flatMap((project) => {
                  const doneCnt = project.tasks.filter((t) => t.done).length;
                  const totalCnt = project.tasks.length;
                  const isDragging = drag.draggingProjectId === project.id;
                  const isExpanded = expandedProjects.has(project.id);
                  const activeTasks = project.tasks.filter((t) => !t.done);
                  const showLineBefore = drag.dropOverProjectId === project.id && drag.dropInsertBefore;
                  const showLineAfter  = drag.dropOverProjectId === project.id && !drag.dropInsertBefore;

                  return [
                    showLineBefore ? <div key={`dl-b-${project.id}`} className="kanban-drop-line" /> : null,
                    <div
                      key={project.id}
                      data-project-id={project.id}
                      className={`project-card-wrap${isDragging ? " project-card-dragging" : ""}`}
                    >
                      <div className="project-card" onClick={() => toggleExpand(project.id)}>
                        <span
                          className="project-card-drag"
                          onPointerDown={(e) => drag.onPointerDown(e, project.id)}
                          onPointerMove={drag.onPointerMove}
                          onPointerUp={drag.onPointerUp}
                          onPointerCancel={drag.onPointerCancel}
                          onClick={(e) => e.stopPropagation()}
                        >⠿</span>
                        <button
                          className="project-card-toggle"
                          onClick={(e) => { e.stopPropagation(); toggleExpand(project.id); }}
                        >{isExpanded ? "▾" : "▸"}</button>
                        <div
                          key={project.name}
                          className="project-card-name"
                          contentEditable
                          suppressContentEditableWarning
                          data-project-name-id={project.id}
                          onClick={(e) => e.stopPropagation()}
                          onBlur={(e) => {
                            const v = e.currentTarget.textContent?.trim() ?? "";
                            if (v && v !== project.name) update(project.id, { name: v });
                            else e.currentTarget.textContent = project.name;
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.nativeEvent.isComposing) { e.preventDefault(); e.currentTarget.blur(); }
                            if (e.key === "Escape") { e.currentTarget.textContent = project.name; e.currentTarget.blur(); }
                          }}
                        >{project.name}</div>
                        {totalCnt > 0 && (
                          <span className="project-card-meta">{doneCnt}/{totalCnt}完了</span>
                        )}
                        <select
                          className={`project-card-status-select project-status-${project.status}`}
                          value={project.status}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => { e.stopPropagation(); update(project.id, { status: e.target.value as ProjectStatus }); }}
                        >
                          {STATUS_ORDER.map((s) => (
                            <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                          ))}
                        </select>
                        <button
                          className="project-card-detail-btn"
                          onClick={(e) => { e.stopPropagation(); setNav({ view: "project", id: project.id }); }}
                          title="詳細ページを開く"
                        >…</button>
                        <button
                          className="project-card-delete"
                          onClick={(e) => { e.stopPropagation(); remove(project.id); }}
                        >×</button>
                      </div>

                      {isExpanded && (
                        <div className="project-card-tasks">
                          {activeTasks.map((task) => {
                            const due = formatDueDate(task.dueDate);
                            return (
                              <div key={task.id} className="project-card-task-row">
                                <button
                                  className="project-card-task-check"
                                  onClick={() => updateTask(project.id, task.id, { done: true })}
                                >□</button>
                                <div
                                  key={task.title}
                                  className="project-card-task-title"
                                  contentEditable
                                  suppressContentEditableWarning
                                  data-task-id={task.id}
                                  onBlur={(e) => {
                                    const v = e.currentTarget.textContent?.trim() ?? "";
                                    if (v && v !== task.title) updateTask(project.id, task.id, { title: v });
                                    else e.currentTarget.textContent = task.title;
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter" && !e.nativeEvent.isComposing) { e.preventDefault(); e.currentTarget.blur(); }
                                  }}
                                >{task.title}</div>
                                {due && <span className={`project-card-task-due ${due.cls}`}>{due.text}</span>}
                                <button
                                  className="project-card-task-detail"
                                  onClick={(e) => { e.stopPropagation(); setNav({ view: "task", projectId: project.id, taskId: task.id }); }}
                                >→</button>
                              </div>
                            );
                          })}
                          {activeTasks.length === 0 && doneCnt > 0 && (
                            <div className="project-card-task-empty">すべて完了済み</div>
                          )}
                          <button
                            className="project-card-add-task-btn"
                            onClick={() => addTaskToProject(project.id)}
                          >+ タスクを追加</button>
                        </div>
                      )}
                    </div>,
                    showLineAfter ? <div key={`dl-a-${project.id}`} className="kanban-drop-line" /> : null,
                  ];
                })}

                {!isCollapsed && projects.length === 0 && (
                  <div className="kanban-section-empty">案件なし</div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
