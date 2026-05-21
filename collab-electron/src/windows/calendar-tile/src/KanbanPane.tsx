import { useState, useCallback, useRef, useEffect } from "react";
import TaskDetail from "./TaskDetail";

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

export default function KanbanPane({ kanban, onChange }: Props) {
  const [editingTask, setEditingTask] = useState<{ sectionId: string; taskId: string } | null>(null);
  const [editingSection, setEditingSection] = useState<{ sectionId: string } | null>(null);
  const [taskTitleDraft, setTaskTitleDraft] = useState("");
  const [sectionNameDraft, setSectionNameDraft] = useState("");
  const [overSectionId, setOverSectionId] = useState<string | null>(null);
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState<Record<string, boolean>>({});

  const taskInputRef = useRef<HTMLInputElement>(null);
  const sectionInputRef = useRef<HTMLInputElement>(null);
  const dragIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (editingTask) taskInputRef.current?.focus();
  }, [editingTask]);

  useEffect(() => {
    if (editingSection) sectionInputRef.current?.focus();
  }, [editingSection]);

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

  const moveSection = useCallback((fromId: string, toId: string) => {
    if (fromId === toId) return;
    const sections = [...kanban.sections];
    const fromIdx = sections.findIndex((s) => s.id === fromId);
    const toIdx = sections.findIndex((s) => s.id === toId);
    if (fromIdx === -1 || toIdx === -1) return;
    const [moved] = sections.splice(fromIdx, 1);
    sections.splice(toIdx, 0, moved);
    onChange({ sections });
  }, [kanban, onChange]);

  const toggleArchived = useCallback((sectionId: string) => {
    setShowArchived((prev) => ({ ...prev, [sectionId]: !prev[sectionId] }));
  }, []);

  const openTask = openTaskId
    ? kanban.sections.flatMap((s) => s.tasks).find((t) => t.id === openTaskId) ?? null
    : null;
  const openTaskSection = openTaskId
    ? kanban.sections.find((s) => s.tasks.some((t) => t.id === openTaskId)) ?? null
    : null;

  return (
    <div className="kanban-board">
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
          {kanban.sections.map((section) => {
            const activeTasks = section.tasks.filter((t) => !t.archived);
            const archivedTasks = section.tasks.filter((t) => t.archived);
            const pendingCount = activeTasks.filter((t) => t.status !== "done").length;
            const orderedActive = [
              ...activeTasks.filter((t) => t.status !== "done"),
              ...activeTasks.filter((t) => t.status === "done"),
            ];

            return (
              <div
                key={section.id}
                className={`kanban-section${overSectionId === section.id ? " kanban-section-over" : ""}`}
                onDragOver={(e) => { e.preventDefault(); setOverSectionId(section.id); }}
                onDragLeave={() => setOverSectionId(null)}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragIdRef.current) moveSection(dragIdRef.current, section.id);
                  dragIdRef.current = null;
                  setOverSectionId(null);
                }}
              >
                <div className="kanban-section-header">
                  <span
                    className="kanban-section-drag"
                    draggable
                    onDragStart={(e) => {
                      dragIdRef.current = section.id;
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    onDragEnd={() => {
                      dragIdRef.current = null;
                      setOverSectionId(null);
                    }}
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
                                if (e.key === "Enter") e.currentTarget.blur();
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

                          {task.dueDate && (
                            <span className="kanban-task-due">{task.dueDate}</span>
                          )}

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
            );
          })}

          <button className="kanban-add-section" onClick={addSection}>
            + セクションを追加
          </button>
        </>
      )}
    </div>
  );
}
