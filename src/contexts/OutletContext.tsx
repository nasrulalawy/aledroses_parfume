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
  const { profile, refetchProfile } = useAuthContext()
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
      const timeout = setTimeout(() => setLoading(false), 8000)
      const setOutletList = (list: Outlet[]) => {
        setOutlets(list)
        const stored = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY) : null
        const id = stored && list.some((o) => o.id === stored) ? stored : list[0]?.id ?? null
        setSelectedOutletId(id)
        setOutlet(list.find((o) => o.id === id) ?? list[0] ?? null)
      }
      const toOutlet = (r: Record<string, unknown>): Outlet => ({
        id: r.id as string,
        name: r.name as string,
        code: (r.code as string) ?? null,
        address: (r.address as string) ?? null,
        outlet_type: (r.outlet_type as Outlet['outlet_type']) ?? 'parfume',
        is_active: r.is_active !== undefined ? Boolean(r.is_active) : true,
        created_at: (r.created_at as string) ?? '',
        updated_at: (r.updated_at as string) ?? '',
      })
      // Hanya id + name supaya tidak 400 (kolom lain bisa belum ada di DB)
      void Promise.resolve(
        supabase.from('outlets').select('id, name').order('name')
      ).then(({ data, error }) => {
        if (error || !data || !Array.isArray(data)) {
          setOutletList([])
          return
        }
        const list = (data as Record<string, unknown>[]).map((r) =>
          toOutlet({ ...r, code: null, address: null, is_active: true, created_at: '', updated_at: '' })
        )
        setOutletList(list.map((o) => ({ ...o, outlet_type: 'parfume' as const })))
      }).catch(() => setOutletList([])).finally(() => {
        clearTimeout(timeout)
        setLoading(false)
      })
    } else {
      // Karyawan/manager: ambil outlet dari data karyawan.
      // Timeout agar tidak macet "Memuat..." kalau request hang (mis. 304/cache)
      const timeout = setTimeout(() => setLoading(false), 8000)
      const done = () => {
        clearTimeout(timeout)
        setLoading(false)
      }
      type EmployeeRow = { id: string; outlet_id: string; outlets?: Outlet | null }
      const selectCols = 'id, outlet_id, outlets(id, name, address, outlet_type, is_active, created_at, updated_at)'
      const selectMinimal = 'id, outlet_id'

      const applyEmployeeRow = (row: EmployeeRow | null, fromFallback: boolean) => {
        if (row?.outlet_id) {
          setSelectedOutletId(row.outlet_id)
          if (row.outlets) {
            setOutlet(row.outlets)
            setOutlets([row.outlets])
          } else {
            setOutlets([])
            // Embed outlets bisa null karena RLS; fetch outlet by id agar kasir tetap dapat outlet
            void Promise.resolve(
              supabase.from('outlets').select('id, name, outlet_type').eq('id', row.outlet_id).maybeSingle()
            ).then(({ data: o }) => {
              if (o) {
                const outletType = (o as { outlet_type?: string }).outlet_type === 'barbershop' ? 'barbershop' : 'parfume'
                const out: Outlet = {
                  ...o,
                  code: null,
                  address: null,
                  outlet_type: outletType,
                  is_active: true,
                  created_at: '',
                  updated_at: '',
                } as Outlet
                setOutlet(out)
                setOutlets([out])
              }
            }).catch(() => {})
          }
          if (fromFallback && row.id && profile) {
            void supabase.from('profiles').update({ employee_id: row.id }).eq('id', profile.id)
          }
        } else {
          setOutlet(null)
          setSelectedOutletId(null)
          setOutlets([])
        }
      }

      function fetchEmployeeAndApply(byId: boolean) {
        const pid = profile?.id
        const eid = profile?.employee_id
        if (!pid && !eid) {
          done()
          return
        }
        const q = byId && eid
          ? supabase.from('employees').select(selectCols).eq('id', eid).single()
          : supabase.from('employees').select(selectCols).eq('profile_id', pid!).maybeSingle()
        void Promise.resolve(q).then(
          ({ data, error }) => {
            if (!error && data) {
              const row = Array.isArray((data as { outlets?: unknown }).outlets)
                ? { ...data, outlets: (data as { outlets: unknown[] }).outlets[0] ?? null }
                : data
              applyEmployeeRow(row as EmployeeRow, !byId)
              done()
              return
            }
            const qMinimal = byId && eid
              ? supabase.from('employees').select(selectMinimal).eq('id', eid).maybeSingle()
              : supabase.from('employees').select(selectMinimal).eq('profile_id', pid!).maybeSingle()
            void Promise.resolve(qMinimal).then(
              ({ data: data2 }) => {
                applyEmployeeRow(data2 as EmployeeRow | null, !byId)
                if (!data2) {
                  void supabase.rpc('sync_my_employee_link').then(({ data: res }) => {
                    const r = res as { ok?: boolean } | null
                    if (r?.ok) refetchProfile()
                  })
                }
                done()
              },
              done
            )
          },
          done
        )
      }

      if (profile.employee_id) {
        fetchEmployeeAndApply(true)
      } else if (profile.id) {
        fetchEmployeeAndApply(false)
      } else {
        clearTimeout(timeout)
        setOutlet(null)
        setSelectedOutletId(null)
        setOutlets([])
        setLoading(false)
      }
    }
  }, [profile?.id, profile?.role, profile?.employee_id, isSuperAdmin, refetchProfile])

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
