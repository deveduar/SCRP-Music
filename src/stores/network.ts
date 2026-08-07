import { create } from 'zustand'
import { checkRelayHealth, isProduction } from '../services/cors-proxy'

interface NetworkState {
  env: 'dev' | 'prod'
  relayAvailable: boolean | null
  checking: boolean
  check: () => Promise<void>
}

export const useNetworkStore = create<NetworkState>((set) => ({
  env: typeof window !== 'undefined' && isProduction() ? 'prod' : 'dev',
  relayAvailable: null,
  checking: false,

  check: async () => {
    set({ checking: true, env: isProduction() ? 'prod' : 'dev' })
    const available = await checkRelayHealth()
    set({ relayAvailable: available, checking: false })
  },
}))
