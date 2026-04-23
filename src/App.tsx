import { Suspense, lazy, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { Toaster } from 'sonner'
import { useAuthStore } from './stores/authStore'
import { supabase } from './lib/supabaseClient'
import { PageLoader } from './components/shared/LoadingSpinner'
import { ErrorBoundary } from './components/shared/ErrorBoundary'
import { BuyerNav } from './components/layout/BuyerNav'
import { SupplierNav } from './components/layout/SupplierNav'
import { AdminNav } from './components/layout/AdminNav'

// Lazy-loaded pages
const Login = lazy(() => import('./pages/public/Login'))
const Register = lazy(() => import('./pages/public/Register'))
const Home = lazy(() => import('./pages/buyer/Home'))
const Search = lazy(() => import('./pages/buyer/Search'))
const Cart = lazy(() => import('./pages/buyer/Cart'))
const OrderHistory = lazy(() => import('./pages/buyer/OrderHistory'))
const BuyerProfile = lazy(() => import('./pages/buyer/Profile'))
const SupplierProfilePage = lazy(() => import('./pages/buyer/SupplierProfile'))
const ProductDetail = lazy(() => import('./pages/buyer/ProductDetail'))
const Dashboard = lazy(() => import('./pages/supplier/Dashboard'))
const Products = lazy(() => import('./pages/supplier/Products'))
const ProductForm = lazy(() => import('./pages/supplier/ProductForm'))
const SupplierOrders = lazy(() => import('./pages/supplier/Orders'))
const StoreSettings = lazy(() => import('./pages/supplier/StoreSettings'))
const AdminDashboard = lazy(() => import('./pages/admin/Dashboard'))
const AdminSuppliers = lazy(() => import('./pages/admin/Suppliers'))
const AdminProducts = lazy(() => import('./pages/admin/Products'))
const AdminOrders = lazy(() => import('./pages/admin/Orders'))

function BuyerLayout() {
  const { profile, isLoading } = useAuthStore()
  if (isLoading) return <PageLoader />
  if (!profile) return <Navigate to="/login" replace />
  if (profile.role === 'admin') return <Navigate to="/admin/dashboard" replace />
  if (profile.role !== 'buyer') return <Navigate to="/supplier/dashboard" replace />
  return (
    <div className="flex flex-col min-h-screen max-w-lg mx-auto relative">
      <div className="flex-1 overflow-y-auto pb-16">
        <ErrorBoundary>
          <Outlet />
        </ErrorBoundary>
      </div>
      <BuyerNav />
    </div>
  )
}

function SupplierLayout() {
  const { profile, isLoading } = useAuthStore()
  if (isLoading) return <PageLoader />
  if (!profile) return <Navigate to="/login" replace />
  if (profile.role !== 'supplier') return <Navigate to="/" replace />
  return (
    <div className="flex flex-col min-h-screen max-w-lg mx-auto relative">
      <div className="flex-1 overflow-y-auto pb-16">
        <ErrorBoundary>
          <Outlet />
        </ErrorBoundary>
      </div>
      <SupplierNav />
    </div>
  )
}

function AdminLayout() {
  const { profile, isLoading } = useAuthStore()
  if (isLoading) return <PageLoader />
  if (!profile) return <Navigate to="/login" replace />
  if (profile.role !== 'admin') return <Navigate to="/" replace />
  return (
    <div className="flex flex-col min-h-screen max-w-lg mx-auto relative">
      <div className="flex-1 overflow-y-auto pb-16">
        <ErrorBoundary>
          <Outlet />
        </ErrorBoundary>
      </div>
      <AdminNav />
    </div>
  )
}

function PublicRoute() {
  const { profile, isLoading } = useAuthStore()
  if (isLoading) return <PageLoader />
  if (profile?.role === 'admin') return <Navigate to="/admin/dashboard" replace />
  if (profile?.role === 'buyer') return <Navigate to="/" replace />
  if (profile?.role === 'supplier') return <Navigate to="/supplier/dashboard" replace />
  return (
    <div className="max-w-lg mx-auto min-h-screen">
      <Outlet />
    </div>
  )
}

function AppRoutes() {
  const { isLoading } = useAuthStore()
  if (isLoading) return <PageLoader />

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route element={<PublicRoute />}>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
        </Route>

        <Route element={<BuyerLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/search" element={<Search />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/orders" element={<OrderHistory />} />
          <Route path="/profile" element={<BuyerProfile />} />
          <Route path="/supplier/:id" element={<SupplierProfilePage />} />
          <Route path="/product/:id" element={<ProductDetail />} />
        </Route>

        <Route path="/supplier" element={<SupplierLayout />}>
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="products" element={<Products />} />
          <Route path="products/new" element={<ProductForm />} />
          <Route path="products/:id/edit" element={<ProductForm />} />
          <Route path="orders" element={<SupplierOrders />} />
          <Route path="settings" element={<StoreSettings />} />
        </Route>

        <Route path="/admin" element={<AdminLayout />}>
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route path="suppliers" element={<AdminSuppliers />} />
          <Route path="products" element={<AdminProducts />} />
          <Route path="orders" element={<AdminOrders />} />
        </Route>

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Suspense>
  )
}

export default function App() {
  const { loadProfile, setUser } = useAuthStore()

  useEffect(() => {
    // Initial load — may show PageLoader while bootstrapping.
    loadProfile()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null)
      // Only react to events that *change* the authenticated state. Silently
      // ignore TOKEN_REFRESHED and USER_UPDATED — they fire frequently and
      // would otherwise re-fetch profile + remount the whole app, causing
      // noticeable page jank.
      if (event === 'SIGNED_OUT') {
        useAuthStore.setState({
          user: null,
          profile: null,
          buyer: null,
          supplier: null,
          isLoading: false,
        })
        return
      }
      if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
        if (session?.user) {
          // Silent reload: don't flip isLoading, don't unmount the tree.
          const already = useAuthStore.getState().profile?.id === session.user.id
          loadProfile({ silent: already })
        } else {
          useAuthStore.setState({ isLoading: false })
        }
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  return (
    <BrowserRouter>
      <Toaster
        position="top-center"
        richColors
        toastOptions={{
          style: {
            fontFamily: 'Nunito, sans-serif',
            fontWeight: 600,
          },
        }}
      />
      <AppRoutes />
    </BrowserRouter>
  )
}
