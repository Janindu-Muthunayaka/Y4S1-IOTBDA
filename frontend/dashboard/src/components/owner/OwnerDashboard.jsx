import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useLocation, useNavigate, Routes, Route } from 'react-router-dom';
import axios from 'axios';
import { io } from 'socket.io-client';
import logo from '../../assets/logo.svg';

// Chatbot Imports (from remote branch)
import { ChatbotProvider as Owner_ChatbotProvider, useChatbot } from './Owner_Chatbot/Owner_ChatbotContext';
import Owner_MrHodhaMaalu from './Owner_Chatbot/Owner_MrHodhaMaalu';

import './owner.css';
import { OwnerHome, computeQuality } from './pages/OwnerHome';
import OwnerTrucks from './pages/OwnerTrucks';
import OwnerTruckDetail from './pages/OwnerTruckDetail';
import OwnerAlerts from './pages/OwnerAlerts';
import OwnerReports from './pages/OwnerReports';

const API_BASE = 'http://localhost:3001';
const POLL_INTERVAL_MS = 8000;  // Fallback polling every 8 seconds
const SOCKET_URL = 'http://localhost:3001';

// ─── Sidebar Navigation Items ─────────────────────────────────────────────────

const NAV_ITEMS = [
  { label: 'Dashboard', icon: '⊞', path: '/owner/dashboard' },
  { label: 'Trucks',    icon: '🚛', path: '/owner/trucks' },
  { label: 'Alerts',   icon: '🔔', path: '/owner/alerts' },
  { label: 'Reports',  icon: '📋', path: '/owner/reports' },
];

// ─── Connection status indicator ──────────────────────────────────────────────
function ConnStatus({ status }) {
  const cfg = {
    live:        { color: '#10b981', label: 'Live', dot: 'pulse' },
    polling:     { color: '#f59e0b', label: 'Polling', dot: '' },
    connecting:  { color: '#9ca3af', label: 'Connecting…', dot: '' },
    error:       { color: '#ef4444', label: 'Offline', dot: '' },
  }[status] || { color: '#9ca3af', label: status };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.72rem', fontWeight: 600, color: cfg.color }}>
      <span style={{
        width: 7, height: 7, borderRadius: '50%', background: cfg.color, flexShrink: 0,
        boxShadow: status === 'live' ? `0 0 0 2px ${cfg.color}33` : 'none',
        animation: status === 'live' ? 'o-pulse 2s ease infinite' : 'none'
      }} />
      {cfg.label}
    </div>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────
function OwnerSidebar({ critCount }) {
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path) => {
    if (path === '/owner/dashboard') return location.pathname === '/owner/dashboard';
    return location.pathname.startsWith(path);
  };

  return (
    <div className="owner-sidebar">
      <div className="owner-sidebar__logo">
        <img src={logo} alt="Logo" style={{ width: '38px', height: '38px', objectFit: 'contain' }} />
        <div>
          <div className="owner-sidebar__logo-text">CargoLink</div>
          <div className="owner-sidebar__logo-sub">Owner Portal</div>
        </div>
      </div>

      <nav className="owner-sidebar__nav">
        <div className="owner-nav-section">Main Menu</div>
        {NAV_ITEMS.map(item => (
          <button
            key={item.path}
            className={`owner-nav-item ${isActive(item.path) ? 'active' : ''}`}
            onClick={() => navigate(item.path)}
          >
            <span className="owner-nav-item__icon">{item.icon}</span>
            {item.label}
            {item.label === 'Alerts' && critCount > 0 && (
              <span className="owner-nav-badge">{critCount}</span>
            )}
          </button>
        ))}

        <div className="owner-nav-section" style={{ marginTop: '1rem' }}>Navigation</div>
        <button className="owner-nav-item" onClick={() => navigate('/')}>
          <span className="owner-nav-item__icon">←</span>
          Back to Hub
        </button>
      </nav>

      <div className="owner-sidebar__footer">
        <div className="owner-sidebar__avatar">IM</div>
        <button className="owner-sidebar__footer-btn" title="Notifications">🔔</button>
      </div>
    </div>
  );
}

