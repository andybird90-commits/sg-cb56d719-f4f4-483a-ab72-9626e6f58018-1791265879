import { create } from "zustand";

interface ContractorSelectionStore {
  selectedIds: string[];
  toggle: (id: string) => void;
  selectAll: (ids: string[]) => void;
  clearSelection: () => void;
  isSelected: (id: string) => boolean;
}

export const useContractorSelection = create<ContractorSelectionStore>((set, get) => ({
  selectedIds: [],

  toggle: (id: string) => {
    set((state) => {
      const isCurrentlySelected = state.selectedIds.includes(id);
      if (isCurrentlySelected) {
        return {
          selectedIds: state.selectedIds.filter((selectedId) => selectedId !== id),
        };
      } else {
        return {
          selectedIds: [...state.selectedIds, id],
        };
      }
    });
  },

  selectAll: (ids: string[]) => {
    set({ selectedIds: ids });
  },

  clearSelection: () => {
    set({ selectedIds: [] });
  },

  isSelected: (id: string) => {
    return get().selectedIds.includes(id);
  },
}));