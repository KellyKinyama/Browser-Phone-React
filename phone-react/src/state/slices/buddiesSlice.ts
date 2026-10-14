import type { Buddy } from "../../types/buddy";
import { buddiesRepo, messagesRepo } from "../../services/db";
import { createBuddy, type BuddySortBy, type NewBuddyInput } from "../../services/buddies";
import type { AppStateCreator } from "../types";

export interface BuddiesSlice {
  buddies: Buddy[];
  selectedBuddyId: string | null;
  searchTerm: string;
  sortBy: BuddySortBy;
  loadBuddies: () => Promise<void>;
  addBuddy: (input: NewBuddyInput) => Promise<Buddy>;
  updateBuddy: (identity: string, patch: Partial<Buddy>) => Promise<void>;
  removeBuddy: (identity: string) => Promise<void>;
  togglePin: (identity: string) => Promise<void>;
  selectBuddy: (identity: string) => void;
  setSearchTerm: (term: string) => void;
  setSortBy: (sortBy: BuddySortBy) => void;
}

export const createBuddiesSlice: AppStateCreator<BuddiesSlice> = (set, get) => ({
  buddies: [],
  selectedBuddyId: null,
  searchTerm: "",
  sortBy: "activity",

  loadBuddies: async () => {
    const buddies = await buddiesRepo.getAll();
    set({ buddies }, false, "buddies/load");
  },

  addBuddy: async (input) => {
    const buddy = createBuddy(input);
    await buddiesRepo.put(buddy);
    set((s) => ({ buddies: [...s.buddies, buddy] }), false, "buddies/add");
    return buddy;
  },

  updateBuddy: async (identity, patch) => {
    const existing = get().buddies.find((b) => b.identity === identity);
    if (!existing) return;
    const next = { ...existing, ...patch };
    await buddiesRepo.put(next);
    set(
      (s) => ({ buddies: s.buddies.map((b) => (b.identity === identity ? next : b)) }),
      false,
      "buddies/update"
    );
  },

  removeBuddy: async (identity) => {
    await buddiesRepo.remove(identity);
    await messagesRepo.clearBuddy(identity);
    set(
      (s) => ({
        buddies: s.buddies.filter((b) => b.identity !== identity),
        selectedBuddyId: s.selectedBuddyId === identity ? null : s.selectedBuddyId
      }),
      false,
      "buddies/remove"
    );
  },

  togglePin: async (identity) => {
    const existing = get().buddies.find((b) => b.identity === identity);
    if (!existing) return;
    await get().updateBuddy(identity, { pinned: !existing.pinned });
  },

  selectBuddy: (identity) =>
    set(
      { selectedBuddyId: identity, selectedLineNumber: null, chatSelectedPeer: null },
      false,
      "buddies/select"
    ),

  setSearchTerm: (searchTerm) => set({ searchTerm }, false, "buddies/setSearchTerm"),

  setSortBy: (sortBy) => set({ sortBy }, false, "buddies/setSortBy")
});
