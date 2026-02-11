import { Fragment, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthContext } from '@/contexts/AuthContext'
import { useOutlet } from '@/contexts/OutletContext'

type ReportPeriod = 'day' | 'month' | 'year'

const PAYMENT_METHODS: { value: '' | 'cash' | 'transfer' | 'qris' | 'other'; label: string }[] = [
  { value: '', label: 'Semua metode' },
  { value: 'cash', label: 'Tunai' },
  { value: 'transfer', label: 'Transfer' },
  { value: 'qris', label: 'QRIS' },
  { value: 'other', label: 'Lainnya' },
]

type TxnItemRow = {
  product_id: string
  qty: number
  unit_price: number
  discount: number
  total: number
  products?: { id: string; name: string; sku: string; category_id: string; cost: number | null } | null
}

type TxnRow = {
  id: string
  transaction_number: string
  created_at: string
  payment_method: 'cash' | 'transfer' | 'qris' | 'other'
  subtotal: number
  discount: number
  tax: number
  total: number
  cash_received: number | null
  change: number | null
  barber_id: string | null
  employees?: { nama: string } | null
  transaction_items?: TxnItemRow[] | null
}

type CategoryOption = { id: string; name: string }
type ProductOption = { id: string; name: string; sku: string; category_id: string }
type BarberOption = { id: string; nama: string; profit_share_percent?: number | null }

