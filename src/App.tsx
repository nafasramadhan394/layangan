import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { SessionProvider, useSession } from './lib/session';
import { ToastProvider, Spinner } from './components/ui';
import { Notifications } from './components/Notifications';
import AuthPage from './pages/Auth';
import Lobby from './pages/Lobby';
import PlayPage from './pages/Play';
import ArenaPage from './pages/Arena';
import CreateKitePage from './pages/CreateKite';
import MyKitesPage from './pages/MyKites';
import FriendsPage from './pages/Friends';
import ShopPage from './pages/Shop';
import InventoryPage from './pages/Inventory';
import ProfilePage from './pages/Profile';
import SettingsPage from './pages/Settings';
import OwnerPage from './pages/Owner';

function Gate() {
  const { me, loading } = useSession();
  if (loading)
    return (
      <div className="sky-bg grid min-h-full place-items-center">
        <Spinner label="Menyiapkan layangan…" />
      </div>
    );
  if (!me) return <AuthPage />;
  return (
    <>
      <Notifications />
      <Routes>
        <Route path="/" element={<Lobby />} />
        <Route path="/play" element={<PlayPage />} />
        <Route path="/arena/:id" element={<ArenaPage />} />
        <Route path="/create" element={<CreateKitePage />} />
        <Route path="/kites" element={<MyKitesPage />} />
        <Route path="/friends" element={<FriendsPage />} />
        <Route path="/shop" element={<ShopPage />} />
        <Route path="/inventory" element={<InventoryPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/profile/:username" element={<ProfilePage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/owner" element={me.isOwner ? <OwnerPage /> : <Navigate to="/" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <SessionProvider>
          <Gate />
        </SessionProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
