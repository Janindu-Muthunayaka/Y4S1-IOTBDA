import React from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import TripsTable from './components/TripsTable';
import TripAnalytics from './components/TripAnalytics';
import QAInspectorA from './components/QAInspectorA';
import DriverDashboard from './components/DriverDashboard';
import OwnerDashboard from './components/OwnerDashboard';
import RetailerDashboard from './components/RetailerDashboard';

function Sidebar() {
  const location = useLocation();

  // Hide sidebar on specialized views that have their own full-screen layouts
  if (location.pathname === '/driver') return null;

  return (
    <div style={{ width: '240px', background: 'var(--bg-card)', borderRight: '1px solid var(--border-color)', padding: '2rem 1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <h2 style={{ color: 'var(--accent-cyan)', marginBottom: '2rem', fontSize: '1.5rem', textAlign: 'center' }}>CargoLink Hub</h2>
      <Link to="/" style={{ color: 'var(--text-primary)', textDecoration: 'none', padding: '0.75rem', borderRadius: '8px', background: location.pathname === '/' ? 'rgba(255,255,255,0.1)' : 'transparent', fontWeight: 600, transition: 'background 0.2s' }}>
        📊 Dashboard
      </Link>
      <Link to="/qa" style={{ color: 'var(--text-primary)', textDecoration: 'none', padding: '0.75rem', borderRadius: '8px', background: location.pathname === '/qa' ? 'rgba(255,255,255,0.1)' : 'transparent', fontWeight: 600, transition: 'background 0.2s' }}>
        🔍 QA Inspector
      </Link>
      <Link to="/driver" style={{ color: 'var(--text-primary)', textDecoration: 'none', padding: '0.75rem', borderRadius: '8px', background: location.pathname === '/driver' ? 'rgba(255,255,255,0.1)' : 'transparent', fontWeight: 600, transition: 'background 0.2s' }}>
        📱 Driver View
      </Link>
      <Link to="/owner" style={{ color: 'var(--text-primary)', textDecoration: 'none', padding: '0.75rem', borderRadius: '8px', background: location.pathname === '/owner' ? 'rgba(255,255,255,0.1)' : 'transparent', fontWeight: 600, transition: 'background 0.2s' }}>
        🏢 Owner Dashboard
      </Link>
      <Link to="/retailer" style={{ color: 'var(--text-primary)', textDecoration: 'none', padding: '0.75rem', borderRadius: '8px', background: location.pathname === '/retailer' ? 'rgba(255,255,255,0.1)' : 'transparent', fontWeight: 600, transition: 'background 0.2s' }}>
        🏪 Retailer View
      </Link>
    </div>
  );
}

function MainLayout() {
   const location = useLocation();
   // The mockup for QA Inspector matches its own layout, but driver is specifically full-screen
   const isQa = location.pathname === '/qa';
   const isDriver = location.pathname === '/driver';
   const isOwner = location.pathname === '/owner';
   const isRetailer = location.pathname === '/retailer';
   const isSpecialFull = isQa || isDriver || isOwner || isRetailer;

   return (
    <div style={{ display: 'flex', minHeight: '100vh', width: '100%', justifyContent: isDriver ? 'center' : 'flex-start' }}>
      <Sidebar />
      <div style={{ flex: 1, overflowX: 'auto', display: 'flex', flexDirection: 'column', padding: isDriver ? 0 : undefined }}>
        {!isSpecialFull && <h1 className="header-title" style={{ marginTop: '2rem' }}>Cold-Chain Logistics Nexus</h1>}
        <div className={!isSpecialFull ? "dashboard-container" : ""} style={!isSpecialFull ? { paddingTop: 0 } : { flex: 1, display: 'flex' }}>
          <Routes>
            <Route path="/" element={<TripsTable />} />
            <Route path="/trip/:id" element={<TripAnalytics />} />
            <Route path="/qa" element={<QAInspectorA />} />
            <Route path="/driver" element={<DriverDashboard />} />
            <Route path="/owner" element={<OwnerDashboard />} />
            <Route path="/retailer" element={<RetailerDashboard />} />
          </Routes>
        </div>
      </div>
    </div>
   );
}

export default function App() {
  return (
    <BrowserRouter>
      <MainLayout />
    </BrowserRouter>
  );
}