// ─── Top Bar ──────────────────────────────────────────────────────────────────
function OwnerTopBar({ connStatus, lastUpdated, tripCount, sensorCount }) {
  const location = useLocation();
  const pageTitle = NAV_ITEMS.find(n => {
    if (n.path === '/owner/dashboard') return location.pathname === '/owner/dashboard';
    return location.pathname.startsWith(n.path);
  })?.label || 'Dashboard';

  const isTruckDetail = location.pathname.includes('/owner/trucks/');
  const truckId = isTruckDetail ? location.pathname.split('/owner/trucks/')[1] : null;

  const timeStr = lastUpdated
    ? new Date(lastUpdated).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '';

  return (
    <div className="owner-topbar">
      <div className="owner-topbar__breadcrumb">
        <span>Owner</span>
        <span className="owner-topbar__sep">/</span>
        <span className="owner-topbar__page">{pageTitle}</span>
        {truckId && (
          <>
            <span className="owner-topbar__sep">/</span>
            <span className="owner-topbar__page">{truckId}</span>
          </>
        )}
      </div>

      <div className="owner-topbar__right">
        {/* Live data stats */}
        {tripCount > 0 && (
          <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.72rem', color: '#9ca3af', borderRight: '1px solid #e5e7eb', paddingRight: '0.75rem', marginRight: '0.25rem' }}>
            <span><strong style={{ color: '#374151' }}>{tripCount}</strong> trips</span>
            <span><strong style={{ color: '#374151' }}>{sensorCount}</strong> sensor docs</span>
          </div>
        )}
        <ConnStatus status={connStatus} />
        {timeStr && (
          <span style={{ fontSize: '0.7rem', color: '#9ca3af' }}>
            Updated {timeStr}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Main Dashboard Content logic ──────────────────────────────────────────────
function OwnerDashboardContent() {
  const location = useLocation();
  const [trips, setTrips] = useState([]);
  const [liveData, setLiveData] = useState({});   // { trip_id: sensorDoc }
  const [connStatus, setConnStatus] = useState('connecting');
  const [lastUpdated, setLastUpdated] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const socketRef = useRef(null);
  const pollTimerRef = useRef(null);
  const { updateSnapshot } = useChatbot();

  // ── Apply a full data payload (from socket or REST) ─────────────────────────
  const applyPayload = useCallback((payload) => {
    if (!payload) return;
    const { trips: newTrips, sensorMap } = payload;
    setTrips(newTrips || []);
    setLiveData(sensorMap || {});
    setLastUpdated(new Date());
    setIsLoading(false);
  }, []);

  // ── REST API polling fallback ────────────────────────────────────────────────
  const pollFallback = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/dashboard/full`);
      applyPayload(res.data);
      setConnStatus('polling');
    } catch (err) {
      console.error('[Dashboard] Polling fallback failed:', err.message);
      setConnStatus('error');
    }
  }, [applyPayload]);

  // ── Manual Refresh ───────────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data: payload } = await axios.get(`${API_BASE}/api/dashboard/full`);
      applyPayload(payload);
    } catch (err) {
      console.error('[Dashboard] Manual refresh failed:', err.message);
    } finally {
      setIsLoading(false);
    }
  }, [applyPayload]);

  // ── Socket.io setup ──────────────────────────────────────────────────────────
  useEffect(() => {
    console.log('[Dashboard] Connecting to Socket.io at', SOCKET_URL);
    setConnStatus('connecting');

    const socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[Socket.io] ✅ Connected — real-time mode active');
      setConnStatus('live');
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    });

    socket.on('disconnect', (reason) => {
      console.warn('[Socket.io] Disconnected:', reason, '→ falling back to polling');
      setConnStatus('polling');
      startPollingFallback();
    });

    socket.on('connect_error', (err) => {
      console.error('[Socket.io] Connection error:', err.message);
      setConnStatus('polling');
      startPollingFallback();
    });

    socket.on('data:full', (payload) => {
      console.log(`[Socket.io] 📡 Received live update: ${payload?.trips?.length} trips`);
      applyPayload(payload);
    });

    return () => {
      socket.disconnect();
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [applyPayload]);

  const startPollingFallback = useCallback(() => {
    if (pollTimerRef.current) return;
    console.log(`[Dashboard] Starting polling fallback every ${POLL_INTERVAL_MS / 1000}s`);
    pollFallback();
    pollTimerRef.current = setInterval(pollFallback, POLL_INTERVAL_MS);
  }, [pollFallback]);

  // ── Update Chatbot Snapshot ──────────────────────────────────────────────────
  useEffect(() => {
    if (!isLoading && trips.length > 0) {
      // Calculate fleet metrics for chatbot
      let totalQuality = 0;
      let totalTemp = 0;
      let tempCount = 0;
      const alerts = [];

      trips.forEach(t => {
        const s = liveData[t.trip_id];
        const temps = s?.temperature_data || [];
        const latestTmp = temps.length > 0 ? Number(temps[temps.length - 1].avg) : null;
        
        // Quality (use ML model if available via computeQuality helper)
        const score = computeQuality(s);
        totalQuality += score;

        // Temp
        if (latestTmp !== null) {
          totalTemp += latestTmp;
          tempCount++;
        }

        // Alerts (QA Standard: Temp > -18 is Critical alert)
        if (latestTmp !== null && latestTmp > -18) alerts.push({ truck: t.truck_id, type: 'TEMP', val: latestTmp });
        if (s?.motion_data?.some(m => m.max_accel > 0.5)) alerts.push({ truck: t.truck_id, type: 'SHOCK' });
      });

      // Only update Fleet snapshot if we are NOT on a specific truck details page
      if (!location.pathname.includes('/owner/trucks/')) {
        updateSnapshot({
          type: 'FLEET_STRATEGY_OVERVIEW',
          totalTrips: trips.length,
          activeTrips: trips.filter(t => t.active || t.status === 'ACTIVE').length,
          fleetAvgQuality: (totalQuality / trips.length).toFixed(1),
          fleetAvgTemp: tempCount > 0 ? (totalTemp / tempCount).toFixed(1) : '--',
          alertsCount: alerts.length,
          criticalAlerts: alerts
        });
      }
    }
  }, [isLoading, trips, liveData, location.pathname, updateSnapshot]);

  // ── Calculations for UI ──────────────────────────────────────────────────────
  const critCount = trips.filter(trip => {
    const sensors = liveData[trip.trip_id];
    const temps = sensors?.temperature_data || [];
    const currentTemp = temps.length > 0 ? Number(temps[temps.length - 1].avg) : null;
    // QA Logic: Only Temp violations are 'Critical'
    return (currentTemp !== null && currentTemp > -18);
  }).length;

  const sensorCount = Object.keys(liveData).length;

  return (
    <div className="owner-root" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', overflow: 'hidden', zIndex: 100 }}>
      <OwnerSidebar critCount={critCount} />
      <div className="owner-content" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0, minWidth: 0 }}>
        <OwnerTopBar
          connStatus={connStatus}
          lastUpdated={lastUpdated}
          tripCount={trips.length}
          sensorCount={sensorCount}
        />
        <div className="owner-page-body" style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', minHeight: 0, padding: '1.5rem 1.75rem 2.5rem' }}>
          {isLoading && trips.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: '1rem' }}>
              <div className="owner-spinner" style={{ width: 40, height: 40, borderWidth: 3 }} />
              <div style={{ color: '#9ca3af', fontSize: '0.875rem' }}>Connecting to live data stream…</div>
            </div>
          ) : (
            <Routes>
              <Route path="dashboard" element={
                <OwnerHome trips={trips} liveData={liveData} isLoading={isLoading} onRefresh={fetchAll} connStatus={connStatus} />
              } />
              <Route path="trucks" element={
                <OwnerTrucks trips={trips} liveData={liveData} />
              } />
              <Route path="trucks/:truckId" element={
                <OwnerTruckDetail trips={trips} liveData={liveData} />
              } />
              <Route path="alerts" element={
                <OwnerAlerts trips={trips} liveData={liveData} />
              } />
              <Route path="reports" element={
                <OwnerReports trips={trips} liveData={liveData} />
              } />
              <Route path="*" element={
                <OwnerHome trips={trips} liveData={liveData} isLoading={isLoading} onRefresh={fetchAll} connStatus={connStatus} />
              } />
            </Routes>
          )}
        </div>
      </div>
      <Owner_MrHodhaMaalu />
    </div>
  );
}

export default function OwnerDashboard() {
  return (
    <Owner_ChatbotProvider>
      <OwnerDashboardContent />
    </Owner_ChatbotProvider>
  );
}