export function ReportsPage() {
  const { profile } = useAuthContext()
  const { outletId, outlet, isSuperAdmin } = useOutlet()
  const isKasir = profile?.role === 'karyawan'
  const isBarbershop = outlet?.outlet_type === 'barbershop'
  const [period, setPeriod] = useState<ReportPeriod>('day')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7))
  const [year, setYear] = useState(new Date().getFullYear().toString())
  const [loading, setLoading] = useState(true)
  const [txns, setTxns] = useState<TxnRow[]>([])
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [categories, setCategories] = useState<CategoryOption[]>([])
  const [products, setProducts] = useState<ProductOption[]>([])
  const [barbers, setBarbers] = useState<BarberOption[]>([])
  const [filterCategoryId, setFilterCategoryId] = useState('')
  const [filterProductId, setFilterProductId] = useState('')
  const [filterBarberId, setFilterBarberId] = useState('')
  const [filterPaymentMethod, setFilterPaymentMethod] = useState<'' | 'cash' | 'transfer' | 'qris' | 'other'>('')

  useEffect(() => {
    if (!outletId) return
    supabase
      .from('categories')
      .select('id, name')
      .eq('outlet_id', outletId)
      .order('name')
      .then(({ data }) => setCategories((data as CategoryOption[]) ?? []))
    supabase
      .from('products')
      .select('id, name, sku, category_id')
      .eq('outlet_id', outletId)
      .order('name')
      .then(({ data }) => setProducts((data as ProductOption[]) ?? []))
    if (isBarbershop) {
      supabase
        .from('employees')
        .select('id, nama, profit_share_percent')
        .eq('outlet_id', outletId)
        .eq('employee_type', 'barber')
        .eq('is_active', true)
        .order('nama')
        .then(({ data }) => setBarbers((data as BarberOption[]) ?? []))
    } else {
      setBarbers([])
      setFilterBarberId('')
    }
  }, [outletId, isBarbershop])

  useEffect(() => {
    if (!outletId) return
    const p = isKasir ? 'day' : period
    if (p === 'day') fetchDaily()
    else if (p === 'month') fetchMonthly()
    else fetchYearly()
  }, [outletId, period, date, month, year, filterPaymentMethod, isKasir])

  function txnSelect() {
    return 'id, transaction_number, created_at, payment_method, subtotal, discount, tax, total, cash_received, change, barber_id, employees!transactions_employee_id_fkey(nama), transaction_items(product_id, qty, unit_price, discount, total, products(id, name, sku, category_id, cost))'
  }

  async function fetchDaily() {
    if (!outletId) return
    setLoading(true)
    const start = `${date}T00:00:00`
    const end = `${date}T23:59:59`
    let q = supabase
      .from('transactions')
      .select(txnSelect())
      .eq('outlet_id', outletId)
      .eq('status', 'completed')
      .gte('created_at', start)
      .lte('created_at', end)
      .order('created_at', { ascending: true })
      .limit(500)
    if (filterPaymentMethod) q = q.eq('payment_method', filterPaymentMethod)
    const { data } = await q
    setTxns(((data as unknown) as TxnRow[]) ?? [])
    setExpanded({})
    setLoading(false)
  }

  async function fetchMonthly() {
    if (!outletId) return
    setLoading(true)
    const start = `${month}-01T00:00:00`
    const endOfMonth = new Date(parseInt(month.slice(0, 4), 10), parseInt(month.slice(5, 7), 10), 0)
    const end = `${month}-${String(endOfMonth.getDate()).padStart(2, '0')}T23:59:59`
    let q = supabase
      .from('transactions')
      .select(txnSelect())
      .eq('outlet_id', outletId)
      .eq('status', 'completed')
      .gte('created_at', start)
      .lte('created_at', end)
      .order('created_at', { ascending: true })
      .limit(2000)
    if (filterPaymentMethod) q = q.eq('payment_method', filterPaymentMethod)
    const { data } = await q
    setTxns(((data as unknown) as TxnRow[]) ?? [])
    setExpanded({})
    setLoading(false)
  }

  async function fetchYearly() {
    if (!outletId) return
    setLoading(true)
    const start = `${year}-01-01T00:00:00`
    const end = `${year}-12-31T23:59:59`
    let q = supabase
      .from('transactions')
      .select(txnSelect())
      .eq('outlet_id', outletId)
      .eq('status', 'completed')
      .gte('created_at', start)
      .lte('created_at', end)
      .order('created_at', { ascending: true })
      .limit(10000)
    if (filterPaymentMethod) q = q.eq('payment_method', filterPaymentMethod)
    const { data } = await q
    setTxns(((data as unknown) as TxnRow[]) ?? [])
    setExpanded({})
    setLoading(false)
  }

  const filteredTxns = useMemo(() => {
    let list = txns
    if (filterCategoryId) {
      list = list.filter((t) =>
        t.transaction_items?.some((it) => it.products?.category_id === filterCategoryId)
      )
    }
    if (filterProductId) {
      list = list.filter((t) => t.transaction_items?.some((it) => it.product_id === filterProductId))
    }
    if (filterBarberId) {
      list = list.filter((t) => t.barber_id === filterBarberId)
    }
    return list
  }, [txns, filterCategoryId, filterProductId, filterBarberId])

  /** Total bersih = Subtotal - Diskon + Pajak (yang dibayar, jangan ikut nominal subtotal) */
  const getBersihTotal = (t: TxnRow) =>
    Number(t.subtotal ?? 0) - Number(t.discount ?? 0) + Number(t.tax ?? 0)

  /** Total HPP (cost) dari item-item transaksi: sum (cost * qty) */
  const getTotalCost = (t: TxnRow) =>
    (t.transaction_items ?? []).reduce(
      (sum, it) => sum + (Number(it.products?.cost ?? 0) * Number(it.qty)),
      0
    )

  const totals = useMemo(() => {
    const subtotal = filteredTxns.reduce((s, t) => s + Number(t.subtotal ?? 0), 0)
    const discount = filteredTxns.reduce((s, t) => s + Number(t.discount ?? 0), 0)
    const tax = filteredTxns.reduce((s, t) => s + Number(t.tax ?? 0), 0)
    const total = filteredTxns.reduce((s, t) => s + getBersihTotal(t), 0)
    const totalCost = filteredTxns.reduce((s, t) => s + getTotalCost(t), 0)
    const profit = total - totalCost
    const byMethod = filteredTxns.reduce(
      (acc, t) => {
        const m = t.payment_method ?? 'other'
        acc[m] = (acc[m] ?? 0) + getBersihTotal(t)
        return acc
      },
      {} as Record<string, number>
    )
    return { subtotal, discount, tax, total, totalCost, profit, count: filteredTxns.length, byMethod }
  }, [filteredTxns])

  /** Total penjualan per produk oleh barber terpilih (hanya bermakna saat filter by barber aktif) */
  const barberProductTotals = useMemo(() => {
    if (!filterBarberId || filteredTxns.length === 0) return []
    const byProduct: Record<
      string,
      { productId: string; productName: string; sku: string; qty: number; total: number }
    > = {}
    for (const t of filteredTxns) {
      for (const it of t.transaction_items ?? []) {
        const pid = it.product_id
        if (!pid) continue
        if (!byProduct[pid]) {
          byProduct[pid] = {
            productId: pid,
            productName: it.products?.name ?? '-',
            sku: it.products?.sku ?? '-',
            qty: 0,
            total: 0,
          }
        }
        byProduct[pid].qty += Number(it.qty ?? 0)
        byProduct[pid].total += Number(it.total ?? 0)
      }
    }
    return Object.values(byProduct).sort((a, b) => b.total - a.total)
  }, [filterBarberId, filteredTxns])

  const effectivePeriod = isKasir ? 'day' : period

  const grouped = useMemo(() => {
    if (effectivePeriod === 'day') return []
    if (effectivePeriod === 'month') {
      const byDay: Record<string, { total: number; totalCost: number; count: number }> = {}
      for (const t of filteredTxns) {
        const d = t.created_at.slice(0, 10)
        if (!byDay[d]) byDay[d] = { total: 0, totalCost: 0, count: 0 }
        byDay[d].total += getBersihTotal(t)
        byDay[d].totalCost += getTotalCost(t)
        byDay[d].count += 1
      }
      return Object.entries(byDay)
        .map(([key, v]) => ({ key, ...v, profit: v.total - v.totalCost }))
        .sort((a, b) => a.key.localeCompare(b.key))
    }
    const byMonth: Record<string, { total: number; totalCost: number; count: number }> = {}
    for (const t of filteredTxns) {
      const m = t.created_at.slice(0, 7)
      if (!byMonth[m]) byMonth[m] = { total: 0, totalCost: 0, count: 0 }
      byMonth[m].total += getBersihTotal(t)
      byMonth[m].totalCost += getTotalCost(t)
      byMonth[m].count += 1
    }
    return Object.entries(byMonth)
      .map(([key, v]) => ({ key, ...v, profit: v.total - v.totalCost }))
      .sort((a, b) => a.key.localeCompare(b.key))
  }, [effectivePeriod, filteredTxns])

  function toggle(id: string) {
    setExpanded((p) => ({ ...p, [id]: !p[id] }))
  }

  if (!outletId && !isSuperAdmin) return (
    <div className="card">
      <p className="font-medium text-gray-900 dark:text-white">Outlet belum diatur</p>
      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
        Minta admin/manager mengaitkan karyawan Anda ke outlet di menu Karyawan → Edit.
      </p>
    </div>
  )

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Laporan</h1>
      <div className="card mt-4 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Periode:</span>
          <button type="button" className={effectivePeriod === 'day' ? 'btn-primary' : 'btn-secondary'} onClick={() => setPeriod('day')}>Harian</button>
          {!isKasir && (
            <>
              <button type="button" className={period === 'month' ? 'btn-primary' : 'btn-secondary'} onClick={() => setPeriod('month')}>Bulanan</button>
              <button type="button" className={period === 'year' ? 'btn-primary' : 'btn-secondary'} onClick={() => setPeriod('year')}>Tahunan</button>
            </>
          )}
          {effectivePeriod === 'day' && <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input w-40" />}
          {!isKasir && period === 'month' && <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="input w-40" />}
          {!isKasir && period === 'year' && <input type="number" min={2020} max={2030} value={year} onChange={(e) => setYear(e.target.value)} className="input w-24" />}
        </div>
        <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-gray-200 dark:border-gray-700">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Filter:</span>
          <label className="flex items-center gap-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">Kategori</span>
            <select
              value={filterCategoryId}
              onChange={(e) => {
                setFilterCategoryId(e.target.value)
                if (filterProductId && e.target.value) {
                  const prod = products.find((p) => p.id === filterProductId)
                  if (prod && prod.category_id !== e.target.value) setFilterProductId('')
                }
              }}
              className="input w-48 min-w-0"
            >
              <option value="">Semua kategori</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">Produk</span>
            <select
              value={filterProductId}
              onChange={(e) => setFilterProductId(e.target.value)}
              className="input w-56 min-w-0"
            >
              <option value="">Semua produk</option>
              {(filterCategoryId ? products.filter((p) => p.category_id === filterCategoryId) : products).map((p) => (
                <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
              ))}
            </select>
          </label>
          {isBarbershop && (
            <label className="flex items-center gap-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">Barber</span>
              <select
                value={filterBarberId}
                onChange={(e) => setFilterBarberId(e.target.value)}
                className="input w-48 min-w-0"
              >
                <option value="">Semua barber</option>
                {barbers.map((b) => (
                  <option key={b.id} value={b.id}>{b.nama}</option>
                ))}
              </select>
            </label>
          )}
          <label className="flex items-center gap-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">Metode bayar</span>
            <select
              value={filterPaymentMethod}
              onChange={(e) => setFilterPaymentMethod(e.target.value as '' | 'cash' | 'transfer' | 'qris' | 'other')}
              className="input w-40 min-w-0"
            >
              {PAYMENT_METHODS.map((m) => (
                <option key={m.value || 'all'} value={m.value}>{m.label}</option>
              ))}
            </select>
          </label>
          {(filterCategoryId || filterProductId || filterBarberId || filterPaymentMethod) && (
            <button
              type="button"
              className="btn-secondary text-sm"
              onClick={() => {
                setFilterCategoryId('')
                setFilterProductId('')
                setFilterBarberId('')
                setFilterPaymentMethod('')
              }}
            >
              Reset filter
            </button>
          )}
        </div>
      </div>
      {loading ? (
        <div className="mt-4">Memuat...</div>
      ) : (
        <div className="card mt-4">
          <h3 className="font-semibold text-lg">
            {effectivePeriod === 'day' ? `Laporan Harian - ${date}` : effectivePeriod === 'month' ? `Laporan Bulanan - ${month}` : `Laporan Tahunan - ${year}`}
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mt-4">
            <div className="card">
              <p className="text-sm text-gray-600 dark:text-gray-400">Total penjualan (bersih)</p>
              <p className="text-xl font-bold text-primary-600">Rp {totals.total.toLocaleString('id-ID')}</p>
              <p className="text-xs text-gray-500 mt-0.5">Subtotal − Diskon + Pajak</p>
            </div>
            <div className="card">
              <p className="text-sm text-gray-600 dark:text-gray-400">Total HPP</p>
              <p className="text-xl font-bold text-amber-700 dark:text-amber-400">Rp {totals.totalCost.toLocaleString('id-ID')}</p>
              <p className="text-xs text-gray-500 mt-0.5">Harga pokok penjualan</p>
            </div>
            <div className="card border-l-4 border-l-emerald-600">
              <p className="text-sm text-gray-600 dark:text-gray-400">Keuntungan</p>
              <p className={`text-xl font-bold ${totals.profit >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-600'}`}>
                Rp {totals.profit.toLocaleString('id-ID')}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">Penjualan − HPP</p>
            </div>
            <div className="card">
              <p className="text-sm text-gray-600 dark:text-gray-400">Jumlah transaksi</p>
              <p className="text-xl font-bold">{totals.count}</p>
            </div>
            <div className="card">
              <p className="text-sm text-gray-600 dark:text-gray-400">Total diskon</p>
              <p className="text-xl font-bold text-green-600">Rp {totals.discount.toLocaleString('id-ID')}</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-2">
            <div className="card">
              <p className="text-sm text-gray-600 dark:text-gray-400">Total pajak</p>
              <p className="text-xl font-bold">Rp {totals.tax.toLocaleString('id-ID')}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
            <div className="card border-l-4 border-l-emerald-500">
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Tunai</p>
              <p className="text-xl font-bold text-emerald-700 dark:text-emerald-400">Rp {(totals.byMethod['cash'] ?? 0).toLocaleString('id-ID')}</p>
            </div>
            <div className="card border-l-4 border-l-blue-500">
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Transfer</p>
              <p className="text-xl font-bold text-blue-700 dark:text-blue-400">Rp {(totals.byMethod['transfer'] ?? 0).toLocaleString('id-ID')}</p>
            </div>
            <div className="card border-l-4 border-l-violet-500">
              <p className="text-sm text-gray-600 dark:text-gray-400">Total QRIS</p>
              <p className="text-xl font-bold text-violet-700 dark:text-violet-400">Rp {(totals.byMethod['qris'] ?? 0).toLocaleString('id-ID')}</p>
            </div>
          </div>

          {effectivePeriod !== 'day' && (
            <div className="card mt-4 overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">{effectivePeriod === 'month' ? 'Tanggal' : 'Bulan'}</th>
                    <th className="text-right py-2">Transaksi</th>
                    <th className="text-right py-2">Total penjualan</th>
                    <th className="text-right py-2">Keuntungan</th>
                  </tr>
                </thead>
                <tbody>
                  {grouped.map((g) => (
                    <tr key={g.key} className="border-b">
                      <td className="py-2">{g.key}</td>
                      <td className="py-2 text-right">{g.count}</td>
                      <td className="py-2 text-right">Rp {Number(g.total).toLocaleString('id-ID')}</td>
                      <td className={`py-2 text-right font-medium ${g.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        Rp {Number(g.profit).toLocaleString('id-ID')}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t">
                    <td className="py-2 font-semibold">TOTAL</td>
                    <td className="py-2 text-right font-semibold">{totals.count}</td>
                    <td className="py-2 text-right font-semibold">Rp {totals.total.toLocaleString('id-ID')}</td>
                    <td className={`py-2 text-right font-semibold ${totals.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      Rp {totals.profit.toLocaleString('id-ID')}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {isBarbershop && filteredTxns.length > 0 && (
            <div className="card mt-4">
              <h3 className="font-semibold text-lg mb-3">Rekap per Barber (bagi hasil)</h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-600">
                      <th className="text-left py-2">Barber</th>
                      <th className="text-right py-2">% Bagi hasil</th>
                      <th className="text-right py-2">Transaksi</th>
                      <th className="text-right py-2">Total penjualan</th>
                      <th className="text-right py-2">Total HPP</th>
                      <th className="text-right py-2">Keuntungan</th>
                      <th className="text-right py-2">Bagi hasil (Rp)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const byBarber: Record<string, { total: number; totalCost: number; count: number }> = {}
                      for (const t of filteredTxns) {
                        const bid = t.barber_id ?? '_tanpa_barber'
                        if (!byBarber[bid]) byBarber[bid] = { total: 0, totalCost: 0, count: 0 }
                        byBarber[bid].total += getBersihTotal(t)
                        byBarber[bid].totalCost += getTotalCost(t)
                        byBarber[bid].count += 1
                      }
                      return Object.entries(byBarber)
                        .map(([bid, v]) => {
                          const barber = bid === '_tanpa_barber' ? null : barbers.find((b) => b.id === bid)
                          const profit = v.total - v.totalCost
                          const pct = barber?.profit_share_percent ?? 0
                          const shareAmount = pct ? (profit * pct) / 100 : 0
                          return {
                            barberId: bid,
                            barberName: bid === '_tanpa_barber' ? '(Tanpa barber)' : barber?.nama ?? '-',
                            profitSharePercent: pct,
                            shareAmount,
                            ...v,
                            profit,
                          }
                        })
                        .sort((a, b) => b.total - a.total)
                        .map((row) => (
                          <tr key={row.barberId} className="border-b border-gray-100 dark:border-gray-700">
                            <td className="py-2 font-medium">{row.barberName}</td>
                            <td className="py-2 text-right tabular-nums">{row.profitSharePercent ? `${row.profitSharePercent}%` : '-'}</td>
                            <td className="py-2 text-right tabular-nums">{row.count}</td>
                            <td className="py-2 text-right tabular-nums">Rp {row.total.toLocaleString('id-ID')}</td>
                            <td className="py-2 text-right tabular-nums">Rp {row.totalCost.toLocaleString('id-ID')}</td>
                            <td className={`py-2 text-right font-medium tabular-nums ${row.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                              Rp {row.profit.toLocaleString('id-ID')}
                            </td>
                            <td className="py-2 text-right font-medium tabular-nums text-primary-600">
                              {row.shareAmount ? `Rp ${Math.round(row.shareAmount).toLocaleString('id-ID')}` : '-'}
                            </td>
                          </tr>
                        ))
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {isBarbershop && filterBarberId && barberProductTotals.length > 0 && (
            <div className="card mt-4">
              <h3 className="font-semibold text-lg mb-3">
                Total penjualan per produk — {barbers.find((b) => b.id === filterBarberId)?.nama ?? 'Barber'}
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-600">
                      <th className="text-left py-2">Produk</th>
                      <th className="text-right py-2">Qty terjual</th>
                      <th className="text-right py-2">Total penjualan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {barberProductTotals.map((row) => (
                      <tr key={row.productId} className="border-b border-gray-100 dark:border-gray-700">
                        <td className="py-2">
                          <span className="font-medium">{row.productName}</span>
                          <span className="text-gray-500 dark:text-gray-400 ml-1">({row.sku})</span>
                        </td>
                        <td className="py-2 text-right tabular-nums">{row.qty.toLocaleString('id-ID')}</td>
                        <td className="py-2 text-right font-medium tabular-nums">
                          Rp {row.total.toLocaleString('id-ID')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t font-semibold">
                      <td className="py-2">Total</td>
                      <td className="py-2 text-right tabular-nums">
                        {barberProductTotals.reduce((s, r) => s + r.qty, 0).toLocaleString('id-ID')}
                      </td>
                      <td className="py-2 text-right tabular-nums">
                        Rp {barberProductTotals.reduce((s, r) => s + r.total, 0).toLocaleString('id-ID')}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          <div className="card mt-4 overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-600">
                  <th className="text-left py-3 px-2">No. Transaksi</th>
                  <th className="text-left py-3 px-2">Waktu</th>
                  <th className="text-left py-3 px-2">Kasir</th>
                  {isBarbershop && <th className="text-left py-3 px-2">Barber</th>}
                  <th className="text-left py-3 px-2">Metode</th>
                  <th className="text-right py-3 px-2">Subtotal</th>
                  <th className="text-right py-3 px-2">Diskon</th>
                  <th className="text-right py-3 px-2">Pajak</th>
                  <th className="text-right py-3 px-2">Total</th>
                  <th className="w-24 py-3 px-2"></th>
                </tr>
              </thead>
              <tbody>
                {filteredTxns.map((t) => (
                  <Fragment key={t.id}>
                    <tr className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50/50 dark:hover:bg-gray-800/50">
                      <td className="py-3 px-2 font-medium">{t.transaction_number}</td>
                      <td className="py-3 px-2 text-gray-700 dark:text-gray-300">{new Date(t.created_at).toLocaleString('id-ID')}</td>
                      <td className="py-3 px-2">{t.employees?.nama ?? '-'}</td>
                      {isBarbershop && <td className="py-3 px-2">{t.barber_id ? (barbers.find((b) => b.id === t.barber_id)?.nama ?? '-') : '-'}</td>}
                      <td className="py-3 px-2 capitalize">{t.payment_method}</td>
                      <td className="py-3 px-2 text-right tabular-nums">Rp {Number(t.subtotal).toLocaleString('id-ID')}</td>
                      <td className="py-3 px-2 text-right tabular-nums">Rp {Number(t.discount).toLocaleString('id-ID')}</td>
                      <td className="py-3 px-2 text-right tabular-nums">Rp {Number(t.tax).toLocaleString('id-ID')}</td>
                      <td className="py-3 px-2 text-right font-semibold tabular-nums">Rp {getBersihTotal(t).toLocaleString('id-ID')}</td>
                      <td className="py-3 px-2 text-right">
                        <button
                          type="button"
                          className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                          onClick={() => toggle(t.id)}
                        >
                          {expanded[t.id] ? 'Tutup' : 'Detail'}
                        </button>
                      </td>
                    </tr>
                    {expanded[t.id] && (
                      <tr key={`${t.id}-detail`} className="bg-gray-50 dark:bg-gray-800/50">
                        <td colSpan={isBarbershop ? 10 : 9} className="p-0">
                          <div className="px-4 py-4 border-l-4 border-primary-500">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                              <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">Pembayaran</p>
                                <p className="text-sm text-gray-800 dark:text-gray-200">
                                  {t.payment_method === 'cash' && t.cash_received != null
                                    ? `Tunai: diterima Rp ${Number(t.cash_received).toLocaleString('id-ID')}, kembalian Rp ${Number(t.change ?? 0).toLocaleString('id-ID')}`
                                    : 'Non-tunai (transfer/QRIS)'}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">Total transaksi</p>
                                <p className="text-lg font-bold text-primary-600">Rp {getBersihTotal(t).toLocaleString('id-ID')}</p>
                              </div>
                            </div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">Item dibeli</p>
                            <table className="w-full text-sm border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden">
                              <thead>
                                <tr className="bg-gray-100 dark:bg-gray-700">
                                  <th className="text-left py-2 px-3">Produk</th>
                                  <th className="text-right py-2 px-3 w-20">Qty</th>
                                  <th className="text-right py-2 px-3">Harga satuan</th>
                                  <th className="text-right py-2 px-3">Diskon</th>
                                  <th className="text-right py-2 px-3">Total</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(t.transaction_items ?? []).map((it, idx) => (
                                  <tr key={idx} className="border-t border-gray-200 dark:border-gray-600">
                                    <td className="py-2 px-3">
                                      <span className="font-medium">{it.products?.name ?? '-'}</span>
                                      <span className="text-gray-500 dark:text-gray-400 ml-1">({it.products?.sku ?? '-'})</span>
                                    </td>
                                    <td className="py-2 px-3 text-right tabular-nums">{Number(it.qty)}</td>
                                    <td className="py-2 px-3 text-right tabular-nums">Rp {Number(it.unit_price).toLocaleString('id-ID')}</td>
                                    <td className="py-2 px-3 text-right tabular-nums">Rp {Number(it.discount).toLocaleString('id-ID')}</td>
                                    <td className="py-2 px-3 text-right font-medium tabular-nums">Rp {Number(it.total).toLocaleString('id-ID')}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50">
                  <td className="py-3 px-2 font-semibold" colSpan={isBarbershop ? 5 : 4}>TOTAL</td>
                  <td className="py-3 px-2 text-right font-semibold tabular-nums">Rp {totals.subtotal.toLocaleString('id-ID')}</td>
                  <td className="py-3 px-2 text-right font-semibold tabular-nums">Rp {totals.discount.toLocaleString('id-ID')}</td>
                  <td className="py-3 px-2 text-right font-semibold tabular-nums">Rp {totals.tax.toLocaleString('id-ID')}</td>
                  <td className="py-3 px-2 text-right font-semibold tabular-nums">Rp {totals.total.toLocaleString('id-ID')}</td>
                  <td></td>
                </tr>
                <tr>
                  <td className="py-2 px-2 text-sm text-gray-600 dark:text-gray-400" colSpan={isBarbershop ? 10 : 9}>
                    Rekap metode bayar: {Object.entries(totals.byMethod).map(([k, v]) => `${k.toUpperCase()} Rp ${v.toLocaleString('id-ID')}`).join(' · ')}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
