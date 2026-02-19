import { useState, useCallback, useMemo } from 'react';

export interface UseSelectionReturn {
  selectedIds: Set<string>;
  isSelected: (id: string) => boolean;
  toggle: (id: string) => void;
  toggleMultiple: (ids: string[]) => void;
  selectAll: (ids: string[]) => void;
  clearAll: () => void;
  count: number;
  isAllSelected: (ids: string[]) => boolean;
  isPartiallySelected: (ids: string[]) => boolean;
  selectedArray: string[];
}

export function useSelection(): UseSelectionReturn {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const isSelected = useCallback(
    (id: string) => selectedIds.has(id),
    [selectedIds]
  );

  const toggle = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const toggleMultiple = useCallback((ids: string[]) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const allSelected = ids.every((id) => next.has(id));
      
      if (allSelected) {
        ids.forEach((id) => next.delete(id));
      } else {
        ids.forEach((id) => next.add(id));
      }
      return next;
    });
  }, []);

  const selectAll = useCallback((ids: string[]) => {
    setSelectedIds(new Set(ids));
  }, []);

  const clearAll = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const count = selectedIds.size;

  const isAllSelected = useCallback(
    (ids: string[]) => ids.length > 0 && ids.every((id) => selectedIds.has(id)),
    [selectedIds]
  );

  const isPartiallySelected = useCallback(
    (ids: string[]) => {
      const selectedCount = ids.filter((id) => selectedIds.has(id)).length;
      return selectedCount > 0 && selectedCount < ids.length;
    },
    [selectedIds]
  );

  const selectedArray = useMemo(() => Array.from(selectedIds), [selectedIds]);

  return {
    selectedIds,
    isSelected,
    toggle,
    toggleMultiple,
    selectAll,
    clearAll,
    count,
    isAllSelected,
    isPartiallySelected,
    selectedArray,
  };
}
