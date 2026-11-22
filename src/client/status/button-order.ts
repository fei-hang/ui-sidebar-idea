/* Mirrors panel-pins.ts in this package: the same snapshot-store projection and the same in-memory lifetime. */

/**
 * Activity-rail button order, held in memory until the plugin reloads.
 *
 * The slot ledger orders list entries by `order` and then by registration
 * sequence; a drag has to survive re-registration, so the rail keeps the ids
 * it has seen in the order the user left them and appends newcomers after the
 * ones it already knows. An id that disappears drops out of the stored order
 * and returns at its registration position if it comes back.
 */
import { createSnapshotStore, type ObservableSnapshot } from '@deepseek-ai/dsh-client-store'

/** One rail, addressed independently so the two ends keep separate orders. */
export type ButtonRail = 'top' | 'tail'

/** Stored drag order per rail. */
export interface ButtonOrder {
  /** Per-rail ids in the order the user left them. */
  readonly order: ObservableSnapshot<Readonly<Record<ButtonRail, readonly string[]>>>
  /** Selected rail id, or null while the rail shows the panel list. */
  readonly selected: ObservableSnapshot<string | null>
  /**
   * Move `id` to the position of `beforeId` on one rail.
   * @param rail - Rail being reordered.
   * @param id - Id being moved.
   * @param beforeId - Id the moved button now sits before; null appends.
   */
  readonly move: (rail: ButtonRail, id: string, beforeId: string | null) => void
  /**
   * Adopt the rail's current render order before a drag rewrites it.
   *
   * A stored list only holds ids the user has dragged, so it is usually shorter
   * than what is on screen; moving against such a list appends the rest and the
   * drag appears to do nothing. Seeding first makes the drag operate on the
   * order the user can actually see.
   * @param rail - Rail whose render order is being adopted.
   * @param ids - Ids in the order they are drawn right now.
   */
  readonly seed: (rail: ButtonRail, ids: readonly string[]) => void
  /**
   * Select a rail id, or clear the selection.
   * @param id - Id to select; null returns the rail to the panel list.
   */
  readonly select: (id: string | null) => void
}

const EMPTY: Readonly<Record<ButtonRail, readonly string[]>> = { top: [], tail: [] }

interface RailState {
  readonly order: Readonly<Record<ButtonRail, readonly string[]>>
  readonly selected: string | null
}

/**
 * Create the rail store.
 * @returns The stored order, the selection, and their actions.
 */
export function createButtonOrder(): ButtonOrder {
  const store = createSnapshotStore<RailState>({ order: EMPTY, selected: null })
  const move: ButtonOrder['move'] = (rail, id, beforeId) => {
    if (id === beforeId) return
    const { order } = store.getSnapshot()
    const current = order[rail]
    const next = current.filter(entry => entry !== id)
    const at = beforeId === null ? -1 : next.indexOf(beforeId)
    next.splice(at === -1 ? next.length : at, 0, id)
    if (next.length === current.length && next.every((entry, index) => entry === current[index])) return
    store.set({ ...store.getSnapshot(), order: { ...order, [rail]: next } })
  }
  const seed: ButtonOrder['seed'] = (rail, ids) => {
    const { order } = store.getSnapshot()
    const current = order[rail]
    // The rendered order wins outright here; orderRail would put stored ids
    // first, which is exactly the mismatch seeding is meant to remove. Stored
    // ids the rail no longer shows are kept on the end so a button that is
    // temporarily unregistered keeps its place.
    const next = [...ids, ...current.filter(id => !ids.includes(id))]
    if (next.length === current.length && next.every((entry, index) => entry === current[index])) return
    store.set({ ...store.getSnapshot(), order: { ...order, [rail]: next } })
  }
  return {
    order: {
      getSnapshot: () => store.getSnapshot().order,
      subscribe: listener => store.subscribe(listener),
    },
    selected: {
      getSnapshot: () => store.getSnapshot().selected,
      subscribe: listener => store.subscribe(listener),
    },
    move,
    seed,
    select: (id) => {
      if (store.getSnapshot().selected === id) return
      store.set({ ...store.getSnapshot(), selected: id })
    },
  }
}

/**
 * Project one rail's registrations into the user's order.
 *
 * Ids the user has never dragged keep their registration sequence behind the
 * ones already ordered, so a plugin that registers late does not jump to the
 * front of a rail the user has arranged.
 * @param registered - Registration-ordered ids from the slot ledger.
 * @param stored - Ids in the order the user left them.
 * @returns Ids in render order.
 */
export function orderRail(registered: readonly string[], stored: readonly string[]): readonly string[] {
  const known = stored.filter(id => registered.includes(id))
  const fresh = registered.filter(id => !known.includes(id))
  return [...known, ...fresh]
}
