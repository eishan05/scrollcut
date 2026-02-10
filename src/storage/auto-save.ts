import { getDB } from './db'
import { saveProject } from './project-persistence'
import type { Project } from '../types/project'

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
}

export function scheduleSave(project: Project): void {
  lastProject = project
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(async () => {
    if (lastProject) {
      await performSave(lastProject)
    }
  }, AUTO_SAVE_DEBOUNCE)
}

export function startPeriodicSave(getProject: () => Project | null): void {
  stopPeriodicSave()
  periodicTimer = setInterval(async () => {
    const project = getProject()
    if (project) {
      await performSave(project)
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
  if (debounceTimer) clearTimeout(debounceTimer)
  await performSave(project)
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
