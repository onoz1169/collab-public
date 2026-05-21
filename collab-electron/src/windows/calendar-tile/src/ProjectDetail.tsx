import { useState, useRef, useEffect, useCallback } from "react";
import type { Project, ProjectTask, ProjectStatus } from "./KanbanPane";
import { formatDueDate } from "./dateUtils";

interface Props {
  project: Project;
  onBack: () => void;
  onOpenTask: (taskId: string) => void;
  onUpdate: (patch: Partial<Project>) => void;
  onArchive: () => void;
}

interface TaskRowProps {
  task: ProjectTask;
  onOpen: () => void;
  onToggleDone: () => void;
  onDelete: () => void;
}

function uid() { return Math.random().toString(36).slice(2, 10); }

const STATUS_ORDER: ProjectStatus[] = ["todo", "doing", "waiting", "done"];
const STATUS_LABELS: Record<ProjectStatus, string> = {
  todo: "Todo", doing: "Doing", waiting: "Waiting", done: "Done",
};

function nextStatus(s: ProjectStatus): ProjectStatus {
  const idx = STATUS_ORDER.indexOf(s);
  return STATUS_ORDER[(idx + 1) % STATUS_ORDER.length];
}

function TaskRow({ task, onOpen, onToggleDone, onDelete }: TaskRowProps) {
  const due = formatDueDate(task.dueDate);
  const hasNotes = task.notes && task.notes.replace(/<[^>]*>/g, "").trim().length > 0;

  return (
    <div
      className={`project-task${task.done ? " project-task-done" : ""}`}
      onClick={onOpen}
    >
      <button
        className="project-task-check"
        onClick={(e) => { e.stopPropagation(); onToggleDone(); }}
      >
        {task.done ? "☑" : "□"}
      </button>

      <span className="project-task-title">{task.title}</span>

      {hasNotes && <span className="project-task-has-notes" title="ノートあり">•</span>}

      {due && <span className={`project-task-due ${due.cls}`}>{due.text}</span>}

      <button
        className="project-task-delete"
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
      >×</button>
    </div>
  );
}

export default function ProjectDetail({ project, onBack, onOpenTask, onUpdate, onArchive }: Props) {
  const [captureText, setCaptureText] = useState("");
  const [showDone, setShowDone] = useState(true);
  const nameRef = useRef<HTMLDivElement>(null);
  const notesRef = useRef<HTMLDivElement>(null);
  const notesSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (nameRef.current) nameRef.current.textContent = project.name;
    if (notesRef.current) notesRef.current.innerHTML = project.notes ?? "";
  }, [project.id]);

  useEffect(() => {
    return () => { if (notesSaveTimer.current) clearTimeout(notesSaveTimer.current); };
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onBack(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onBack]);

  const saveName = useCallback(() => {
    const name = nameRef.current?.textContent?.trim() ?? "";
    if (name) onUpdate({ name });
    else if (nameRef.current) nameRef.current.textContent = project.name;
  }, [project.name, onUpdate]);

  const handleNotesInput = useCallback(() => {
    if (notesSaveTimer.current) clearTimeout(notesSaveTimer.current);
    notesSaveTimer.current = setTimeout(() => {
      const notes = notesRef.current?.innerHTML ?? "";
      onUpdate({ notes });
    }, 600);
  }, [onUpdate]);

  const saveNotes = useCallback(() => {
    if (notesSaveTimer.current) { clearTimeout(notesSaveTimer.current); notesSaveTimer.current = null; }
    const notes = notesRef.current?.innerHTML ?? "";
    onUpdate({ notes });
  }, [onUpdate]);

  const updateTask = useCallback((taskId: string, patch: Partial<ProjectTask>) => {
    onUpdate({ tasks: project.tasks.map((t) => t.id === taskId ? { ...t, ...patch } : t) });
  }, [project.tasks, onUpdate]);

  const deleteTask = useCallback((taskId: string) => {
    onUpdate({ tasks: project.tasks.filter((t) => t.id !== taskId) });
  }, [project.tasks, onUpdate]);

  const addTask = useCallback((title: string) => {
    if (!title.trim()) return;
    const task: ProjectTask = {
      id: uid(),
      title: title.trim(),
      done: false,
      createdAt: new Date().toISOString(),
    };
    onUpdate({ tasks: [...project.tasks, task] });
    // Open the new task immediately
    setTimeout(() => onOpenTask(task.id), 50);
  }, [project.tasks, onUpdate, onOpenTask]);

  const activeTasks = project.tasks.filter((t) => !t.done);
  const doneTasks = project.tasks.filter((t) => t.done);

  return (
    <div className="project-detail">
      <div className="project-detail-header">
        <button className="project-detail-back" onClick={onBack}>← 戻る</button>
        <div
          ref={nameRef}
          className="project-detail-name"
          contentEditable
          suppressContentEditableWarning
          onBlur={saveName}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); }
            if (e.key === "Escape") { e.preventDefault(); onBack(); }
          }}
        />
        <button
          className={`project-detail-status project-status-${project.status}`}
          onClick={() => onUpdate({ status: nextStatus(project.status) })}
          title="クリックでステータス変更"
        >
          {STATUS_LABELS[project.status]}
        </button>
        <button className="project-detail-archive-btn" onClick={onArchive}>完了</button>
      </div>

      <div className="project-detail-body">
        {/* Project-level context / history notes */}
        <div
          ref={notesRef}
          className="project-context-notes"
          contentEditable
          suppressContentEditableWarning
          onBlur={saveNotes}
          onInput={handleNotesInput}
          data-placeholder="プロジェクトの背景・文脈・メモ..."
        />

        <div className="project-detail-divider" />

        {/* Add task */}
        <div className="project-add-task">
          <input
            className="project-add-task-input"
            placeholder="タスクを追加... (Enter でタスクページへ)"
            value={captureText}
            onChange={(e) => setCaptureText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") { addTask(captureText); setCaptureText(""); }
              if (e.key === "Escape") setCaptureText("");
            }}
          />
        </div>

        {/* Active tasks */}
        {activeTasks.map((task) => (
          <TaskRow
            key={task.id}
            task={task}
            onOpen={() => onOpenTask(task.id)}
            onToggleDone={() => updateTask(task.id, { done: !task.done })}
            onDelete={() => deleteTask(task.id)}
          />
        ))}

        {activeTasks.length === 0 && doneTasks.length === 0 && (
          <div className="project-empty">タスクなし</div>
        )}

        {/* Done tasks — always visible (history) */}
        {doneTasks.length > 0 && (
          <div className="project-done-section">
            <div className="project-done-toggle" onClick={() => setShowDone((v) => !v)}>
              {showDone ? "▾" : "▸"} 完了済み ({doneTasks.length})
            </div>
            {showDone && doneTasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                onOpen={() => onOpenTask(task.id)}
                onToggleDone={() => updateTask(task.id, { done: !task.done })}
                onDelete={() => deleteTask(task.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
