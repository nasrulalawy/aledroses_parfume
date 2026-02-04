import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthContext } from '@/contexts/AuthContext'
import type { Outlet } from '@/types/database'

const STORAGE_KEY = 'aledroses_selected_outlet'

type OutletContextType = {
  outletId: string | null
  outlet: Outlet | null
  outlets: Outlet[]
  setOutletId: (id: string | null) => void
  isSuperAdmin: boolean
  loading: boolean
}

const OutletContext = createContext<OutletContextType | null>(null)

export function OutletProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuthContext()
  const [outlets, setOutlets] = useState<Outlet[]>([])
  const [outlet, setOutlet] = useState<Outlet | null>(null)
  const [selectedOutletId, setSelectedOutletId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null
    return window.localStorage.getItem(STORAGE_KEY)
  })
  const [loading, setLoading] = useState(true)

  const isSuperAdmin = profile?.role === 'super_admin'

  useEffect(() => {
    if (!profile) {
      setOutlets([])
      setOutlet(null)
      setSelectedOutletId(null)
      setLoading(false)
      return
    }

    if (isSuperAdmin) {
      supabase
        .from('outlets')
        .select('*')
        .eq('is_active', true)
        .order('name')
        .then(({ data }) => {
          const list = (data as Outlet[]) ?? []
          setOutlets(list)
          const stored = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY) : null
          const id = stored && list.some((o) => o.id === stored) ? stored : list[0]?.id ?? null
          setSelectedOutletId(id)
          setOutlet(list.find((o) => o.id === id) ?? list[0] ?? null)
          setLoading(false)
        })
    } else if (profile.employee_id) {
      Promise.resolve(
        supabase
          .from('employees')
          .select('outlet_id, outlets(id, name, code, address, is_active, created_at, updated_at)')
          .eq('id', profile.employee_id)
          .single()
      )
        .then(({ data }) => {
          const row = data as { outlet_id: string; outlets: Outlet } | null
          if (row?.outlet_id) {
            setSelectedOutletId(row.outlet_id)
            if (row.outlets) {
              setOutlet(row.outlets)
              setOutlets([row.outlets])
            } else {
              setOutlets([])
            }
          } else {
            setOutlet(null)
            setSelectedOutletId(null)
            setOutlets([])
          }
        })
        .finally(() => setLoading(false))
    } else {
      setOutlet(null)
      setSelectedOutletId(null)
      setOutlets([])
      setLoading(false)
    }
  }, [profile?.id, profile?.role, profile?.employee_id, isSuperAdmin])

  useEffect(() => {
    if (!isSuperAdmin || !selectedOutletId) return
    const o = outlets.find((x) => x.id === selectedOutletId)
    setOutlet(o ?? null)
    if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE_KEY, selectedOutletId)
  }, [selectedOutletId, outlets, isSuperAdmin])

  const value = useMemo<OutletContextType>(
    () => ({
      outletId: selectedOutletId,
      outlet,
      outlets,
      setOutletId: setSelectedOutletId,
      isSuperAdmin,
      loading,
    }),
    [selectedOutletId, outlet, outlets, isSuperAdmin, loading]
  )

  return <OutletContext.Provider value={value}>{children}</OutletContext.Provider>
}

export function useOutlet() {
  const ctx = useContext(OutletContext)
  if (!ctx) throw new Error('useOutlet must be used within OutletProvider')
  return ctx
}
