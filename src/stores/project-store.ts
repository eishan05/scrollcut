import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import type { Project, Clip, TextOverlay } from '../types/project'
import type { AspectRatio } from '../types/common'
import { newId } from '../utils/id'

interface ProjectState {
  currentProject: Project | null
  isDirty: boolean

  // Project lifecycle
  setProject: (project: Project | null) => void
  createProject: (name: string, aspectRatio: AspectRatio) => Project
  markSaved: () => void
  markDirty: () => void

  // Project mutations
  setName: (name: string) => void
  setAspectRatio: (ratio: AspectRatio) => void

  // Clip mutations
  addClip: (clip: Clip) => void
  removeClip: (clipId: string) => void
  updateClip: (clipId: string, updates: Partial<Clip>) => void
  reorderClips: (clips: Clip[]) => void
  // Overlay mutations
  addOverlay: (overlay: TextOverlay) => void
  removeOverlay: (overlayId: string) => void
  updateOverlay: (overlayId: string, updates: Partial<TextOverlay>) => void
}

function mutateProject(state: ProjectState, updater: (project: Project) => Partial<Project>): Partial<ProjectState> {
  if (!state.currentProject) return {}
  const updates = updater(state.currentProject)
  return {
    currentProject: { ...state.currentProject, ...updates, updatedAt: Date.now() },
    isDirty: true,
  }
}

export const useProjectStore = create<ProjectState>()(
  subscribeWithSelector((set) => ({
    currentProject: null,
    isDirty: false,

    setProject: (project) => set({ currentProject: project, isDirty: false }),

    createProject: (name, aspectRatio) => {
      const project: Project = {
        id: newId('project'),
        name,
        aspectRatio,
        timeline: { clips: [], overlays: [] },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      set({ currentProject: project, isDirty: true })
      return project
    },

    markSaved: () => set({ isDirty: false }),
    markDirty: () => set({ isDirty: true }),

    setName: (name) => set((state) => mutateProject(state, () => ({ name }))),
    setAspectRatio: (aspectRatio) => set((state) => mutateProject(state, () => ({ aspectRatio }))),

    addClip: (clip) => set((state) => mutateProject(state, (p) => ({
      timeline: { ...p.timeline, clips: [...p.timeline.clips, clip] },
    }))),

    removeClip: (clipId) => set((state) => mutateProject(state, (p) => ({
      timeline: { ...p.timeline, clips: p.timeline.clips.filter((c) => c.id !== clipId) },
    }))),

    updateClip: (clipId, updates) => set((state) => mutateProject(state, (p) => ({
      timeline: {
        ...p.timeline,
        clips: p.timeline.clips.map((c) => (c.id === clipId ? { ...c, ...updates } : c)),
      },
    }))),

    reorderClips: (clips) => set((state) => mutateProject(state, () => ({
      timeline: { ...state.currentProject!.timeline, clips },
    }))),

    addOverlay: (overlay) => set((state) => mutateProject(state, (p) => ({
      timeline: { ...p.timeline, overlays: [...p.timeline.overlays, overlay] },
    }))),

    removeOverlay: (overlayId) => set((state) => mutateProject(state, (p) => ({
      timeline: { ...p.timeline, overlays: p.timeline.overlays.filter((o) => o.id !== overlayId) },
    }))),

    updateOverlay: (overlayId, updates) => set((state) => mutateProject(state, (p) => ({
      timeline: {
        ...p.timeline,
        overlays: p.timeline.overlays.map((o) => (o.id === overlayId ? { ...o, ...updates } : o)),
      },
    }))),
  })),
)
