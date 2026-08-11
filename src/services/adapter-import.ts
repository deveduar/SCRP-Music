import { validateAdapterDefinition } from './adapter-schema'
import {
  getBuiltinDefinition,
  hasCustomDefinition,
  registerCustomDefinition,
} from './adapter-registry'
import { createAdapterFromDef } from './adapter-engine'
import { saveCustomAdapter } from '../storage/db'
import { useScraperStore } from '../stores/scraper'

export interface AdapterImportResult {
  imported: number
  skipped: number
  invalid: number
}

export async function importAdapterDefs(raw: unknown): Promise<AdapterImportResult> {
  let defs: unknown[] = []
  if (Array.isArray(raw)) {
    defs = raw
  } else if (raw && typeof raw === 'object') {
    const wrapper = raw as { adapters?: unknown }
    if (Array.isArray(wrapper.adapters)) {
      defs = wrapper.adapters
    } else {
      defs = [raw]
    }
  }

  let imported = 0
  let skipped = 0
  let invalid = 0
  const now = new Date().toISOString()

  for (const rawDef of defs) {
    const v = validateAdapterDefinition(rawDef)
    if (!v.ok || !v.def) {
      invalid++
      continue
    }
    const target = v.def
    if (getBuiltinDefinition(target.id) || hasCustomDefinition(target.id)) {
      skipped++
      continue
    }
    await saveCustomAdapter({
      id: target.id,
      name: target.name,
      def: target,
      createdAt: now,
      updatedAt: now,
    })
    registerCustomDefinition(target)
    useScraperStore.getState().registerAdapter(createAdapterFromDef(target) as never)
    imported++
  }

  return { imported, skipped, invalid }
}
