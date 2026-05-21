import { useRef, useEffect, useCallback } from "react";
import type { KanbanTask } from "./KanbanPane";
import { formatDueDate } from "./dateUtils";

interface Props {
  task: KanbanTask;
  sectionName: string;
  onBack: () => void;
  onUpdate: (patch: Partial<KanbanTask>) => void;
  onArchive: () => void;
}

const STATUS_ORDER: KanbanTask["status"][] = ["todo", "in-progress", "done"];
const STATUS_LABELS: Record<KanbanTask["status"], string> = {
  "todo": "未着手",
  "in-progress": "進行中",
  "done": "完了",
};

function nextStatus(s: KanbanTask["status"]): KanbanTask["status"] {
  const idx = STATUS_ORDER.indexOf(s);
  return STATUS_ORDER[(idx + 1) % STATUS_ORDER.length];
}

function statusSymbol(status: KanbanTask["status"]): string {
  if (status === "todo") return "□";
  if (status === "in-progress") return "▣";
  return "☑";
}

export default function TaskDetail({ task, sectionName, onBack, onUpdate, onArchive }: Props) {
  const titleRef = useRef<HTMLDivElement>(null);
  const notesRef = useRef<HTMLDivElement>(null);
  const notesSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (titleRef.current) titleRef.current.textContent = task.title;
    if (notesRef.current) notesRef.current.innerHTML = task.notes ?? "";
  }, [task.id]);

  useEffect(() => {
    return () => {
      if (notesSaveTimerRef.current) clearTimeout(notesSaveTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onBack();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onBack]);

  const saveTitle = useCallback(() => {
    const title = titleRef.current?.textContent?.trim() ?? "";
    if (title) {
      onUpdate({ title });
    } else if (titleRef.current) {
      titleRef.current.textContent = task.title;
    }
  }, [task.title, onUpdate]);

  const saveNotes = useCallback(() => {
    const notes = notesRef.current?.innerHTML ?? "";
    onUpdate({ notes });
  }, [onUpdate]);

  const handleNotesInput = useCallback(() => {
    if (notesSaveTimerRef.current) clearTimeout(notesSaveTimerRef.current);
    notesSaveTimerRef.current = setTimeout(() => {
      const notes = notesRef.current?.innerHTML ?? "";
      onUpdate({ notes });
    }, 600);
  }, [onUpdate]);

  return (
    <div className="task-detail">
      <div className="task-detail-header">
        <button className="task-detail-back" onClick={onBack}>← 戻る</button>
        <span className="task-detail-section-label">{sectionName}</span>
        <button className="task-detail-archive-btn" onClick={onArchive}>
          完了・アーカイブ  ⌘↵
        </button>
      </div>

      <div className="task-detail-body">
        <div className="task-detail-title-row">
          <button
            className={`kanban-task-status task-status-${task.status} task-detail-status-btn`}
            onClick={() => onUpdate({ status: nextStatus(task.status) })}
            title={STATUS_LABELS[task.status]}
          >
            {statusSymbol(task.status)}
          </button>
          <div
            ref={titleRef}
            className="task-detail-title"
            contentEditable
            suppressContentEditableWarning
            onBlur={saveTitle}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.metaKey) { e.preventDefault(); e.currentTarget.blur(); }
              if (e.key === "Enter" && e.metaKey) { e.preventDefault(); onArchive(); }
            }}
          />
        </div>

        <div className="task-detail-meta">
          <span className="task-detail-meta-label">期日</span>
          <input
            className="task-detail-due-input"
            type="date"
            value={task.dueDate ?? ""}
            onChange={(e) => onUpdate({ dueDate: e.target.value })}
          />
          {(() => {
            const due = formatDueDate(task.dueDate);
            return due ? <span className={`task-detail-due-badge ${due.cls}`}>{due.text}</span> : null;
          })()}
          <span className="task-detail-meta-sep" />
          <span className="task-detail-meta-label">ステータス</span>
          <span className={`task-detail-status-label task-status-${task.status}`}>
            {STATUS_LABELS[task.status]}
          </span>
        </div>

        <div className="task-detail-divider" />

        <div
          ref={notesRef}
          className="task-detail-notes"
          contentEditable
          suppressContentEditableWarning
          onBlur={saveNotes}
          onInput={handleNotesInput}
          data-placeholder="メモ、詳細情報を入力..."
        />
      </div>
    </div>
  );
}
