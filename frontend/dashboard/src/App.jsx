import React from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { ChatbotProvider } from './components/qa-inspector/Chatbot/ChatbotContext';
import MrHodhaMaalu from './components/qa-inspector/Chatbot/MrHodhaMaalu';
import TripsTable from './components/TripsTable';
import TripAnalytics from './components/TripAnalytics';

// Dashboards
import QAInspectorA from './components/qa-inspector/Testing/QAInspectorA';
import QAInspectorB from './components/qa-inspector/Testing/QAInspectorB';
import QA_Dash from './components/qa-inspector/QA_Dash';
import QA_Trip from './components/qa-inspector/QA_Trip';
import QA_Graphs from './components/qa-inspector/QA_Graphs';
import QA_Timeline from './components/qa-inspector/QA_Timeline';
import DriverDashboard from './components/driver/DriverDashboard';
import OwnerDashboard from './components/owner/OwnerDashboard';
import RetailerDashboard from './components/retailer/RetailerDashboard';

// Landing Pages
import DriverLanding from './components/driver/DriverLanding';
import RetailerLanding from './components/retailer/RetailerLanding';
import OwnerLanding from './components/owner/OwnerLanding';
import QAInspectorLanding from './components/qa-inspector/QAInspectorLanding';

function Sidebar() {
  const location = useLocation();

  // Hide sidebar on specialized views that have their own full-screen layouts
  if (location.pathname.startsWith('/qa') || location.pathname.startsWith('/qa-b')) return null;

  return (
    <div style={{ width: '240px', background: 'var(--bg-card)', borderRight: '1px solid var(--border-color)', padding: '2rem 1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <h2 style={{ color: 'var(--accent-cyan)', marginBottom: '2rem', fontSize: '1.5rem', textAlign: 'center' }}>CargoLink Hub</h2>
      <Link to="/" style={{ color: 'var(--text-primary)', textDecoration: 'none', padding: '0.75rem', borderRadius: '8px', background: location.pathname === '/' ? 'rgba(255,255,255,0.1)' : 'transparent', fontWeight: 600, transition: 'background 0.2s' }}>
        📊 Dashboard
      </Link>
      <Link to="/qa" style={{ color: 'var(--text-primary)', textDecoration: 'none', padding: '0.75rem', borderRadius: '8px', background: location.pathname.startsWith('/qa') ? 'rgba(255,255,255,0.1)' : 'transparent', fontWeight: 600, transition: 'background 0.2s' }}>
        🔍 QA Inspector
      </Link>
      <Link to="/driver" style={{ color: 'var(--text-primary)', textDecoration: 'none', padding: '0.75rem', borderRadius: '8px', background: location.pathname.startsWith('/driver') ? 'rgba(255,255,255,0.1)' : 'transparent', fontWeight: 600, transition: 'background 0.2s' }}>
        📱 Driver View
      </Link>
      <Link to="/owner" style={{ color: 'var(--text-primary)', textDecoration: 'none', padding: '0.75rem', borderRadius: '8px', background: location.pathname.startsWith('/owner') ? 'rgba(255,255,255,0.1)' : 'transparent', fontWeight: 600, transition: 'background 0.2s' }}>
        🏢 Owner Dashboard
      </Link>
      <Link to="/retailer" style={{ color: 'var(--text-primary)', textDecoration: 'none', padding: '0.75rem', borderRadius: '8px', background: location.pathname.startsWith('/retailer') ? 'rgba(255,255,255,0.1)' : 'transparent', fontWeight: 600, transition: 'background 0.2s' }}>
        🏪 Retailer View
      </Link>
    </div>
  );
}

function MainLayout() {
   const location = useLocation();
   // The mockup for QA Inspector matches its own layout, but driver is specifically full-screen
   const isQa = location.pathname.startsWith('/qa');
   const isDriver = location.pathname.startsWith('/driver');
   const isOwner = location.pathname.startsWith('/owner');
   const isRetailer = location.pathname.startsWith('/retailer');
   const isSpecialFull = isQa || isDriver || isOwner || isRetailer;

   return (
    <div style={{ display: 'flex', minHeight: '100vh', width: '100%', justifyContent: 'flex-start' }}>
      <Sidebar />
      <div style={{ flex: 1, overflowX: 'auto', display: 'flex', flexDirection: 'column', padding: (location.pathname.startsWith('/qa') || location.pathname.startsWith('/qa-b')) ? 0 : undefined }}>
        {!isSpecialFull && <h1 className="header-title" style={{ marginTop: '2rem' }}>Cold-Chain Logistics Nexus</h1>}
        <div className={!isSpecialFull ? "dashboard-container" : ""} style={!isSpecialFull ? { paddingTop: 0 } : { flex: 1, display: 'flex' }}>
          <Routes>
            <Route path="/" element={<TripsTable />} />
            <Route path="/trip/:id" element={<TripAnalytics />} />
            
            <Route path="/qa" element={<QAInspectorLanding />} />
            <Route path="/qa/dash" element={<QA_Dash />} />
            <Route path="/qa/trip/:id" element={<QA_Trip />} />
            <Route path="/qa/graphs/:id" element={<QA_Graphs />} />
            <Route path="/qa/timeline/:id" element={<QA_Timeline />} />
            <Route path="/qa/dashboard" element={<QAInspectorA />} />
            <Route path="/qa-b/:id" element={<QAInspectorB />} />
            
            <Route path="/driver" element={<DriverLanding />} />
            <Route path="/driver/dashboard" element={<DriverDashboard />} />
            
            <Route path="/owner" element={<OwnerLanding />} />
            <Route path="/owner/dashboard" element={<OwnerDashboard />} />
            
            <Route path="/retailer" element={<RetailerLanding />} />
            <Route path="/retailer/dashboard" element={<RetailerDashboard />} />
          </Routes>
        </div>
      </div>
      {/* Mr. Hodha-Maalu Chatbot - Restricted to QA Inspector Module */}
      {isQa && <MrHodhaMaalu />}
    </div>
   );
}

export default function App() {
  return (
    <BrowserRouter>
      <ChatbotProvider>
        <MainLayout />
      </ChatbotProvider>
    </BrowserRouter>
  );
}
