import { useState, useRef, useEffect, useCallback } from "react";
import type { KanbanTask, TaskStatus } from "./KanbanPane";
import { formatDueDate } from "./dateUtils";

interface Props {
  task: KanbanTask;
  tags: string[];
  onBack: () => void;
  onUpdate: (patch: Partial<KanbanTask>) => void;
  onArchive: () => void;
  onAddTag: (tag: string) => void;
}

const STATUS_ORDER: TaskStatus[] = ["todo", "doing", "waiting"];
const STATUS_LABELS: Record<TaskStatus, string> = {
  "todo": "未着手",
  "doing": "進行中",
  "waiting": "待機中",
};

function nextStatus(s: TaskStatus): TaskStatus {
  const idx = STATUS_ORDER.indexOf(s);
  return STATUS_ORDER[(idx + 1) % STATUS_ORDER.length];
}

function tagColor(tag: string): string {
  const palette = ["#4a9eff", "#ff9f43", "#4caf50", "#a855f7", "#ef4444", "#06b6d4", "#f97316"];
  let h = 0;
  for (const c of tag) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return palette[h % palette.length] ?? "#888";
}

export default function TaskDetail({ task, tags, onBack, onUpdate, onArchive, onAddTag }: Props) {
  const titleRef = useRef<HTMLDivElement>(null);
  const notesRef = useRef<HTMLDivElement>(null);
  const notesSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [tagInput, setTagInput] = useState("");
  const [showTagInput, setShowTagInput] = useState(false);

  useEffect(() => {
    if (titleRef.current) titleRef.current.textContent = task.title;
    if (notesRef.current) notesRef.current.innerHTML = task.notes ?? "";
  }, [task.id]);

  useEffect(() => {
    return () => { if (notesSaveTimerRef.current) clearTimeout(notesSaveTimerRef.current); };
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onBack(); };
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

  const commitTag = useCallback((raw: string) => {
    const tag = raw.trim();
    if (tag) {
      onAddTag(tag);
      onUpdate({ tag });
    }
    setTagInput("");
    setShowTagInput(false);
  }, [onAddTag, onUpdate]);

  return (
    <div className="task-detail">
      <div className="task-detail-header">
        <button className="task-detail-back" onClick={onBack}>← 戻る</button>
        <button className="task-detail-archive-btn" onClick={onArchive}>
          完了・アーカイブ  ⌘↵
        </button>
      </div>

      <div className="task-detail-body">
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

        <div className="task-detail-meta">
          <span className="task-detail-meta-label">期日</span>
          <input
            className="task-detail-due-input"
            type="date"
            value={task.dueDate ?? ""}
            onChange={(e) => onUpdate({ dueDate: e.target.value || undefined })}
          />
          {(() => {
            const due = formatDueDate(task.dueDate);
            return due ? <span className={`task-detail-due-badge ${due.cls}`}>{due.text}</span> : null;
          })()}
          <span className="task-detail-meta-sep" />
          <span className="task-detail-meta-label">ステータス</span>
          <button
            className={`task-detail-status-label task-status-${task.status}`}
            onClick={() => onUpdate({ status: nextStatus(task.status) })}
            title="クリックで変更"
          >
            {STATUS_LABELS[task.status]}
          </button>
        </div>

        {/* Tag row */}
        <div className="task-detail-tag-row">
          {task.tag ? (
            <span className="task-detail-tag" style={{ borderColor: tagColor(task.tag), color: tagColor(task.tag) }}>
              {task.tag}
              <button
                className="task-detail-tag-remove"
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                onClick={() => onUpdate({ tag: undefined } as any)}
              >×</button>
            </span>
          ) : showTagInput ? (
            <input
              className="task-detail-tag-input"
              autoFocus
              value={tagInput}
              placeholder="タグ名..."
              onChange={(e) => setTagInput(e.target.value)}
              onBlur={() => commitTag(tagInput)}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitTag(tagInput);
                if (e.key === "Escape") { setTagInput(""); setShowTagInput(false); }
              }}
            />
          ) : (
            <>
              {tags.map((t) => (
                <button
                  key={t}
                  className="task-detail-tag-btn"
                  style={{ borderColor: tagColor(t), color: tagColor(t) }}
                  onClick={() => onUpdate({ tag: t })}
                >{t}</button>
              ))}
              <button
                className="task-detail-tag-btn task-detail-tag-add"
                onClick={() => setShowTagInput(true)}
              >+ タグ</button>
            </>
          )}
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
