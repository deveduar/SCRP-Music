import { adapterDefinitions } from './adapter-definitions'
import type { AdapterDefinition } from '../types/adapter-definition'

const customDefinitions = new Map<string, AdapterDefinition>()

export function getAllDefinitions(): AdapterDefinition[] {
  const merged = [...adapterDefinitions]
  for (const def of customDefinitions.values()) {
    const idx = merged.findIndex((d) => d.id === def.id)
    if (idx >= 0) {
      merged[idx] = def
    } else {
      merged.push(def)
    }
  }
  return merged
}

export function getDefinition(id: string): AdapterDefinition | undefined {
  return customDefinitions.get(id) ?? adapterDefinitions.find((d) => d.id === id)
}

export function getBuiltinDefinition(id: string): AdapterDefinition | undefined {
  return adapterDefinitions.find((d) => d.id === id)
}

export function hasCustomDefinition(id: string): boolean {
  return customDefinitions.has(id)
}

export function registerCustomDefinition(def: AdapterDefinition): void {
  customDefinitions.set(def.id, def)
}

export function unregisterCustomDefinition(id: string): void {
  customDefinitions.delete(id)
}

export function clearCustomDefinitions(): void {
  customDefinitions.clear()
}
