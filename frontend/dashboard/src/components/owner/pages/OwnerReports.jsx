import React, { useMemo } from 'react';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import { computeQuality, fmtDate } from './OwnerHome';

ChartJS.register(ArcElement, Tooltip, Legend);

export default function OwnerReports({ trips, liveData }) {
  const now = new Date();
  const oneWeekAgo = new Date(now - 7 * 24 * 3600 * 1000);
  const oneMonthAgo = new Date(now - 30 * 24 * 3600 * 1000);

  const completedTrips = trips.filter(t => t.active === false || t.status === 'COMPLETED' || t.status === 'Complete');
  const weekTrips = completedTrips.filter(t => new Date(t.timestamp) >= oneWeekAgo);
  const monthTrips = completedTrips.filter(t => new Date(t.timestamp) >= oneMonthAgo);

  const enriched = useMemo(() => trips.map(trip => {
    const sensors = liveData[trip.trip_id];
    const quality = computeQuality(sensors);
    const w1 = trip.startWeight ?? trip.weight1;
    const w2 = trip.endWeight ?? trip.weight2;
    const wLoss = (w1 != null && w2 != null && w1 > 0)
      ? ((w1 - w2) / w1 * 100).toFixed(1)
      : null;
    return { ...trip, quality, wLoss };
  }), [trips, liveData]);

  const avgQuality = enriched.length > 0
    ? Math.round(enriched.reduce((s, t) => s + t.quality, 0) / enriched.length)
    : '--';

  const completedOutbound = completedTrips.filter(t => t.trip_type === 'OUTGOING' || t.trip_direction === 'OUTBOUND').length;
  const completedInbound = completedTrips.filter(t => t.trip_type === 'INCOMING' || t.trip_direction === 'INBOUND').length;

  // Unique trucks
  const uniqueTrucks = [...new Set(trips.map(t => t.truck_id))];

  // CSV export
  const handleExportCSV = () => {
    const headers = ['Trip ID', 'Truck ID', 'Direction', 'Start Weight (kg)', 'End Weight (kg)', 'Status', 'Quality Score', 'Started At'];
    const rows = enriched.map(t => [
      t.trip_id, t.truck_id, t.trip_type || t.trip_direction || 'N/A',
      t.startWeight ?? t.weight1 ?? '', t.endWeight ?? t.weight2 ?? '',
      t.status, t.quality + '%',
      t.timestamp ? new Date(t.timestamp).toLocaleString() : ''
    ]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'cargolink_trips.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const stats = [
    { label: 'Total Trips', value: trips.length, icon: '📋', color: '#3b82f6', bg: '#eff6ff' },
    { label: 'Completed', value: completedTrips.length, icon: '✅', color: '#10b981', bg: '#f0fdf4' },
    { label: 'This Week', value: weekTrips.length, icon: '📅', color: '#8b5cf6', bg: '#f5f3ff' },
    { label: 'This Month', value: monthTrips.length, icon: '📆', color: '#f59e0b', bg: '#fffbeb' },
    { label: 'Avg Quality', value: `${avgQuality}%`, icon: '⭐', color: '#ec4899', bg: '#fdf2f8' },
    { label: 'Registered Trucks', value: uniqueTrucks.length, icon: '🚛', color: '#06b6d4', bg: '#ecfeff' },
  ];

  return (
    <>
      <div className="owner-page-header">
        <div className="owner-page-header__left">
          <div className="owner-page-header__title">Reports</div>
          <div className="owner-page-header__sub">Fleet performance summary and data export</div>
        </div>
        <div className="owner-page-header__actions">
          <button className="owner-btn owner-btn--primary" onClick={handleExportCSV}>
            ⬇ Export All Trips CSV
          </button>
        </div>
      </div>

      {/* Stats grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
        {stats.map((s, i) => (
          <div key={i} className="owner-kpi-card">
            <div className="owner-kpi-card__header">
              <span className="owner-kpi-card__label">{s.label}</span>
              <div className="owner-kpi-card__icon" style={{ background: s.bg, fontSize: '1rem' }}>{s.icon}</div>
            </div>
            <div className="owner-kpi-card__value" style={{ color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Trip direction breakdown */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        <div className="owner-card">
          <div className="owner-card__header">
            <div className="owner-card__title">📊 Trip Direction Breakdown</div>
          </div>
          <div className="owner-card__body" style={{ height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ position: 'relative', height: '100%', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Doughnut 
                data={{
                  labels: [`Outbound: ${completedOutbound}`, `Inbound: ${completedInbound}`],
                  datasets: [{
                    data: [completedOutbound, completedInbound],
                    backgroundColor: ['#3b82f6', '#8b5cf6'],
                    hoverBackgroundColor: ['#2563eb', '#7c3aed'],
                    borderWidth: 0,
                    cutout: '72%'
                  }]
                }}
                options={{
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      position: 'bottom',
                      labels: {
                        usePointStyle: true,
                        padding: 20,
                        font: { size: 12, weight: 700, family: 'Inter' },
                        color: '#374151'
                      }
                    },
                    tooltip: {
                      backgroundColor: '#1f2937',
                      padding: 12,
                      cornerRadius: 8,
                      titleFont: { size: 13, weight: 700 }
                    }
                  }
                }}
              />
              <div style={{ position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center', pointerEvents: 'none', left: '50%', top: '44%', transform: 'translate(-50%, -50%)' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Completed</span>
                <span style={{ fontSize: '2rem', fontWeight: 900, color: '#111827', lineHeight: 1 }}>{completedTrips.length}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="owner-card">
          <div className="owner-card__header">
            <div className="owner-card__title">🚛 Truck Registry</div>
          </div>
          <div className="owner-card__body" style={{ padding: 0 }}>
            {uniqueTrucks.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {uniqueTrucks.map((truckId, i) => {
                  const truckTrips = enriched.filter(t => t.truck_id === truckId);
                  const avgQ = Math.round(truckTrips.reduce((s, t) => s + t.quality, 0) / truckTrips.length);
                  return (
                    <div key={i} style={{ padding: '0.75rem 1.25rem', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: '0.9rem', color: '#111827' }}>🚛 {truckId}</div>
                        <div style={{ fontSize: '0.72rem', color: '#9ca3af', fontWeight: 500 }}>{truckTrips.length} trips recorded</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '0.72rem', color: '#9ca3af' }}>Avg Quality</div>
                          <div style={{ fontSize: '0.9rem', fontWeight: 700, color: avgQ >= 90 ? '#10b981' : avgQ >= 70 ? '#f59e0b' : '#ef4444' }}>{avgQ}%</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="owner-empty"><div className="owner-empty__icon">🚛</div><div className="owner-empty__title">No trucks registered</div></div>
            )}
          </div>
        </div>
      </div>

      {/* Quality breakdown table */}
      <div className="owner-card">
        <div className="owner-card__header">
          <div className="owner-card__title">📋 Quality Score Breakdown by Trip</div>
          <button className="owner-card__action" onClick={handleExportCSV}>⬇ Download CSV</button>
        </div>
        <div className="owner-table-wrap">
          <table className="owner-table">
            <thead>
              <tr>
                <th>Trip ID</th>
                <th>Truck</th>
                <th>Direction</th>
                <th>Weight In</th>
                <th>Weight Out</th>
                <th>Weight Loss</th>
                <th>Quality</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {enriched.slice(0, 15).map((t, i) => (
                <tr key={i}>
                  <td style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{t.trip_id.slice(0, 14)}…</td>
                  <td style={{ fontWeight: 700 }}>{t.truck_id}</td>
                  <td><span className={`o-badge ${(t.trip_type === 'OUTGOING' || t.trip_direction === 'OUTBOUND') ? 'o-badge--info' : 'o-badge--neutral'}`}>{t.trip_type || t.trip_direction || 'N/A'}</span></td>
                  <td>
                    {(() => {
                      const w1 = t.startWeight ?? t.weight1;
                      return w1 != null ? `${w1} kg` : '--';
                    })()}
                  </td>
                  <td>
                    {(() => {
                      const w2 = t.endWeight ?? t.weight2;
                      return w2 != null ? `${w2} kg` : '--';
                    })()}
                  </td>
                  <td style={{ color: t.wLoss !== null && parseFloat(t.wLoss) > 5 ? '#ef4444' : '#10b981' }}>
                    {t.wLoss !== null ? `${t.wLoss}%` : '--'}
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <div style={{ width: 40, height: 4, background: '#f3f4f6', borderRadius: 2 }}>
                        <div style={{ width: `${t.quality}%`, height: '100%', background: t.quality >= 90 ? '#10b981' : t.quality >= 70 ? '#f59e0b' : '#ef4444', borderRadius: 2 }} />
                      </div>
                      <span style={{ fontSize: '0.82rem', fontWeight: 700 }}>{t.quality}%</span>
                    </div>
                  </td>
                  <td style={{ color: '#6b7280', fontSize: '0.8rem' }}>{fmtDate(t.timestamp)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
