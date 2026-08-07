import type { AdapterDefinition } from '../types/adapter-definition'

const modules = import.meta.glob('../../local_adapters/*.json', { eager: true }) as Record<string, { default: unknown }>

export const adapterDefinitions: AdapterDefinition[] = Object.values(modules)
  .map((m) => m.default as AdapterDefinition)
  .filter((d): d is AdapterDefinition => d != null && typeof d === 'object' && typeof (d as unknown as Record<string, unknown>).id === 'string')

export function getAdapterDefinition(id: string): AdapterDefinition | undefined {
  return adapterDefinitions.find((d) => d.id === id)
}

export function getAdapterDefinitionIds(): string[] {
  return adapterDefinitions.map((d) => d.id)
}
