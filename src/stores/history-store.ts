import { create } from 'zustand'
import { useProjectStore } from './project-store'
import type { Project } from '../types/project'

const CAPACITY = 50

interface HistoryState {
  snapshots: Project[]
  index: number // cursor position for undo/redo, -1 when empty

  // Derived
  canUndo: boolean
  canRedo: boolean

  // Mutation boundary tracking
  _beforeSnapshot: Project | null

  // Actions
  pushSnapshot: (project: Project) => void
  undo: () => Project | null
  redo: () => Project | null
  clear: () => void
  captureBeforeMutation: () => void
  commitMutation: () => void
  abortMutation: () => void
}

export const useHistoryStore = create<HistoryState>()((set, get) => ({
  snapshots: [],
  index: -1,
  canUndo: false,
  canRedo: false,
  _beforeSnapshot: null,

  pushSnapshot: (project: Project) => {
    const state = get()
    const clone = structuredClone(project)

    // Discard redo history if we aren't at the tip.
    let next = state.snapshots
    if (state.index < state.snapshots.length - 1) {
      next = state.snapshots.slice(0, state.index + 1)
    } else {
      next = [...state.snapshots]
    }

    next.push(clone)

    // Enforce capacity (drop oldest).
    let nextIndex = next.length - 1
    if (next.length > CAPACITY) {
      next.shift()
      nextIndex--
    }

    set({
      snapshots: next,
      index: nextIndex,
      canUndo: nextIndex > 0,
      canRedo: false,
    })
  },

  undo: () => {
    const state = get()
    if (state.index <= 0) return null

    const newIndex = state.index - 1
    const snapshot = state.snapshots[newIndex]
    if (!snapshot) return null

    set({
      index: newIndex,
      canUndo: newIndex > 0,
      canRedo: true,
    })

    return structuredClone(snapshot)
  },

  redo: () => {
    const state = get()
    if (state.index >= state.snapshots.length - 1) return null

    const newIndex = state.index + 1
    const snapshot = state.snapshots[newIndex]
    if (!snapshot) return null

    set({
      index: newIndex,
      canUndo: newIndex > 0,
      canRedo: newIndex < state.snapshots.length - 1,
    })

    return structuredClone(snapshot)
  },

  clear: () => {
    set({
      snapshots: [],
      index: -1,
      canUndo: false,
      canRedo: false,
      _beforeSnapshot: null,
    })
  },

  captureBeforeMutation: () => {
    const project = useProjectStore.getState().currentProject
    if (!project) return
    set({ _beforeSnapshot: structuredClone(project) })
  },

  commitMutation: () => {
    const state = get()
    const { _beforeSnapshot } = state

    if (_beforeSnapshot) {
      // Push the before state first if this is the first snapshot
      if (state.snapshots.length === 0) {
        get().pushSnapshot(_beforeSnapshot)
      }
    }

    const project = useProjectStore.getState().currentProject
    if (project) {
      get().pushSnapshot(project)
    }

    set({ _beforeSnapshot: null })
  },

  abortMutation: () => {
    set({ _beforeSnapshot: null })
  },
}))
