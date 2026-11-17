import { lazy, Suspense } from 'react';
import App from './App.jsx';

const Admin = lazy(() => import('./admin/Admin.jsx'));
const isAdmin = location.pathname.replace(/\/+$/, '') === '/admin';

export default function Root() {
  return isAdmin ? <Suspense fallback={null}><Admin /></Suspense> : <App />;
}
