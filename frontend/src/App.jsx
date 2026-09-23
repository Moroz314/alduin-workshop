import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { getToken } from './api/axios'
import Layout from './components/Layout'
import Catalog from './components/Catalog'
import AboutPage from './pages/AboutPage'
import ArticlesPage from './pages/ArticlesPage'
import GalleryPage from './pages/GalleryPage'
import CheckoutPage from './pages/CheckoutPage'
import ContactsPage from './pages/ContactsPage'
import ProductPage from './pages/ProductPage'
import WarrantyPage from './pages/WarrantyPage'

/* Admin pages */
import AdminLogin        from './pages/admin/AdminLogin'
import AdminProducts     from './pages/admin/AdminProducts'
import AdminOrders       from './pages/admin/AdminOrders'
import AdminContent      from './pages/admin/AdminContent'
import AdminGallery      from './pages/admin/AdminGallery'
import AdminSiteSettings from './pages/admin/AdminSiteSettings'

/* ── Заглушка ─────────────────────────────────────────────── */
const Placeholder = ({ title }) => (
  <section className="max-w-3xl mx-auto px-4 sm:px-6 py-24 text-center">
    <p className="gold-tag mb-4">◇ Мастерская Алдуин</p>
    <h1 className="font-serif font-bold text-forge-text text-4xl mb-4">{title}</h1>
    <div className="w-10 h-px bg-forge-primary mx-auto mb-4" />
    <p className="text-forge-muted font-body text-sm">Страница в разработке</p>
  </section>
)

/* ── Protected route ──────────────────────────────────────── */
function PrivateRoute({ children }) {
  return getToken() ? children : <Navigate to="/admin/login" replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* ── Публичный сайт ─────────────────────────────────── */}
        <Route
          path="/*"
          element={
            <Layout>
              <Routes>
                <Route path="/"          element={<Catalog />} />
                <Route path="/catalog"   element={<Navigate to="/" replace />} />
                <Route path="/about"     element={<AboutPage />} />
                <Route path="/workshop"  element={<Navigate to="/about" replace />} />
                <Route path="/news"      element={
                  <ArticlesPage
                    type="news"
                    title="Новости"
                    subtitle="Свежие новости из мастерской — новые коллекции, события и анонсы."
                    emptyText="Новости скоро появятся"
                  />
                } />
                <Route path="/training"  element={
                  <ArticlesPage
                    type="training"
                    title="Обучение"
                    subtitle="Мастер-классы, советы по уходу за изделиями и секреты ремесла."
                    emptyText="Обучающие материалы скоро появятся"
                  />
                } />
                <Route path="/gallery"   element={<GalleryPage />} />
                <Route path="/checkout"  element={<CheckoutPage />} />
                <Route path="/contacts"  element={<ContactsPage />} />
                <Route path="/warranty"  element={<WarrantyPage />} />
                <Route path="/product/:slug" element={<ProductPage />} />
                <Route path="*"          element={<Placeholder title="Страница не найдена" />} />
              </Routes>
            </Layout>
          }
        />

        {/* ── Панель администратора ──────────────────────────── */}
        <Route path="/admin/login"    element={<AdminLogin />} />
        <Route path="/admin/products" element={<PrivateRoute><AdminProducts /></PrivateRoute>} />
        <Route path="/admin/orders"   element={<PrivateRoute><AdminOrders /></PrivateRoute>} />
        <Route path="/admin/content"  element={<PrivateRoute><AdminContent /></PrivateRoute>} />
        <Route path="/admin/gallery"  element={<PrivateRoute><AdminGallery /></PrivateRoute>} />
        <Route path="/admin/settings" element={<PrivateRoute><AdminSiteSettings /></PrivateRoute>} />
        <Route path="/admin"          element={<Navigate to="/admin/products" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
