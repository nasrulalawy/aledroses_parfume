import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from '@/contexts/AuthContext'
import { OutletProvider } from '@/contexts/OutletContext'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { DashboardLayout } from '@/layouts/DashboardLayout'
import { LoginPage } from '@/pages/LoginPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { POSPage } from '@/pages/POSPage'
import { CategoriesPage } from '@/pages/CategoriesPage'
import { ProductsPage } from '@/pages/ProductsPage'
import { EmployeesPage } from '@/pages/EmployeesPage'
import { AttendancePage } from '@/pages/AttendancePage'
import { CashFlowPage } from '@/pages/CashFlowPage'
import { ReportsPage } from '@/pages/ReportsPage'
import { ShiftsPage } from '@/pages/ShiftsPage'
import { StockPage } from '@/pages/StockPage'
import { OutletsPage } from '@/pages/OutletsPage'
import { KasbonPage } from '@/pages/KasbonPage'

function App() {
  return (
    <AuthProvider>
      <OutletProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="pos" element={<POSPage />} />
          <Route path="products" element={<ProtectedRoute allowedRoles={['super_admin', 'manager']}><ProductsPage /></ProtectedRoute>} />
          <Route path="stock" element={<ProtectedRoute allowedRoles={['super_admin', 'manager']}><StockPage /></ProtectedRoute>} />
          <Route path="categories" element={<ProtectedRoute allowedRoles={['super_admin', 'manager']}><CategoriesPage /></ProtectedRoute>} />
          <Route path="employees" element={<ProtectedRoute allowedRoles={['super_admin', 'manager']}><EmployeesPage /></ProtectedRoute>} />
          <Route path="attendance" element={<AttendancePage />} />
          <Route path="cash-flow" element={<ProtectedRoute allowedRoles={['super_admin', 'manager', 'karyawan']}><CashFlowPage /></ProtectedRoute>} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="kasbon" element={<KasbonPage />} />
          <Route path="shifts" element={<ShiftsPage />} />
          <Route path="outlets" element={<ProtectedRoute allowedRoles={['super_admin']}><OutletsPage /></ProtectedRoute>} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </OutletProvider>
    </AuthProvider>
  )
}

export default App
