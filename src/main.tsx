// Yönlendirme (kütüphanesiz, yol adına göre):
//   /app  → mevcut EarthEar uygulaması (tembel yüklenir: three.js, ses, veri yalnız burada iner)
//   /     → landing sayfası; uygulama parametresiyle açılırsa (eski paylaşım bağlantıları) aynı parametrelerle /app'e yönlendirilir
import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';

const APP_PARAMS = ['lat', 'lon', 'q', 'layer', 'month', 'view', 'hc', 'panel'];
const path = location.pathname.replace(/\/+$/, '') || '/';
const isApp = path === '/app' || path.startsWith('/app/');
if (!isApp && path === '/' && APP_PARAMS.some((k) => new URLSearchParams(location.search).has(k))) {
  location.replace(`/app${location.search}${location.hash}`);
} else {
  const App = lazy(() => import('./App'));
  const Landing = lazy(() => import('./landing/Landing'));
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <Suspense fallback={<div role="status" aria-live="polite" style={{ minHeight: "100vh", display: "grid", placeContent: "center", background: "#02040a", color: "#a9b4cc", fontFamily: "system-ui" }}>EarthEar…</div>}>
        {isApp ? <App /> : <Landing />}
      </Suspense>
    </StrictMode>,
  );
}
