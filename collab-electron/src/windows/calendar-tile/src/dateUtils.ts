export interface DueDateInfo {
  text: string;
  cls: "due-overdue" | "due-today" | "due-soon" | "due-upcoming" | "due-normal";
}

export function formatDueDate(dateStr: string | undefined): DueDateInfo | null {
  if (!dateStr) return null;
  const date = new Date(dateStr + "T00:00:00");
  if (isNaN(date.getTime())) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diff < 0) return { text: `${Math.abs(diff)}日超過`, cls: "due-overdue" };
  if (diff === 0) return { text: "今日", cls: "due-today" };
  if (diff === 1) return { text: "明日", cls: "due-soon" };
  if (diff <= 7) return { text: `${diff}日後`, cls: "due-upcoming" };
  return { text: dateStr, cls: "due-normal" };
}
