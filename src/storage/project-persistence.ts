import { getDB } from './db'
import type { Project } from '../types/project'
import type { MediaAsset } from '../types/media'

export async function saveProject(project: Project): Promise<void> {
  const db = await getDB()
  await db.put('projects', project)
}

export async function loadProject(id: string): Promise<Project | undefined> {
  const db = await getDB()
  return db.get('projects', id)
}

export async function deleteProject(id: string): Promise<void> {
  const db = await getDB()
  const tx = db.transaction(['projects', 'mediaAssets'], 'readwrite')
  // Delete project
  await tx.objectStore('projects').delete(id)
  // Delete associated media assets
  const assets = await tx.objectStore('mediaAssets').index('by-project').getAllKeys(id)
  for (const key of assets) {
    await tx.objectStore('mediaAssets').delete(key)
  }
  await tx.done
}

export async function listProjects(): Promise<Project[]> {
  const db = await getDB()
  const projects = await db.getAllFromIndex('projects', 'by-updated')
  // Return newest first
  return projects.reverse()
}

export async function saveMediaAsset(asset: MediaAsset): Promise<void> {
  const db = await getDB()
  await db.put('mediaAssets', asset)
}

export async function getMediaAsset(id: string): Promise<MediaAsset | undefined> {
  const db = await getDB()
  return db.get('mediaAssets', id)
}

export async function getProjectMediaAssets(projectId: string): Promise<MediaAsset[]> {
  const db = await getDB()
  return db.getAllFromIndex('mediaAssets', 'by-project', projectId)
}

export async function deleteMediaAsset(id: string): Promise<void> {
  const db = await getDB()
  await db.delete('mediaAssets', id)
}
