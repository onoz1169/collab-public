import { useState, useEffect, useRef } from "react";

interface Props {
  value: string | undefined;
  onChange: (date: string | undefined) => void;
}

const DAYS = ["日", "月", "火", "水", "木", "金", "土"];

function toLocalDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseDate(s: string | undefined): Date | null {
  if (!s) return null;
  const d = new Date(s + "T00:00:00");
  return isNaN(d.getTime()) ? null : d;
}

function formatDisplay(s: string | undefined): string {
  const d = parseDate(s);
  if (!d) return "期日を設定";
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export default function DatePicker({ value, onChange }: Props) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const selected = parseDate(value);
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(() => {
    const base = selected ?? today;
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const selectDay = (day: number) => {
    const d = new Date(year, month, day);
    onChange(toLocalDateStr(d));
    setOpen(false);
  };

  const todayStr = toLocalDateStr(today);
  const selectedStr = value;

  return (
    <div className="datepicker-wrap" ref={ref}>
      <button
        className={`datepicker-trigger${value ? " datepicker-trigger-set" : ""}`}
        onClick={() => setOpen((v) => !v)}
      >
        {formatDisplay(value)}
        {value && (
          <span
            className="datepicker-clear"
            onClick={(e) => { e.stopPropagation(); onChange(undefined); }}
          >×</span>
        )}
      </button>

      {open && (
        <div className="datepicker-popup">
          <div className="datepicker-nav">
            <button onClick={() => setCursor(new Date(year, month - 1, 1))}>‹</button>
            <span>{year}年 {month + 1}月</span>
            <button onClick={() => setCursor(new Date(year, month + 1, 1))}>›</button>
          </div>

          <div className="datepicker-grid">
            {DAYS.map((d, i) => (
              <div key={i} className={`datepicker-dow${i === 0 ? " datepicker-sun" : i === 6 ? " datepicker-sat" : ""}`}>{d}</div>
            ))}
            {cells.map((day, i) => {
              if (!day) return <div key={i} />;
              const str = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const isToday = str === todayStr;
              const isSelected = str === selectedStr;
              const isSun = (i % 7) === 0;
              const isSat = (i % 7) === 6;
              return (
                <button
                  key={i}
                  className={[
                    "datepicker-day",
                    isToday ? "datepicker-today" : "",
                    isSelected ? "datepicker-selected" : "",
                    isSun ? "datepicker-sun" : "",
                    isSat ? "datepicker-sat" : "",
                  ].filter(Boolean).join(" ")}
                  onClick={() => selectDay(day)}
                >
                  {day}
                </button>
              );
            })}
          </div>

          <div className="datepicker-footer">
            <button className="datepicker-today-btn" onClick={() => { onChange(todayStr); setOpen(false); }}>今日</button>
            <button className="datepicker-tomorrow-btn" onClick={() => {
              const t = new Date(today); t.setDate(t.getDate() + 1);
              onChange(toLocalDateStr(t)); setOpen(false);
            }}>明日</button>
          </div>
        </div>
      )}
    </div>
  );
}
