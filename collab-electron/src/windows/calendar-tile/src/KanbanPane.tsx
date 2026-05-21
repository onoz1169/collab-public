import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import TaskDetail from "./TaskDetail";
import { formatDueDate } from "./dateUtils";

export type TaskStatus = "doing" | "waiting" | "todo";

export interface KanbanTask {
  id: string;
  title: string;
  status: TaskStatus;
  tag?: string;
  dueDate?: string;
  notes?: string;
  archived?: boolean;
  createdAt?: string;
}

export interface KanbanData {
  tasks: KanbanTask[];
  tags: string[];
}

interface Props {
  kanban: KanbanData;
  onChange: (data: KanbanData) => void;
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

// Migrate old section-based format to flat task list
function ensureNewFormat(raw: unknown): KanbanData {
  if (raw && typeof raw === "object") {
    const r = raw as Record<string, unknown>;
    if (Array.isArray(r["tasks"])) return raw as KanbanData;
    if (Array.isArray(r["sections"])) {
      const sections = r["sections"] as Array<{
        name?: string;
        tasks?: Array<{
          id: string; title: string; status?: string;
          dueDate?: string; notes?: string; archived?: boolean; createdAt?: string;
        }>;
      }>;
      const tasks: KanbanTask[] = [];
      const tagSet = new Set<string>();
      for (const s of sections) {
        if (s.name) tagSet.add(s.name);
        for (const t of s.tasks ?? []) {
          const task: KanbanTask = {
            id: t.id,
            title: t.title,
            status: t.status === "in-progress" ? "doing" : "todo",
          };
          if (s.name) task.tag = s.name;
          if (t.dueDate) task.dueDate = t.dueDate;
          if (t.notes) task.notes = t.notes;
          if (t.archived) task.archived = t.archived;
          if (t.createdAt) task.createdAt = t.createdAt;
          tasks.push(task);
        }
      }
      return { tasks, tags: [...tagSet] };
    }
  }
  return { tasks: [], tags: [] };
}

const SECTIONS: Array<{ status: TaskStatus; label: string }> = [
  { status: "doing",   label: "Doing" },
  { status: "waiting", label: "Waiting" },
  { status: "todo",    label: "Todo" },
];

function tagColor(tag: string): string {
  const palette = ["#4a9eff", "#ff9f43", "#4caf50", "#a855f7", "#ef4444", "#06b6d4", "#f97316"];
  let h = 0;
  for (const c of tag) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return palette[h % palette.length] ?? "#888";
}

interface DragState { taskId: string; fromStatus: TaskStatus; }

export default function KanbanPane({ kanban: rawKanban, onChange }: Props) {
  const kanban = useMemo(() => ensureNewFormat(rawKanban as unknown), [rawKanban]);

  const [captureText, setCaptureText] = useState("");
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [taskTitleDraft, setTaskTitleDraft] = useState("");
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Record<TaskStatus, boolean>>({
    doing: false, waiting: false, todo: false,
  });
  const [showArchived, setShowArchived] = useState(false);
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<TaskStatus | null>(null);

  const taskInputRef = useRef<HTMLInputElement>(null);
  const dragState = useRef<DragState | null>(null);
  const sectionEls = useRef<Map<TaskStatus, HTMLElement>>(new Map());

  useEffect(() => {
    if (editingTaskId) taskInputRef.current?.focus();
  }, [editingTaskId]);

  useEffect(() => {
    if (!openTaskId) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") setOpenTaskId(null); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [openTaskId]);

  const updateTask = useCallback((taskId: string, patch: Partial<KanbanTask>) => {
    onChange({ ...kanban, tasks: kanban.tasks.map((t) => t.id === taskId ? { ...t, ...patch } : t) });
  }, [kanban, onChange]);

  const deleteTask = useCallback((taskId: string) => {
    onChange({ ...kanban, tasks: kanban.tasks.filter((t) => t.id !== taskId) });
  }, [kanban, onChange]);

  const addTask = useCallback((status: TaskStatus) => {
    const t: KanbanTask = { id: uid(), title: "", status, createdAt: new Date().toISOString() };
    onChange({ ...kanban, tasks: [...kanban.tasks, t] });
    setEditingTaskId(t.id);
    setTaskTitleDraft("");
  }, [kanban, onChange]);

  const commitTaskTitle = useCallback((taskId: string) => {
    const title = taskTitleDraft.trim();
    if (title) updateTask(taskId, { title }); else deleteTask(taskId);
    setEditingTaskId(null);
  }, [taskTitleDraft, updateTask, deleteTask]);

  // Task drag between sections
  const calcOverStatus = useCallback((y: number): TaskStatus | null => {
    for (const { status } of SECTIONS) {
      const el = sectionEls.current.get(status);
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (y >= r.top && y <= r.bottom) return status;
    }
    return null;
  }, []);

  const handleTaskDragStart = useCallback((e: React.PointerEvent, taskId: string, fromStatus: TaskStatus) => {
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragState.current = { taskId, fromStatus };
    setDraggingTaskId(taskId);
  }, []);

  const handleBoardPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragState.current) return;
    setDragOverStatus(calcOverStatus(e.clientY));
  }, [calcOverStatus]);

