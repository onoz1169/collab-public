import { useRef, useEffect, useCallback } from "react";
import type { ProjectTask } from "./KanbanPane";
import { formatDueDate } from "./dateUtils";

interface Props {
  task: ProjectTask;
  projectName: string;
  onBack: () => void;
  onUpdate: (patch: Partial<ProjectTask>) => void;
}

export default function TaskPage({ task, projectName, onBack, onUpdate }: Props) {
  const titleRef = useRef<HTMLDivElement>(null);
  const notesRef = useRef<HTMLDivElement>(null);
  const notesSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (titleRef.current) titleRef.current.textContent = task.title;
    if (notesRef.current) notesRef.current.innerHTML = task.notes ?? "";
  }, [task.id]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onBack(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onBack]);

  const saveTitle = useCallback(() => {
    const title = titleRef.current?.textContent?.trim() ?? "";
    if (title && title !== task.title) onUpdate({ title });
    else if (titleRef.current) titleRef.current.textContent = task.title;
  }, [task.title, onUpdate]);

  const handleNotesInput = useCallback(() => {
    if (notesSaveTimerRef.current) clearTimeout(notesSaveTimerRef.current);
    notesSaveTimerRef.current = setTimeout(() => {
      const notes = notesRef.current?.textContent?.trim() ?? "";
      onUpdate({ notes: notes || undefined });
    }, 600);
  }, [onUpdate]);

  const due = formatDueDate(task.dueDate);

  return (
    <div className="task-page">
      <div className="task-page-header">
        <button className="task-page-back" onClick={onBack}>← 戻る</button>
        <span className="task-page-project-label">{projectName}</span>
        <button
          className={`task-page-done-btn${task.done ? " task-page-done-btn-done" : ""}`}
          onClick={() => onUpdate({ done: !task.done })}
        >
          {task.done ? "完了済み" : "完了にする"}
        </button>
      </div>

      <div className="task-page-body">
        <div
          ref={titleRef}
          className="task-page-title"
          contentEditable
          suppressContentEditableWarning
          onBlur={saveTitle}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); }
            if (e.key === "Escape") { e.preventDefault(); onBack(); }
          }}
        />

        <div className="task-page-meta">
          <input
            className="task-page-due-input"
            type="date"
            value={task.dueDate ?? ""}
            onChange={(e) => onUpdate({ dueDate: e.target.value || undefined })}
          />
          {due && (
            <span className={`task-page-status-badge ${due.cls}`}>{due.text}</span>
          )}
          <span className={`task-page-status-badge${task.done ? " task-page-status-done" : ""}`}>
            {task.done ? "完了" : "未完了"}
          </span>
        </div>

        <div className="task-page-divider" />

        <div
          ref={notesRef}
          className="task-page-notes"
          contentEditable
          suppressContentEditableWarning
          data-placeholder="メモを入力..."
          onInput={handleNotesInput}
        />
      </div>
    </div>
  );
}
