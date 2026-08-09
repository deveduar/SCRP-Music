import { create } from 'zustand'
import { checkRelayHealth, isProduction, isVercelDeployment } from '../services/cors-proxy'

export type Deployment = 'dev' | 'vercel' | 'self-host'

function detectDeployment(): Deployment {
  if (typeof window === 'undefined') return 'dev'
  if (!isProduction()) return 'dev'
  return isVercelDeployment() ? 'vercel' : 'self-host'
}

interface NetworkState {
  env: 'dev' | 'prod'
  deployment: Deployment
  relayAvailable: boolean | null
  checking: boolean
  check: () => Promise<void>
}

export const useNetworkStore = create<NetworkState>((set) => ({
  env: typeof window !== 'undefined' && isProduction() ? 'prod' : 'dev',
  deployment: detectDeployment(),
  relayAvailable: null,
  checking: false,

  check: async () => {
    set({ checking: true, env: isProduction() ? 'prod' : 'dev', deployment: detectDeployment() })
    const available = await checkRelayHealth()
    set({ relayAvailable: available, checking: false })
  },
}))
