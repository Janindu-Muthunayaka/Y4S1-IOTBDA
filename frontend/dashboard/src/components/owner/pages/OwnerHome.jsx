import React, { useEffect, useState } from 'react';
import axios from 'axios';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement,
  LineElement, BarElement, Title, Tooltip, Legend, Filler
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, Filler);

const API_BASE = 'http://localhost:3001';

// ─── Helpers ─────────────────────────────────────────────────────────────────
export function fmtDate(d) {
  if (!d) return '--';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
export function fmtTime(d) {
  if (!d) return '--';
  return new Date(d).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}
export function timeAgo(d) {
  if (!d) return '';
  const diff = Math.floor((Date.now() - new Date(d)) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hr ago`;
  return fmtDate(d);
}
export function computeQuality(sensors) {
  if (!sensors) return 100;
  
  const temps = sensors.temperature_data || [];
  const motions = sensors.motion_data || [];
  
  // Borrowed logic from QA_Trip.jsx
  const tempViolations = temps.filter(t => Number(t.avg) > -18);
  const tempCompliance = temps.length > 0 ? Math.round(((temps.length - tempViolations.length) / temps.length) * 100) : 100;
  
  const majorShocks = motions.filter(m => m.max_accel > 0.5);
  const minorShocks = motions.filter(m => m.max_accel > 0.2 && m.max_accel <= 0.5);
  
  const score = Math.max(0, Math.floor(tempCompliance - (majorShocks.length * 5) - (minorShocks.length * 2)));
  return score;
}
export function riskLevel(score) {
  if (score < 70) return 'crit';
  if (score < 90) return 'warn';
  return 'safe';
}

// ─── SVG Gauge ───────────────────────────────────────────────────────────────
export function Gauge({ value = 68, size = 190 }) {
  const radius = 72;
  const cx = size / 2;
  const cy = size * 0.58;

  const toRad = d => (d * Math.PI) / 180;
  const arc = (r, s, e) => {
    const x1 = cx + r * Math.cos(toRad(s)), y1 = cy + r * Math.sin(toRad(s));
    const x2 = cx + r * Math.cos(toRad(e)), y2 = cy + r * Math.sin(toRad(e));
    return `M ${x1} ${y1} A ${r} ${r} 0 ${e - s > 180 ? 1 : 0} 1 ${x2} ${y2}`;
  };

  const startA = -215, totalA = 250;
  const angle = startA + (Math.min(100, Math.max(0, value)) / 100) * totalA;
  const color = value >= 80 ? '#059669' : value >= 55 ? '#d97706' : '#dc2626';
  const label = value >= 80 ? 'Safe' : value >= 55 ? 'Elevated Risk' : 'High Risk';

  const nx = cx + (radius - 14) * Math.cos(toRad(angle));
  const ny = cy + (radius - 14) * Math.sin(toRad(angle));

  return (
    <div className="owner-gauge">
      <svg width={size} height={size * 0.66} viewBox={`0 0 ${size} ${size * 0.66}`}>
        {/* Track */}
        <path d={arc(radius, -215, 35)} fill="none" stroke="#e5e7eb" strokeWidth={11} strokeLinecap="round" />
        {/* Red (Critical: 0-54%) */}
        <path d={arc(radius, -215, -77)} fill="none" stroke="#dc2626" strokeWidth={11} strokeLinecap="round" opacity={0.9} />
        {/* Yellow (Warning: 55-79%) */}
        <path d={arc(radius, -77, -15)} fill="none" stroke="#d97706" strokeWidth={11} strokeLinecap="round" opacity={0.9} />
        {/* Green (Safe: 80-100%) */}
        <path d={arc(radius, -15, 35)} fill="none" stroke="#059669" strokeWidth={11} strokeLinecap="round" opacity={0.9} />
        {/* Needle */}
        <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="#374151" strokeWidth={2.5} strokeLinecap="round" />
        <circle cx={cx} cy={cy} r={6} fill="#374151" />
        <circle cx={cx} cy={cy} r={3} fill="#fff" />
        {/* Value */}
        <text x={cx} y={cy + 26} textAnchor="middle" fontSize={16} fontWeight={900} fontFamily="Inter" fill="#111827">{value}%</text>
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', width: '88%', marginTop: '-0.25rem' }}>
        <span style={{ fontSize: '0.62rem', color: '#dc2626', fontWeight: 700 }}>Critical</span>
        <span style={{ fontSize: '0.62rem', color: '#d97706', fontWeight: 700 }}>Warning</span>
        <span style={{ fontSize: '0.62rem', color: '#059669', fontWeight: 700 }}>Safe</span>
      </div>
      <div style={{ fontSize: '0.8rem', fontWeight: 800, color, letterSpacing: '-0.01em' }}>{label}</div>
    </div>
  );
}

// ─── Status Badge ─────────────────────────────────────────────────────────────
export function StatusBadge({ status }) {
  if (status === 'safe') return <span className="o-badge o-badge--safe o-badge--dot">Safe</span>;
  if (status === 'warn') return <span className="o-badge o-badge--warn o-badge--dot">Warning</span>;
  return <span className="o-badge o-badge--crit o-badge--dot">Critical</span>;
}

// ─── Chart Options ────────────────────────────────────────────────────────────
const baseChartOpts = {
  responsive: true, maintainAspectRatio: false,
  plugins: { legend: { display: false }, tooltip: { mode: 'index', intersect: false, backgroundColor: '#1f2937', titleColor: '#f9fafb', bodyColor: '#d1d5db', borderColor: '#374151', borderWidth: 1, padding: 10, cornerRadius: 8 } },
  scales: {
    x: { grid: { color: '#f0f2f8', drawBorder: false }, ticks: { color: '#9ca3af', font: { size: 11, family: 'Inter' }, maxRotation: 0 } },
    y: { grid: { color: '#f0f2f8', drawBorder: false }, ticks: { color: '#9ca3af', font: { size: 11, family: 'Inter' } }, border: { display: false } }
  }
};

// ─── OwnerHome Page ───────────────────────────────────────────────────────────
export function OwnerHome({ trips, liveData, isLoading, onRefresh, connStatus }) {
  const [truckFilter, setTruckFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const uniqueTrucks = [...new Set(trips.map(t => t.truck_id))];

  const baseFilteredTrips = trips.filter(t => {
    if (truckFilter !== 'all' && t.truck_id !== truckFilter) return false;
    
    // Check if trip is complete according to DB structure
    const isComplete = t.status === 'Complete' || t.status === 'COMPLETED';
    
    if (statusFilter === 'ACTIVE' && isComplete) return false;
    if (statusFilter === 'COMPLETED' && !isComplete) return false;
    
    return true;
  });

  const enriched = baseFilteredTrips.map(trip => {
    const sensors = liveData[trip.trip_id];
    const temps = sensors?.temperature_data || [];
    const motions = sensors?.motion_data || [];
    const currentTemp = temps.length > 0 ? Number(temps[temps.length - 1].avg) : null;
    const shockEvents = motions.filter(m => m.max_accel > 0.5).length;
    const maxShock = motions.length > 0 ? Math.max(...motions.map(m => m.max_accel)) : 0;
    
    // Borrowed Alert Logic from QA Inspector
    const hasTempViolation = temps.some(t => Number(t.avg) > -18);
    const hasMajorShock = maxShock > 0.5;

    const quality = computeQuality(sensors);
    
    // QA Logic: Temp violation is Critical, Major Shock is Warning
    let risk = 'safe';
    if (hasTempViolation) risk = 'crit';
    else if (hasMajorShock) risk = 'warn';

    return { ...trip, currentTemp, shockEvents, maxShock, quality, riskLevel: risk, hasTempViolation, hasMajorShock };
  });

  // A trip is active if its status is NOT Complete/COMPLETED
  const activeFull = enriched.filter(t => t.status !== 'Complete' && t.status !== 'COMPLETED');
  
  // QA-Aligned Alert Counts
  const critCount = enriched.filter(t => t.hasTempViolation).length;
  const warnCount = enriched.filter(t => t.hasMajorShock && !t.hasTempViolation).length;
  const allTemps = activeFull.filter(t => t.currentTemp !== null).map(t => t.currentTemp);
  const avgTemp = allTemps.length > 0 ? (allTemps.reduce((a, b) => a + b, 0) / allTemps.length).toFixed(1) : null;
  const avgQuality = enriched.length > 0 ? Math.round(enriched.reduce((s, t) => s + t.quality, 0) / enriched.length) : 100;
  const overallRisk = avgQuality;

  // Temp trend
  const timeBuckets = {};
  baseFilteredTrips.forEach(trip => {
    const s = liveData[trip.trip_id];
    if (s && s.temperature_data) {
      s.temperature_data.forEach(t => {
        if (!timeBuckets[t.time]) timeBuckets[t.time] = { sum: 0, n: 0 };
        timeBuckets[t.time].sum += Number(t.avg);
        timeBuckets[t.time].n++;
      });
    }
  });

  const parseTo24H = (timeStr) => {
    if (!timeStr) return "00:00";
    const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
    if (!match) return timeStr;
    let [_, h, m, mod] = match;
    h = parseInt(h, 10);
    if (h === 12) h = 0;
    if (mod.toUpperCase() === 'PM') h += 12;
    return `${h.toString().padStart(2, '0')}:${m}`;
  };

  const times = Object.keys(timeBuckets).sort((a, b) => parseTo24H(a).localeCompare(parseTo24H(b))).slice(-30);
  const tempVals = times.map(t => (timeBuckets[t].sum / timeBuckets[t].n).toFixed(2));

  const tempChartData = {
    labels: times.length > 0 ? times : ['No data'],
    datasets: [{
      label: 'Fleet Avg Temp (°C)',
      data: tempVals.length > 0 ? tempVals : [0],
      borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.1)',
      fill: true, tension: 0.1, borderWidth: 2.5,
      pointRadius: 3, pointBackgroundColor: '#3b82f6', pointBorderColor: '#fff', pointBorderWidth: 2,
    }]
  };

  // Vibration
  const shockRecords = [];
  baseFilteredTrips.slice(0, 12).forEach(t => {
    const s = liveData[t.trip_id];
    if (s?.motion_data?.length > 0) {
      const mx = Math.max(...s.motion_data.map(m => m.max_accel));
      // Append a short trip ID suffix so multiple trips for the same truck are distinguishable
      shockRecords.push({ label: `${t.truck_id} (..${t.trip_id.slice(-4)})`, max: mx });
    }
  });
  const vibChartData = {
    labels: shockRecords.map(r => r.label),
    datasets: [{ label: 'Vibration (g)', data: shockRecords.map(r => r.max), backgroundColor: shockRecords.map(r => r.max > 0.5 ? '#dc2626' : r.max > 0.3 ? '#d97706' : '#3b82f6'), borderRadius: 5 }]
  };

  // Alerts
  const alerts = enriched.filter(t => t.riskLevel === 'crit' || t.riskLevel === 'warn').map(t => {
    const reasons = [];
    if (t.currentTemp !== null && t.currentTemp > -18) reasons.push(`Temp breached: ${t.currentTemp.toFixed(1)}°C`);
    if (t.shockEvents > 0) reasons.push(`${t.shockEvents} vibration event${t.shockEvents > 1 ? 's' : ''}`);
    return { ...t, reasons };
  });

  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  const kpis = [
    {
      label: 'Active Trucks', value: activeFull.length,
      icon: '🚛', iconBg: '#eff6ff', color: '#3b82f6',
      sub: `${trips.filter(t => t.status === 'Complete' || t.status === 'COMPLETED').length} completed today`, subColor: '#059669'
    },
    {
      label: 'Critical Alerts', value: critCount,
      icon: '⚠️', iconBg: '#fef2f2', color: critCount > 0 ? '#dc2626' : '#111827',
      sub: critCount > 0 ? 'Requires immediate action' : '✓ No critical issues',
      subColor: critCount > 0 ? '#dc2626' : '#9ca3af'
    },
    {
      label: 'Average Temperature', value: avgTemp !== null ? `${avgTemp}°C` : '--',
      icon: '🌡️', iconBg: '#ecfdf5', color: avgTemp !== null && Number(avgTemp) <= -18 ? '#059669' : '#dc2626',
      sub: avgTemp !== null ? (Number(avgTemp) <= -18 ? '✓ Within safe limits' : '↑ Above safe average') : 'No active trucks',
      subColor: avgTemp !== null && Number(avgTemp) <= -18 ? '#059669' : '#dc2626'
    },
    {
      label: 'Quality Score', value: `${avgQuality}%`,
      icon: '⭐', iconBg: '#faf5ff', color: '#7c3aed',
      sub: warnCount > 0 ? `⚠ ${warnCount} trip${warnCount > 1 ? 's' : ''} with warnings` : '✓ Fleet average',
      subColor: warnCount > 0 ? '#d97706' : '#9ca3af'
    }
  ];

  return (
    <>
      {/* Page header */}
      <div className="owner-page-header">
        <div>
          <div className="owner-page-header__title">Dashboard</div>
          <div className="owner-page-header__sub">Fleet overview · {today}</div>
        </div>
        <div className="owner-page-header__actions">
          {connStatus === 'live' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 8, padding: '0.35rem 0.75rem', fontSize: '0.73rem', fontWeight: 700, color: '#059669' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', animation: 'o-pulse 2s ease infinite' }} />
              Real-Time Stream
            </div>
          )}
          {connStatus === 'polling' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '0.35rem 0.75rem', fontSize: '0.73rem', fontWeight: 700, color: '#d97706' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#f59e0b' }} />
              Polling (8s)
            </div>
          )}
          <button className={`owner-refresh-btn${isLoading ? ' loading' : ''}`} onClick={onRefresh} disabled={isLoading}>
            <span style={{ display: 'inline-block', animation: isLoading ? 'o-spin 0.65s linear infinite' : 'none' }}>↻</span>
            {isLoading ? 'Refreshing…' : 'Refresh Data'}
          </button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="owner-filterbar">
        <div className="owner-filter-chip">📅 {today}</div>
        
        <select 
          className={`owner-filter-chip ${truckFilter !== 'all' ? 'owner-filter-chip--active' : ''}`}
          value={truckFilter}
          onChange={(e) => setTruckFilter(e.target.value)}
          style={{ appearance: 'auto', outline: 'none', cursor: 'pointer' }}
        >
          <option value="all">🚛 All Trucks</option>
          {uniqueTrucks.map(id => <option key={id} value={id}>🚛 {id}</option>)}
        </select>

        <div className="owner-slider-filter">
          <button 
            className={`owner-slider-btn ${statusFilter === 'all' ? 'active' : ''}`}
            onClick={() => setStatusFilter('all')}
          >
            📋 All Trips
          </button>
          <button 
            className={`owner-slider-btn ${statusFilter === 'ACTIVE' ? 'active' : ''}`}
            onClick={() => setStatusFilter('ACTIVE')}
          >
            🟢 Active
          </button>
          <button 
            className={`owner-slider-btn ${statusFilter === 'COMPLETED' ? 'active' : ''}`}
            onClick={() => setStatusFilter('COMPLETED')}
          >
            ⚪ Complete
          </button>
          <div 
            className="owner-slider-indicator" 
            style={{ 
              transform: `translateX(${statusFilter === 'all' ? '0' : statusFilter === 'ACTIVE' ? '100%' : '200%'})` 
            }}
          />
        </div>
      </div>

      {/* KPIs */}
      <div className="owner-kpi-grid">
        {kpis.map((k, i) => (
          <div key={i} className="owner-kpi-card" style={{ '--kpi-color': k.color }}>
            <div className="owner-kpi-card__header">
              <span className="owner-kpi-card__label">{k.label}</span>
              <div className="owner-kpi-card__icon" style={{ background: k.iconBg }}>{k.icon}</div>
            </div>
            <div className="owner-kpi-card__value" style={{ color: k.color }}>{k.value}</div>
            <div className="owner-kpi-card__sub" style={{ color: k.subColor }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Temperature Trend */}
      <div className="owner-card">
        <div className="owner-card__header">
          <div className="owner-card__title">📈 Temperature Trend — Fleet Average</div>
          <button className="owner-card__action">⬇ Export CSV</button>
        </div>
        <div className="owner-card__body">
          <div style={{ position: 'relative', height: 270 }}>
            {/* Critical zone overlay: Y scale goes from 5 to -30 (range 35). -18 is 23 units down from 5. 23/35 = 65.7% height */}
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '65.7%', background: 'linear-gradient(180deg, rgba(220,38,38,0.08) 0%, rgba(220,38,38,0.02) 100%)', borderBottom: '1.5px dashed rgba(220,38,38,0.4)', zIndex: 1, pointerEvents: 'none', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
              <span style={{ color: '#dc2626', fontSize: '0.67rem', fontWeight: 700, padding: '0.25rem 0.5rem', opacity: 0.8, alignSelf: 'flex-start' }}>CRITICAL ZONE (&gt;-18°C)</span>
            </div>
            <Line data={tempChartData} options={{ ...baseChartOpts, scales: { ...baseChartOpts.scales, y: { ...baseChartOpts.scales.y, min: -30, max: 5, ticks: { ...baseChartOpts.scales.y.ticks, callback: v => `${v}°` } } } }} />
          </div>
        </div>
      </div>

      {/* Live Truck Monitoring */}
      <div className="owner-card">
        <div className="owner-card__header">
          <div className="owner-card__title">
            🔴 Live Truck Monitoring
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#10b981', display: 'inline-block', animation: 'o-spin 2.5s linear infinite', marginLeft: '0.25rem' }} />
          </div>
          <span style={{ fontSize: '0.75rem', color: '#9ca3af', fontWeight: 500 }}>{activeFull.length} active</span>
        </div>
        <div className="owner-table-wrap">
          <table className="owner-table">
            <thead>
              <tr>
                <th>Truck ID</th>
                <th>Trip ID</th>
                <th>Direction</th>
                <th>Temperature</th>
                <th>Max Vibration</th>
                <th>Quality Score</th>
                <th>Risk Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {activeFull.length > 0 ? activeFull.map(trip => {
                const isTempCrit = trip.currentTemp !== null && trip.currentTemp > -18;
                const isShockCrit = trip.maxShock > 0.5;
                return (
                  <tr key={trip.trip_id}>
                    <td style={{ fontWeight: 800, fontSize: '0.82rem' }}>{trip.truck_id}</td>
                    <td style={{ color: '#9ca3af', fontFamily: 'monospace', fontSize: '0.75rem' }}>{trip.trip_id.slice(0, 14)}…</td>
                    <td>
                      <span className={`o-badge ${(trip.trip_type === 'OUTGOING' || trip.trip_direction === 'OUTBOUND') ? 'o-badge--info' : 'o-badge--neutral'}`}>
                        {trip.trip_type || trip.trip_direction || 'INB'}
                      </span>
                    </td>
                    <td style={{ fontWeight: isTempCrit ? 700 : 400, color: isTempCrit ? '#dc2626' : '#111827' }}>
                      {trip.currentTemp !== null ? `${trip.currentTemp.toFixed(1)}°C` : '--'}
                    </td>
                    <td style={{ color: isShockCrit ? '#d97706' : '#111827', fontWeight: isShockCrit ? 600 : 400 }}>
                      {trip.maxShock.toFixed(2)}g
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={{ flex: 1, height: 5, background: '#f0f2f8', borderRadius: 4, maxWidth: 64, minWidth: 40 }}>
                          <div style={{ width: `${trip.quality}%`, height: '100%', borderRadius: 4, transition: 'width 0.6s', background: trip.riskLevel === 'safe' ? '#059669' : trip.riskLevel === 'warn' ? '#d97706' : '#dc2626' }} />
                        </div>
                        <span style={{ fontSize: '0.82rem', fontWeight: 700, minWidth: 32 }}>{trip.quality}%</span>
                      </div>
                    </td>
                    <td><StatusBadge status={trip.riskLevel} /></td>
                    <td>
                      <button className="owner-btn owner-btn--ghost" style={{ padding: '0.25rem 0.5rem', fontSize: '1rem', letterSpacing: '0.1em' }}>•••</button>
                    </td>
                  </tr>
                );
              }) : (
                <tr><td colSpan={8}>
                  <div className="owner-empty">
                    <div className="owner-empty__icon">🚛</div>
                    <div className="owner-empty__title">No active trips right now</div>
                    <div className="owner-empty__sub">All trucks are currently docked at the warehouse</div>
                  </div>
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Vibration + Gauge */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.25rem' }}>
        <div className="owner-card">
          <div className="owner-card__header">
            <div className="owner-card__title">⚡ Vibration Monitoring</div>
            {shockRecords.filter(r => r.max > 0.5).length > 0 && (
              <span style={{ fontSize: '0.73rem', color: '#dc2626', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                ⚠ {shockRecords.filter(r => r.max > 0.5).length} spike{shockRecords.filter(r => r.max > 0.5).length > 1 ? 's' : ''} detected
              </span>
            )}
          </div>
          <div className="owner-card__body">
            <div style={{ height: 210 }}>
              {shockRecords.length > 0
                ? <Bar data={vibChartData} options={{ ...baseChartOpts, scales: { ...baseChartOpts.scales, y: { ...baseChartOpts.scales.y, min: 0, ticks: { ...baseChartOpts.scales.y.ticks, callback: v => `${v}g` } } } }} />
                : (
                  <div className="owner-empty">
                    <div className="owner-empty__icon">📉</div>
                    <div className="owner-empty__title">No vibration data yet</div>
                    <div className="owner-empty__sub">Data appears once trucks begin transmitting</div>
                  </div>
                )
              }
            </div>
          </div>
        </div>

        <div className="owner-card">
          <div className="owner-card__header">
            <div className="owner-card__title">🎯 Trip Risk Level</div>
          </div>
          <div className="owner-card__body" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', paddingTop: '1.5rem' }}>
            <Gauge value={overallRisk} size={200} />
            <div style={{ display: 'flex', gap: '1rem', fontSize: '0.73rem', color: '#6b7280', marginTop: '0.5rem', borderTop: '1px solid #f0f2f8', paddingTop: '0.875rem', width: '100%', justifyContent: 'space-around' }}>
              <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem' }}>
                <span style={{ fontWeight: 800, color: '#059669', fontSize: '1.1rem' }}>{enriched.filter(t => t.riskLevel === 'safe').length}</span>
                <span style={{ fontSize: '0.65rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Safe</span>
              </span>
              <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem' }}>
                <span style={{ fontWeight: 800, color: '#d97706', fontSize: '1.1rem' }}>{enriched.filter(t => t.riskLevel === 'warn').length}</span>
                <span style={{ fontSize: '0.65rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Warning</span>
              </span>
              <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem' }}>
                <span style={{ fontWeight: 800, color: '#dc2626', fontSize: '1.1rem' }}>{enriched.filter(t => t.riskLevel === 'crit').length}</span>
                <span style={{ fontSize: '0.65rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Critical</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Alerts */}
      <div className="owner-card">
        <div className="owner-card__header">
          <div className="owner-card__title">🔔 Recent Alerts</div>
          <button className="owner-card__action">View All →</button>
        </div>
        <div className="owner-card__body" style={{ padding: '0 1.25rem' }}>
          {alerts.length > 0 ? alerts.slice(0, 5).map((t, i) => (
            <div key={i} className="owner-alert-item">
              <div className="owner-alert-item__icon" style={{ background: t.status === 'crit' ? '#fef2f2' : '#fffbeb' }}>
                {t.status === 'crit' ? '🌡️' : '⚡'}
              </div>
              <div className="owner-alert-item__body">
                <div className="owner-alert-item__title">
                  {t.status === 'crit' ? '🔴 Critical Alert' : '⚠ Warning'} — {t.truck_id}
                </div>
                <div className="owner-alert-item__desc">{t.reasons.join(' · ')}</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.4rem', flexShrink: 0 }}>
                <StatusBadge status={t.riskLevel} />
                <div className="owner-alert-item__time">{timeAgo(liveData[t.trip_id]?.last_updated)}</div>
              </div>
            </div>
          )) : (
            <div className="owner-empty" style={{ padding: '2rem' }}>
              <div className="owner-empty__icon">✅</div>
              <div className="owner-empty__title">All clear — no alerts</div>
              <div className="owner-empty__sub">All fleet operations are within normal parameters</div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export { computeQuality as default };
