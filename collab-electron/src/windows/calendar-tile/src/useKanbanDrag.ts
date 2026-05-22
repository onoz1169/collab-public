import { useState, useRef, useCallback } from "react";
import type { Project, ProjectStatus, KanbanData } from "./kanbanTypes";

interface DragState {
  projectId: string;
  overStatus: ProjectStatus | null;
  overProjectId: string | null;
  insertBefore: boolean;
}

export function useKanbanDrag(projects: Project[], onChange: (data: KanbanData) => void) {
  const dragRef = useRef<DragState | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<ProjectStatus | null>(null);
  const [draggingProjectId, setDraggingProjectId] = useState<string | null>(null);
  const [dropOverProjectId, setDropOverProjectId] = useState<string | null>(null);
  const [dropInsertBefore, setDropInsertBefore] = useState(true);

  const reorderProject = useCallback((
    projectId: string,
    targetStatus: ProjectStatus,
    overProjectId: string | null,
    insertBefore: boolean,
  ) => {
    const dragged = projects.find((p) => p.id === projectId);
    if (!dragged) return;
    const updated = { ...dragged, status: targetStatus };
    const without = projects.filter((p) => p.id !== projectId);
    if (!overProjectId) { onChange({ projects: [...without, updated] }); return; }
    const idx = without.findIndex((p) => p.id === overProjectId);
    if (idx === -1) { onChange({ projects: [...without, updated] }); return; }
    const at = insertBefore ? idx : idx + 1;
    onChange({ projects: [...without.slice(0, at), updated, ...without.slice(at)] });
  }, [projects, onChange]);

  const onPointerDown = useCallback((e: React.PointerEvent, projectId: string) => {
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { projectId, overStatus: null, overProjectId: null, insertBefore: true };
    setDraggingProjectId(projectId);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const { projectId } = dragRef.current;
    const els = document.elementsFromPoint(e.clientX, e.clientY);
    let foundSection: ProjectStatus | null = null;
    let foundProjectId: string | null = null;
    let foundInsertBefore = true;
    for (const el of els) {
      const h = el as HTMLElement;
      if (!foundSection && h.dataset["section"]) foundSection = h.dataset["section"] as ProjectStatus;
      if (!foundProjectId && h.dataset["projectId"] && h.dataset["projectId"] !== projectId) {
        foundProjectId = h.dataset["projectId"];
        const rect = h.getBoundingClientRect();
        foundInsertBefore = e.clientY < rect.top + rect.height / 2;
      }
    }
    const prev = dragRef.current;
    if (prev.overStatus !== foundSection || prev.overProjectId !== foundProjectId || prev.insertBefore !== foundInsertBefore) {
      dragRef.current = { ...prev, overStatus: foundSection, overProjectId: foundProjectId, insertBefore: foundInsertBefore };
      setDragOverStatus(foundSection);
      setDropOverProjectId(foundProjectId);
      setDropInsertBefore(foundInsertBefore);
    }
  }, []);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const { projectId, overStatus, overProjectId, insertBefore } = dragRef.current;
    dragRef.current = null;
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    if (overStatus) reorderProject(projectId, overStatus, overProjectId, insertBefore);
    setDraggingProjectId(null);
    setDragOverStatus(null);
    setDropOverProjectId(null);
  }, [reorderProject]);

  const onPointerCancel = useCallback(() => {
    dragRef.current = null;
    setDraggingProjectId(null);
    setDragOverStatus(null);
    setDropOverProjectId(null);
  }, []);

  return { dragOverStatus, draggingProjectId, dropOverProjectId, dropInsertBefore, onPointerDown, onPointerMove, onPointerUp, onPointerCancel };
}
