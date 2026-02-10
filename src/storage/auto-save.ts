import { getDB } from './db'
import { saveProject } from './project-persistence'
import type { Project } from '../types/project'
import { useProjectStore } from '../stores/project-store'

const AUTO_SAVE_DEBOUNCE = 2000
const AUTO_SAVE_PERIODIC = 30000
const AUTO_SAVE_KEY = 'current'

let debounceTimer: ReturnType<typeof setTimeout> | null = null
let periodicTimer: ReturnType<typeof setInterval> | null = null
let lastProject: Project | null = null

async function writeAutoSave(project: Project): Promise<void> {
  const db = await getDB()
  await db.put('autoSave', {
    key: AUTO_SAVE_KEY,
    project,
    savedAt: Date.now(),
  }, AUTO_SAVE_KEY)
}

async function performSave(project: Project): Promise<void> {
  await saveProject(project)
  await writeAutoSave(project)

  // Only clear dirty if we saved the latest version still in the store.
  const state = useProjectStore.getState()
  if (state.currentProject?.id === project.id && state.currentProject.updatedAt === project.updatedAt) {
    state.markSaved()
  }
}

export function scheduleSave(project: Project): void {
  lastProject = project
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(async () => {
    debounceTimer = null
    if (!lastProject) return
    try {
      await performSave(lastProject)
    } catch (err) {
      console.error('[auto-save] debounced save failed', err)
    }
  }, AUTO_SAVE_DEBOUNCE)
}

export function startPeriodicSave(): void {
  stopPeriodicSave()
  periodicTimer = setInterval(async () => {
    const { currentProject, isDirty } = useProjectStore.getState()
    if (!currentProject || !isDirty) return
    try {
      await performSave(currentProject)
    } catch (err) {
      console.error('[auto-save] periodic save failed', err)
    }
  }, AUTO_SAVE_PERIODIC)
}

export function stopPeriodicSave(): void {
  if (periodicTimer) {
    clearInterval(periodicTimer)
    periodicTimer = null
  }
}

export async function saveImmediately(project: Project): Promise<void> {
  if (debounceTimer) {
    clearTimeout(debounceTimer)
    debounceTimer = null
  }
  try {
    await performSave(project)
  } catch (err) {
    console.error('[auto-save] immediate save failed', err)
  }
}

export async function recoverAutoSave(): Promise<Project | null> {
  try {
    const db = await getDB()
    const record = await db.get('autoSave', AUTO_SAVE_KEY)
    return record?.project ?? null
  } catch {
    return null
  }
}

export async function clearAutoSave(): Promise<void> {
  try {
    const db = await getDB()
    await db.delete('autoSave', AUTO_SAVE_KEY)
  } catch {
    // Best effort
  }
}
