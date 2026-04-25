import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement,
  LineElement, BarElement, Title, Tooltip, Legend, Filler
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';
import { computeQuality, riskStatus, fmtDate, fmtTime, timeAgo, Gauge, StatusBadge } from './OwnerHome';
import { useChatbot } from '../Owner_Chatbot/Owner_ChatbotContext';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, Filler);

const API_BASE = 'http://localhost:3001';

export default function OwnerTruckDetail({ trips: allTrips }) {
  const { truckId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const targetTripId = queryParams.get('trip');
  const [sensorData, setSensorData] = useState(null);
  const [tripDetail, setTripDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const { updateSnapshot } = useChatbot();

  // Find the most recent trip for this truck
  const truckTrips = allTrips.filter(t => t.truck_id === truckId).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  // Use the requested trip if present, otherwise fallback to the most recent
  const latestTrip = targetTripId ? truckTrips.find(t => t.trip_id === targetTripId) || truckTrips[0] : truckTrips[0];

  useEffect(() => {
    if (!latestTrip) { setLoading(false); return; }
    let mounted = true;
    const fetchSensors = async () => {
      try {
        const { data } = await axios.get(`${API_BASE}/api/trips/${latestTrip.trip_id}/sensors`);
        if (mounted) {
          setSensorData(data.sensorData || { temperature_data: [], motion_data: [] });
          setTripDetail(data.trip);
          setLoading(false);
        }
      } catch (e) { console.error(e); setLoading(false); }
    };
    fetchSensors();
    const iv = setInterval(fetchSensors, 5000);
    return () => { mounted = false; clearInterval(iv); };
  }, [latestTrip?.trip_id]);

  const temps = sensorData?.temperature_data || [];
  const motions = sensorData?.motion_data || [];
  const currentTemp = temps.length > 0 ? Number(temps[temps.length - 1].avg) : null;
  const maxShock = motions.length > 0 ? Math.max(...motions.map(m => m.max_accel)) : 0;
  const quality = computeQuality(sensorData);
  const status = riskStatus(quality);

  const w1 = latestTrip?.startWeight ?? latestTrip?.weight1;
  const w2 = latestTrip?.endWeight ?? latestTrip?.weight2;
  const weightLoss = (w1 != null && w2 != null && w1 > 0) ? (((w1 - w2) / w1) * 100).toFixed(1) : null;

  const isActive = latestTrip?.status === 'ACTIVE';

  useEffect(() => {
    if (sensorData && latestTrip) {
      updateSnapshot({
        type: 'SINGLE_TRIP',
        trip: latestTrip,
        sensorData: sensorData,
        weightLoss: weightLoss,
        kpis: {
          qualityScore: quality,
          tempCompliance: temps.length > 0 ? Math.round(((temps.length - temps.filter(t => Number(t.avg) > -18).length) / temps.length) * 100) : 100,
          cold: temps.filter(t => Number(t.avg) < -22),
          hot: temps.filter(t => Number(t.avg) > -18),
          shocks: motions.filter(m => m.max_accel > 0.5)
        }
      });
    }
  }, [sensorData, latestTrip, quality, temps, motions, weightLoss, updateSnapshot]);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', flexDirection: 'column', gap: '1rem' }}>
      <div className="owner-spinner" style={{ width: 40, height: 40 }} />
      <div style={{ color: '#6b7280', fontSize: '0.875rem' }}>Loading truck data…</div>
    </div>
  );

  if (!latestTrip) return (
    <div className="owner-empty" style={{ marginTop: '4rem' }}>
      <div className="owner-empty__icon">🚛</div>
      <div className="owner-empty__title">Truck not found</div>
      <div className="owner-empty__sub">No trip data for truck {truckId}</div>
      <button className="owner-btn owner-btn--outline" style={{ marginTop: '1rem' }} onClick={() => navigate('/owner/trucks')}>← Back to Trucks</button>
    </div>
  );

  // Charts
  const chartOpts = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { color: '#f3f4f6' }, ticks: { color: '#9ca3af', font: { size: 10 } } },
      y: { grid: { color: '#f3f4f6' }, ticks: { color: '#9ca3af', font: { size: 10 } } }
    }
  };

  const tempChartData = {
    labels: temps.map(t => t.time),
    datasets: [{
      label: 'Temperature (°C)',
      data: temps.map(t => Number(t.avg)),
      borderColor: '#3b82f6',
      backgroundColor: 'rgba(59,130,246,0.07)',
      fill: true, tension: 0.4, borderWidth: 2.5,
      pointRadius: 3, pointBackgroundColor: '#3b82f6', pointBorderColor: '#fff', pointBorderWidth: 2,
    }, {
      label: 'Safe Limit',
      data: temps.map(() => -18),
      borderColor: '#ef4444',
      borderDash: [6, 3],
      borderWidth: 1.5,
      pointRadius: 0,
      fill: false,
    }]
  };

  const vibChartData = {
    labels: motions.map(m => m.time),
    datasets: [{
      label: 'Vibration (g)',
      data: motions.map(m => m.max_accel),
      backgroundColor: motions.map(m => m.max_accel > 0.5 ? '#ef4444' : m.max_accel > 0.3 ? '#f59e0b' : '#3b82f6'),
      borderRadius: 3,
    }]
  };

  // Alerts for this truck
  const truckAlerts = [];
  if (currentTemp !== null && currentTemp > -18)
    truckAlerts.push({ type: 'crit', title: 'High Temperature Alert', desc: `Temperature reached ${currentTemp.toFixed(1)}°C, exceeding -18°C safe limit.`, time: sensorData?.last_updated });
  if (maxShock > 0.5)
    truckAlerts.push({ type: 'warn', title: 'Vibration Spike Detected', desc: `Significant force event detected (max ${maxShock.toFixed(2)}g). Route may have severe road conditions.`, time: sensorData?.last_updated });
  if (w1 != null && w2 != null && Math.abs(w1 - w2) > w1 * 0.05)
    truckAlerts.push({ type: 'warn', title: 'Weight Anomaly', desc: `Load cell sensors indicate a ${weightLoss}% drop in total cargo weight.`, time: latestTrip.timestamp });

  return (
    <>
      {/* Breadcrumb / Back */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
        <button className="owner-btn owner-btn--ghost" style={{ padding: '0.3rem 0.5rem' }} onClick={() => navigate('/owner/trucks')}>
          ← Trucks
        </button>
        <span style={{ color: '#d1d5db' }}>/</span>
        <span style={{ color: '#6b7280', fontSize: '0.85rem' }}>{truckId}</span>
      </div>

      {/* Page header */}
      <div className="owner-page-header">
        <div className="owner-page-header__left">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
            <div className="owner-page-header__title">Truck Details — {truckId}</div>
            <span className={`o-badge ${isActive ? 'o-badge--safe o-badge--dot' : 'o-badge--neutral'}`}
              style={{ fontSize: '0.72rem' }}>
              {latestTrip.trip_id.slice(0, 14)}...
            </span>
          </div>
          <div className="owner-page-header__sub">
            Last updated: {timeAgo(sensorData?.last_updated)} · {truckTrips.length} total trip{truckTrips.length !== 1 ? 's' : ''}
          </div>
        </div>
        <div className="owner-page-header__actions">
          <button className="owner-btn owner-btn--outline">🖨 Print</button>
          <button className="owner-btn owner-btn--primary">⬇ Export Report</button>
        </div>
      </div>

      {/* Trip Meta Row */}
      <div className="owner-detail-meta">
        <div className="owner-meta-item">
          <div className="owner-meta-item__label">👤 Driver</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg,#c084fc,#a855f7)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '0.7rem', fontWeight: 700 }}>D</div>
            <div className="owner-meta-item__value" style={{ fontSize: '0.82rem' }}>— Assigned Driver</div>
          </div>
        </div>
        <div className="owner-meta-item">
          <div className="owner-meta-item__label">🕒 Start Time</div>
          <div className="owner-meta-item__value">{fmtDate(latestTrip.timestamp)}</div>
          <div className="owner-meta-item__sub">{fmtTime(latestTrip.timestamp)}</div>
        </div>
        <div className="owner-meta-item">
          <div className="owner-meta-item__label">📍 Direction</div>
          <div className="owner-meta-item__value">{latestTrip.trip_direction || 'Unknown'}</div>
          <div className="owner-meta-item__sub">{isActive ? 'Trip in progress' : 'Completed'}</div>
        </div>
        <div className="owner-meta-item">
          <div className="owner-meta-item__label">🎫 Trip ID</div>
          <div className="owner-meta-item__value" style={{ fontSize: '0.7rem', fontFamily: 'monospace' }}>{latestTrip.trip_id}</div>
        </div>
      </div>

      {/* Main detail grid */}
      <div className="owner-detail-grid">
        {/* LEFT: Charts */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="owner-card">
            <div className="owner-card__header">
              <div className="owner-card__title">
                🌡 Temperature Chart (°C)
                <span style={{ fontSize: '0.72rem', padding: '0.15rem 0.5rem', background: '#d1fae5', color: '#065f46', borderRadius: 4, fontWeight: 600 }}>
                  Safe Zone (≤ -18°C)
                </span>
              </div>
              <span style={{ fontSize: '0.72rem', color: '#6b7280' }}>{temps.length} readings</span>
            </div>
            <div className="owner-card__body">
              <div style={{ height: 220 }}>
                {temps.length > 0
                  ? <Line data={tempChartData} options={{ ...chartOpts, plugins: { ...chartOpts.plugins, legend: { display: true, labels: { color: '#6b7280', font: { size: 11 } } } }, scales: { ...chartOpts.scales, y: { ...chartOpts.scales.y, min: Math.min(...temps.map(t => Number(t.avg))) - 5, max: Math.max(...temps.map(t => Number(t.avg))) + 3 } } }} />
                  : <div className="owner-empty"><div className="owner-empty__icon">📉</div><div className="owner-empty__title">No temperature data yet</div></div>
                }
              </div>
            </div>
          </div>

          <div className="owner-card">
            <div className="owner-card__header">
              <div className="owner-card__title">⚡ Vibration Monitoring Chart</div>
              {maxShock > 0 && <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>Max recorded: <strong style={{ color: maxShock > 0.5 ? '#ef4444' : '#111827' }}>{maxShock.toFixed(2)}g</strong></span>}
            </div>
            <div className="owner-card__body">
              <div style={{ height: 200 }}>
                {motions.length > 0
                  ? <Bar data={vibChartData} options={chartOpts} />
                  : <div className="owner-empty"><div className="owner-empty__icon">📊</div><div className="owner-empty__title">No vibration data yet</div></div>
                }
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT: Gauge + Cargo + Alerts */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Risk gauge */}
          <div className="owner-card">
            <div className="owner-card__header">
              <div className="owner-card__title">🎯 Trip Risk Status</div>
            </div>
            <div className="owner-card__body" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <Gauge value={quality} size={200} />
              <div style={{
                marginTop: '0.75rem', padding: '0.4rem 1.25rem',
                background: status === 'safe' ? '#d1fae5' : status === 'warn' ? '#fef3c7' : '#fee2e2',
                color: status === 'safe' ? '#065f46' : status === 'warn' ? '#92400e' : '#991b1b',
                borderRadius: 20, fontSize: '0.8rem', fontWeight: 700
              }}>
                {status === 'safe' ? '✓ Safe — Normal Operations' : status === 'warn' ? '⚠ Elevated Risk' : '⛔ Critical — Action Required'}
              </div>
            </div>
          </div>

          {/* Cargo monitoring */}
          <div className="owner-card">
            <div className="owner-card__header">
              <div className="owner-card__title">📦 Cargo Monitoring</div>
              <span style={{ fontSize: '0.72rem', color: '#9ca3af' }}>Live weight mapping of loaded fish</span>
            </div>
            <div className="owner-card__body">
              <div className="owner-cargo-bar">
                <div className="owner-cargo-weight">
                  <div className="owner-cargo-weight__label">Start Weight</div>
                  <div className="owner-cargo-weight__val">{w1 != null ? `${w1} kg` : '--'}</div>
                </div>
                <div className="owner-cargo-arrow">→</div>
                <div className="owner-cargo-weight">
                  <div className="owner-cargo-weight__label">End Weight</div>
                  <div className="owner-cargo-weight__val">{w2 != null ? `${w2} kg` : '--'}</div>
                </div>
              </div>
              {weightLoss !== null && (
                <div style={{
                  marginTop: '0.75rem', padding: '0.625rem 1rem',
                  background: parseFloat(weightLoss) > 5 ? '#fee2e2' : '#f0fdf4',
                  borderRadius: 8, fontWeight: 600, fontSize: '0.82rem',
                  color: parseFloat(weightLoss) > 5 ? '#991b1b' : '#065f46',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                }}>
                  <span>Detected Weight Loss</span>
                  <span>~{Math.abs(w1 - w2).toFixed(0)} kg ({weightLoss}%)</span>
                </div>
              )}
              {(w1 == null || w2 == null) && (
                <div style={{ marginTop: '0.75rem', padding: '0.625rem 1rem', background: '#f9fafb', borderRadius: 8, fontSize: '0.82rem', color: '#9ca3af', textAlign: 'center' }}>
                  Weight data available after trip completion
                </div>
              )}
            </div>
          </div>

          {/* Alerts */}
          <div className="owner-card">
            <div className="owner-card__header">
              <div className="owner-card__title">🔔 Recent Alerts</div>
              <button className="owner-card__action">View All</button>
            </div>
            <div className="owner-card__body" style={{ padding: '0.5rem 1.25rem' }}>
              {truckAlerts.length > 0 ? truckAlerts.map((a, i) => (
                <div key={i} className="owner-alert-item">
                  <div className="owner-alert-item__icon" style={{ background: a.type === 'crit' ? '#fee2e2' : '#fef3c7' }}>
                    {a.type === 'crit' ? '🌡️' : '⚡'}
                  </div>
                  <div className="owner-alert-item__body">
                    <div className="owner-alert-item__title">{a.title}</div>
                    <div className="owner-alert-item__desc">{a.desc}</div>
                    <div className="owner-alert-item__time">{timeAgo(a.time)}</div>
                  </div>
                </div>
              )) : (
                <div className="owner-empty" style={{ padding: '1.5rem' }}>
                  <div className="owner-empty__icon">✅</div>
                  <div className="owner-empty__title">No alerts for this truck</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
