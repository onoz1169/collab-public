import { useState, useCallback, useRef, useEffect } from "react";
import TaskDetail from "./TaskDetail";
import { formatDueDate } from "./dateUtils";

export interface KanbanTask {
  id: string;
  title: string;
  status: "todo" | "in-progress" | "done";
  dueDate?: string;
  notes?: string;
  archived?: boolean;
  createdAt?: string;
}

export interface KanbanSection {
  id: string;
  name: string;
  collapsed: boolean;
  tasks: KanbanTask[];
}

export interface KanbanData {
  sections: KanbanSection[];
}

interface Props {
  kanban: KanbanData;
  onChange: (data: KanbanData) => void;
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

const STATUS_ORDER: KanbanTask["status"][] = ["todo", "in-progress", "done"];

function nextStatus(current: KanbanTask["status"]): KanbanTask["status"] {
  const idx = STATUS_ORDER.indexOf(current);
  return STATUS_ORDER[(idx + 1) % STATUS_ORDER.length];
}

function statusSymbol(status: KanbanTask["status"]): string {
  if (status === "todo") return "○";
  if (status === "in-progress") return "◉";
  return "✓";
}

interface DragState {
  sectionId: string;
  startIndex: number;
  pointerId: number;
}

export default function KanbanPane({ kanban, onChange }: Props) {
  const [captureText, setCaptureText] = useState("");
  const [editingTask, setEditingTask] = useState<{ sectionId: string; taskId: string } | null>(null);
  const [editingSection, setEditingSection] = useState<{ sectionId: string } | null>(null);
  const [taskTitleDraft, setTaskTitleDraft] = useState("");
  const [sectionNameDraft, setSectionNameDraft] = useState("");
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState<Record<string, boolean>>({});
  const [draggingSectionId, setDraggingSectionId] = useState<string | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const taskInputRef = useRef<HTMLInputElement>(null);
  const sectionInputRef = useRef<HTMLInputElement>(null);
  const dragState = useRef<DragState | null>(null);
  const sectionEls = useRef<Map<string, HTMLElement>>(new Map());

  useEffect(() => {
    if (editingTask) taskInputRef.current?.focus();
  }, [editingTask]);

  useEffect(() => {
    if (editingSection) sectionInputRef.current?.focus();
  }, [editingSection]);

  useEffect(() => {
    if (!openTaskId) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenTaskId(null);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [openTaskId]);

  const updateSection = useCallback(
    (sectionId: string, patch: Partial<KanbanSection>) => {
      onChange({
        sections: kanban.sections.map((s) =>
          s.id === sectionId ? { ...s, ...patch } : s
        ),
      });
    },
    [kanban, onChange]
  );

  const updateTask = useCallback(
    (sectionId: string, taskId: string, patch: Partial<KanbanTask>) => {
      onChange({
        sections: kanban.sections.map((s) =>
          s.id === sectionId
            ? { ...s, tasks: s.tasks.map((t) => t.id === taskId ? { ...t, ...patch } : t) }
            : s
        ),
      });
    },
    [kanban, onChange]
  );

  const deleteTask = useCallback(
    (sectionId: string, taskId: string) => {
      onChange({
        sections: kanban.sections.map((s) =>
          s.id === sectionId
            ? { ...s, tasks: s.tasks.filter((t) => t.id !== taskId) }
            : s
        ),
      });
    },
    [kanban, onChange]
  );

  const addTask = useCallback(
    (sectionId: string) => {
      const newTask: KanbanTask = {
        id: uid(),
        title: "",
        status: "todo",
        createdAt: new Date().toISOString(),
      };
      onChange({
        sections: kanban.sections.map((s) =>
          s.id === sectionId
            ? { ...s, collapsed: false, tasks: [...s.tasks, newTask] }
            : s
        ),
      });
      setEditingTask({ sectionId, taskId: newTask.id });
      setTaskTitleDraft("");
    },
    [kanban, onChange]
  );

  const addSection = useCallback(() => {
    const newTask: KanbanTask = {
      id: uid(),
      title: "",
      status: "todo",
      createdAt: new Date().toISOString(),
    };
    const newSection: KanbanSection = {
      id: uid(),
      name: "",
      collapsed: false,
      tasks: [newTask],
    };
    onChange({ sections: [...kanban.sections, newSection] });
    setEditingSection({ sectionId: newSection.id });
    setSectionNameDraft("");
    setEditingTask({ sectionId: newSection.id, taskId: newTask.id });
    setTaskTitleDraft("");
  }, [kanban, onChange]);

  const commitTaskTitle = useCallback(
    (sectionId: string, taskId: string) => {
      const title = taskTitleDraft.trim();
      if (!title) {
        deleteTask(sectionId, taskId);
      } else {
        updateTask(sectionId, taskId, { title });
      }
      setEditingTask(null);
    },
    [taskTitleDraft, updateTask, deleteTask]
  );

  const commitSectionName = useCallback(
    (sectionId: string) => {
      updateSection(sectionId, { name: sectionNameDraft.trim() });
      setEditingSection(null);
    },
    [sectionNameDraft, updateSection]
  );

  const startEditSection = useCallback((section: KanbanSection) => {
    setEditingSection({ sectionId: section.id });
    setSectionNameDraft(section.name);
  }, []);

  const toggleArchived = useCallback((sectionId: string) => {
    setShowArchived((prev) => ({ ...prev, [sectionId]: !prev[sectionId] }));
  }, []);

  // ── Pointer-based drag ──────────────────────────────────────

  const calcOverIndex = useCallback((clientY: number): number => {
    const sections = kanban.sections;
    for (let i = 0; i < sections.length; i++) {
      const id = sections[i]?.id;
      if (!id) continue;
      const el = sectionEls.current.get(id);
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      if (clientY < rect.top + rect.height / 2) return i;
    }
    return sections.length;
  }, [kanban.sections]);

  const handleDragHandlePointerDown = useCallback(
    (e: React.PointerEvent, sectionId: string) => {
      e.preventDefault();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      const startIndex = kanban.sections.findIndex((s) => s.id === sectionId);
      dragState.current = { sectionId, startIndex, pointerId: e.pointerId };
      setDraggingSectionId(sectionId);
      setDragOverIndex(startIndex);
    },
    [kanban.sections]
  );

  const handleBoardPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragState.current) return;
      setDragOverIndex(calcOverIndex(e.clientY));
    },
    [calcOverIndex]
  );

  const handleBoardPointerUp = useCallback(
    (e: React.PointerEvent) => {
      const ds = dragState.current;
      if (!ds) return;
      dragState.current = null;

      const overIdx = calcOverIndex(e.clientY);
      const { sectionId, startIndex } = ds;

      // same position → no-op
      if (overIdx !== startIndex && overIdx !== startIndex + 1) {
        const sections = [...kanban.sections];
        const [moved] = sections.splice(startIndex, 1);
        const insertAt = overIdx > startIndex ? overIdx - 1 : overIdx;
        sections.splice(insertAt, 0, moved);
        onChange({ sections });
      }

      setDraggingSectionId(null);
      setDragOverIndex(null);
    },
    [calcOverIndex, kanban.sections, onChange]
  );

  // ───────────────────────────────────────────────────────────

  const openTask = openTaskId
    ? kanban.sections.flatMap((s) => s.tasks).find((t) => t.id === openTaskId) ?? null
    : null;
  const openTaskSection = openTaskId
    ? kanban.sections.find((s) => s.tasks.some((t) => t.id === openTaskId)) ?? null
    : null;

  const isDragging = draggingSectionId !== null;

  return (
    <div
      className={`kanban-board${isDragging ? " kanban-board-dragging" : ""}`}
      onPointerMove={isDragging ? handleBoardPointerMove : undefined}
      onPointerUp={isDragging ? handleBoardPointerUp : undefined}
    >
      {openTask && openTaskSection ? (
        <TaskDetail
          task={openTask}
          sectionName={openTaskSection.name}
          onBack={() => setOpenTaskId(null)}
          onUpdate={(patch) => updateTask(openTaskSection.id, openTask.id, patch)}
          onArchive={() => {
            updateTask(openTaskSection.id, openTask.id, { status: "done", archived: true });
            setOpenTaskId(null);
          }}
        />
      ) : (
        <>
          {/* quick capture */}
          <div className="kanban-capture">
            <input
              className="kanban-capture-input"
              placeholder="タスクを追加... (Enter で先頭セクションへ)"
              value={captureText}
              onChange={(e) => setCaptureText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const title = captureText.trim();
                  if (title && kanban.sections.length > 0) {
                    const newTask: KanbanTask = {
                      id: uid(),
                      title,
                      status: "todo",
                      createdAt: new Date().toISOString(),
                    };
                    onChange({
                      sections: kanban.sections.map((s, i) =>
                        i === 0 ? { ...s, collapsed: false, tasks: [...s.tasks, newTask] } : s
                      ),
                    });
                    setCaptureText("");
                  }
                }
                if (e.key === "Escape") setCaptureText("");
              }}
            />
            {kanban.sections.length > 0 && captureText && (
              <span className="kanban-capture-hint">→ {kanban.sections[0]?.name || "先頭セクション"}</span>
            )}
          </div>

          {/* sections with drop lines */}
          {kanban.sections.map((section, index) => {
            const activeTasks = section.tasks.filter((t) => !t.archived);
            const archivedTasks = section.tasks.filter((t) => t.archived);
            const pendingCount = activeTasks.filter((t) => t.status !== "done").length;
            const orderedActive = [
              ...activeTasks.filter((t) => t.status !== "done"),
              ...activeTasks.filter((t) => t.status === "done"),
            ];
            const isBeingDragged = draggingSectionId === section.id;
            const showDropLine = isDragging && dragOverIndex === index && draggingSectionId !== section.id;

            return (
              <div key={section.id}>
                {showDropLine && <div className="kanban-drop-line" />}
                <div
                  ref={(el) => {
                    if (el) sectionEls.current.set(section.id, el);
                    else sectionEls.current.delete(section.id);
                  }}
                  className={`kanban-section${isBeingDragged ? " kanban-section-dragging" : ""}`}
                >
                  <div className="kanban-section-header">
                    <span
                      className="kanban-section-drag"
                      onPointerDown={(e) => handleDragHandlePointerDown(e, section.id)}
                    >⠿</span>
                    <button
                      className="kanban-section-chevron"
                      onClick={() => updateSection(section.id, { collapsed: !section.collapsed })}
                    >
                      {section.collapsed ? "▸" : "▾"}
                    </button>

                    {editingSection?.sectionId === section.id ? (
                      <input
                        ref={sectionInputRef}
                        className="kanban-section-name"
                        value={sectionNameDraft}
                        onChange={(e) => setSectionNameDraft(e.target.value)}
                        onBlur={() => commitSectionName(section.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") e.currentTarget.blur();
                          if (e.key === "Escape") {
                            setSectionNameDraft(section.name);
                            setEditingSection(null);
                          }
                        }}
                      />
                    ) : (
                      <span
                        className="kanban-section-name"
                        onClick={() => startEditSection(section)}
                      >
                        {section.name || "無題のセクション"}
                      </span>
                    )}

                    {section.collapsed && pendingCount > 0 && (
                      <span className="kanban-section-badge">({pendingCount})</span>
                    )}

                    <button
                      className="kanban-section-add-task"
                      onClick={() => addTask(section.id)}
                    >+</button>
                  </div>

                  {!section.collapsed && (
                    <div className="kanban-section-body">
                      {orderedActive.map((task) => {
                        const isEditing =
                          editingTask?.sectionId === section.id &&
                          editingTask.taskId === task.id;

                        return (
                          <div
                            key={task.id}
                            className={`kanban-task${task.status === "done" ? " kanban-task-done" : ""}`}
                          >
                            <button
                              className={`kanban-task-status task-status-${task.status}`}
                              onClick={() => {
                                const next = nextStatus(task.status);
                                updateTask(section.id, task.id, {
                                  status: next,
                                  ...(next === "done" ? { archived: true } : {}),
                                });
                              }}
                            >
                              {statusSymbol(task.status)}
                            </button>

                            {isEditing ? (
                              <input
                                ref={taskInputRef}
                                className="kanban-task-title"
                                value={taskTitleDraft}
                                onChange={(e) => setTaskTitleDraft(e.target.value)}
                                onBlur={() => commitTaskTitle(section.id, task.id)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    const title = taskTitleDraft.trim();
                                    if (title) {
                                      updateTask(section.id, task.id, { title });
                                    } else {
                                      deleteTask(section.id, task.id);
                                    }
                                    setEditingTask(null);
                                    if (title) setTimeout(() => addTask(section.id), 0);
                                  }
                                  if (e.key === "Escape") {
                                    if (!task.title) deleteTask(section.id, task.id);
                                    setEditingTask(null);
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

                            {(() => {
                              const due = formatDueDate(task.dueDate);
                              return due ? <span className={`kanban-task-due ${due.cls}`}>{due.text}</span> : null;
                            })()}

                            <button
                              className="kanban-task-delete"
                              onClick={() => deleteTask(section.id, task.id)}
                            >×</button>
                          </div>
                        );
                      })}

                      {archivedTasks.length > 0 && (
                        <div
                          className="kanban-archived-toggle"
                          onClick={() => toggleArchived(section.id)}
                        >
                          {showArchived[section.id] ? "▾" : "▸"} アーカイブ済み ({archivedTasks.length})
                        </div>
                      )}

                      {showArchived[section.id] && archivedTasks.map((task) => (
                        <div key={task.id} className="kanban-task kanban-task-archived">
                          <button
                            className="kanban-task-status task-status-done"
                            onClick={() => updateTask(section.id, task.id, { status: "todo", archived: false })}
                            title="アーカイブを解除"
                          >✓</button>
                          <span
                            className="kanban-task-title kanban-task-title-link"
                            onClick={() => setOpenTaskId(task.id)}
                          >
                            {task.title}
                          </span>
                        </div>
                      ))}

                      <div
                        className="kanban-add-task-row"
                        onClick={() => addTask(section.id)}
                      >
                        + タスクを追加
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* drop line at end */}
          {isDragging && dragOverIndex === kanban.sections.length && (
            <div className="kanban-drop-line" />
          )}

          <button className="kanban-add-section" onClick={addSection}>
            + セクションを追加
          </button>
        </>
      )}
    </div>
  );
}
