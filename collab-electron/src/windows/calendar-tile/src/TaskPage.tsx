import { useRef, useEffect, useCallback } from "react";
import type { ProjectTask } from "./KanbanPane";
import { formatDueDate } from "./dateUtils";
import DatePicker from "./DatePicker";

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
      </div>

      <div className="task-page-body">
        <div className="task-page-title-row">
          <button
            className={`task-page-check${task.done ? " task-page-check-done" : ""}`}
            onClick={() => { onUpdate({ done: !task.done }); onBack(); }}
            title={task.done ? "完了済み（クリックで戻す）" : "完了にしてプロジェクトへ戻る"}
          >
            {task.done ? "☑" : "□"}
          </button>
          <div
            ref={titleRef}
            className={`task-page-title${task.done ? " task-page-title-done" : ""}`}
            contentEditable
            suppressContentEditableWarning
            onBlur={saveTitle}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); }
              if (e.key === "Escape") { e.preventDefault(); onBack(); }
            }}
          />
        </div>

        <div className="task-page-meta">
          <DatePicker
            value={task.dueDate}
            onChange={(date) => onUpdate({ dueDate: date })}
          />
          {due && (
            <span className={`task-page-status-badge ${due.cls}`}>{due.text}</span>
          )}
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
