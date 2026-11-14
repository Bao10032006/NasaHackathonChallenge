import { createContext, useContext, type ReactNode } from 'react'
import { api } from '../api/client'
import type { AreaListResponse, MetadataResponse } from '../api/types'
import { useApi, type ApiState } from '../lib/useApi'
import { useAppState } from './AppState'

/** /metadata and /areas are loaded once per data source and shared by every screen. */
interface SnapshotContextValue {
  metadata: ApiState<MetadataResponse> & { retry: () => void }
  areas: ApiState<AreaListResponse> & { retry: () => void }
}

const SnapshotContext = createContext<SnapshotContextValue | null>(null)

export function SnapshotProvider({ children }: { children: ReactNode }) {
  const { dataSource } = useAppState()
  const metadata = useApi(api.metadata(dataSource))
  const areas = useApi(api.areas(dataSource))
  return <SnapshotContext.Provider value={{ metadata, areas }}>{children}</SnapshotContext.Provider>
}

export function useSnapshot(): SnapshotContextValue {
  const value = useContext(SnapshotContext)
  if (!value) {
    throw new Error('useSnapshot must be used inside SnapshotProvider')
  }
  return value
}

export function useMetadata(): MetadataResponse | null {
  const { metadata } = useSnapshot()
  return metadata.status === 'success' ? metadata.data : null
}

/** Warning copy comes from /metadata warningCatalog keyed by the stable code (wireframe v0.4 section 10). */
export function useWarningMessage(): (code: string) => string {
  const metadata = useMetadata()
  return (code) => metadata?.warningCatalog.find((warning) => warning.code === code)?.message ?? code
}