  const handleBoardPointerUp = useCallback((e: React.PointerEvent) => {
    const ds = dragState.current;
    if (!ds) return;
    dragState.current = null;
    const target = calcOverStatus(e.clientY);
    if (target && target !== ds.fromStatus) updateTask(ds.taskId, { status: target });
    setDraggingTaskId(null);
    setDragOverStatus(null);
  }, [calcOverStatus, updateTask]);

  const openTask = openTaskId ? kanban.tasks.find((t) => t.id === openTaskId) ?? null : null;
  const archivedTasks = kanban.tasks.filter((t) => t.archived);

  return (
    <div
      className={`kanban-board${draggingTaskId ? " kanban-board-dragging" : ""}`}
      onPointerMove={draggingTaskId ? handleBoardPointerMove : undefined}
      onPointerUp={draggingTaskId ? handleBoardPointerUp : undefined}
    >
      {openTask ? (
        <TaskDetail
          task={openTask}
          tags={kanban.tags}
          onBack={() => setOpenTaskId(null)}
          onUpdate={(patch) => updateTask(openTask.id, patch)}
          onArchive={() => { updateTask(openTask.id, { archived: true }); setOpenTaskId(null); }}
          onAddTag={(tag) => { if (!kanban.tags.includes(tag)) onChange({ ...kanban, tags: [...kanban.tags, tag] }); }}
        />
      ) : (
        <>
          {/* Quick capture → Todo */}
          <div className="kanban-capture">
            <input
              className="kanban-capture-input"
              placeholder="タスクを追加... (Enter で Todo へ)"
              value={captureText}
              onChange={(e) => setCaptureText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const title = captureText.trim();
                  if (title) {
                    const t: KanbanTask = { id: uid(), title, status: "todo", createdAt: new Date().toISOString() };
                    onChange({ ...kanban, tasks: [...kanban.tasks, t] });
                    setCaptureText("");
                  }
                }
                if (e.key === "Escape") setCaptureText("");
              }}
            />
          </div>

          {/* Fixed status sections */}
          {SECTIONS.map(({ status, label }) => {
            const tasks = kanban.tasks.filter((t) => t.status === status && !t.archived);
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
                  <span className="kanban-section-count">{tasks.length}</span>
                  <button
                    className="kanban-section-add-task"
                    onClick={(e) => { e.stopPropagation(); addTask(status); }}
                  >+</button>
                </div>

                {!isCollapsed && (
                  <div className="kanban-section-body">
                    {tasks.map((task) => {
                      const isEditing = editingTaskId === task.id;
                      const due = formatDueDate(task.dueDate);

                      return (
                        <div
                          key={task.id}
                          className={`kanban-task${draggingTaskId === task.id ? " kanban-task-dragging" : ""}`}
                        >
                          <button
                            className="kanban-task-status"
                            title="完了・アーカイブ"
                            onClick={() => updateTask(task.id, { archived: true })}
                          >□</button>

                          {isEditing ? (
                            <input
                              ref={taskInputRef}
                              className="kanban-task-title"
                              value={taskTitleDraft}
                              onChange={(e) => setTaskTitleDraft(e.target.value)}
                              onBlur={() => commitTaskTitle(task.id)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  const title = taskTitleDraft.trim();
                                  if (title) updateTask(task.id, { title }); else deleteTask(task.id);
                                  setEditingTaskId(null);
                                  if (title) setTimeout(() => addTask(status), 0);
                                }
                                if (e.key === "Escape") {
                                  if (!task.title) deleteTask(task.id);
                                  setEditingTaskId(null);
                                }
                              }}
                            />
                          ) : (
                            <span
                              className="kanban-task-title kanban-task-title-link"
                              onClick={() => setOpenTaskId(task.id)}
                            >
                              {task.title}
                            </span>
                          )}

                          {task.tag && (
                            <span
                              className="kanban-task-tag"
                              style={{ borderColor: tagColor(task.tag), color: tagColor(task.tag) }}
                            >{task.tag}</span>
                          )}

                          {due && <span className={`kanban-task-due ${due.cls}`}>{due.text}</span>}

                          <span
                            className="kanban-task-drag-handle"
                            onPointerDown={(e) => handleTaskDragStart(e, task.id, status)}
                          >⠿</span>

                          <button className="kanban-task-delete" onClick={() => deleteTask(task.id)}>×</button>
                        </div>
                      );
                    })}

                    {tasks.length === 0 && !editingTaskId && (
                      <div className="kanban-section-empty">タスクなし</div>
                    )}

                    <div className="kanban-add-task-row" onClick={() => addTask(status)}>
                      + タスクを追加
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Archived */}
          {archivedTasks.length > 0 && (
            <div className="kanban-archived-section">
              <div className="kanban-archived-toggle" onClick={() => setShowArchived((v) => !v)}>
                {showArchived ? "▾" : "▸"} アーカイブ済み ({archivedTasks.length})
              </div>
              {showArchived && archivedTasks.map((task) => (
                <div key={task.id} className="kanban-task kanban-task-archived">
                  <button
                    className="kanban-task-status"
                    onClick={() => updateTask(task.id, { archived: false, status: "todo" })}
                    title="アーカイブを解除"
                  >☑</button>
                  <span className="kanban-task-title kanban-task-title-link" onClick={() => setOpenTaskId(task.id)}>
                    {task.title}
                  </span>
                  {task.tag && (
                    <span className="kanban-task-tag" style={{ borderColor: tagColor(task.tag), color: tagColor(task.tag) }}>
                      {task.tag}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
