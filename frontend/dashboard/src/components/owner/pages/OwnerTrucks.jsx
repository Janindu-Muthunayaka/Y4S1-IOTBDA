import React from 'react';
import { useNavigate } from 'react-router-dom';
import { computeQuality, riskLevel, StatusBadge } from './OwnerHome';

export default function OwnerTrucks({ trips, liveData }) {
  const navigate = useNavigate();

  // Group by truck_id, pick most recent trip per truck
  const truckMap = {};
  trips.forEach(trip => {
    if (!truckMap[trip.truck_id] || new Date(trip.timestamp) > new Date(truckMap[trip.truck_id].timestamp)) {
      truckMap[trip.truck_id] = trip;
    }
  });
  const trucks = Object.values(truckMap);

  const enriched = trucks.map(trip => {
    const sensors = liveData[trip.trip_id];
    const temps = sensors?.temperature_data || [];
    const motions = sensors?.motion_data || [];
    const currentTemp = temps.length > 0 ? Number(temps[temps.length - 1].avg) : null;
    const maxShock = motions.length > 0 ? Math.max(...motions.map(m => m.max_accel)) : 0;
    const quality = computeQuality(sensors);
    const risk = riskLevel(quality);
    const tripsCount = trips.filter(t => t.truck_id === trip.truck_id).length;
    const completedCount = trips.filter(t => t.truck_id === trip.truck_id && (t.status === 'COMPLETED' || t.status === 'Complete')).length;
    return { ...trip, currentTemp, maxShock, quality, riskLevel: risk, tripsCount, completedCount };
  });

  return (
    <>
      <div className="owner-page-header">
        <div className="owner-page-header__left">
          <div className="owner-page-header__title">Fleet Trucks</div>
          <div className="owner-page-header__sub">
            {trucks.length} truck{trucks.length !== 1 ? 's' : ''} registered — click to view details
          </div>
        </div>
        <div className="owner-page-header__actions">
          <div className="owner-stats-pill">
            Active: <strong>{enriched.filter(t => trips.some(x => x.truck_id === t.truck_id && (x.active || x.status === 'ACTIVE'))).length}</strong>
          </div>
          <div className="owner-stats-pill">
            Critical: <strong style={{ color: '#ef4444' }}>{enriched.filter(t => t.riskLevel === 'crit').length}</strong>
          </div>
        </div>
      </div>

      {enriched.length === 0 ? (
        <div className="owner-card">
          <div className="owner-empty" style={{ padding: '4rem' }}>
            <div className="owner-empty__icon">🚛</div>
            <div className="owner-empty__title">No trucks registered</div>
            <div className="owner-empty__sub">Trip data will appear here once trucks start scanning at the gate</div>
          </div>
        </div>
      ) : (
        <div className="owner-truck-grid">
          {enriched.map(truck => {
            const foundTrip = trips.find(x => x.trip_id === truck.trip_id);
            const isActive = foundTrip?.active || foundTrip?.status === 'ACTIVE';
            return (
              <div
                key={truck.truck_id}
                className="owner-truck-card"
                onClick={() => navigate(`/owner/trucks/${truck.truck_id}`)}
              >
                <div className="owner-truck-card__header">
                  <div className="owner-truck-card__id">
                    🚛 {truck.truck_id}
                  </div>
                  <StatusBadge status={truck.riskLevel} />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span className={`o-badge ${isActive ? 'o-badge--safe' : 'o-badge--neutral'}`}>
                    {isActive ? '● Active' : '○ Docked'}
                  </span>
                  <span style={{ fontSize: '0.72rem', color: '#9ca3af' }}>
                    {truck.trip_type || truck.trip_direction || 'Unknown'}
                  </span>
                </div>

                <div className="owner-truck-card__metrics">
                  <div className="owner-truck-card__metric">
                    <div className="owner-truck-card__metric-label">🌡 Temperature</div>
                    <div className="owner-truck-card__metric-value"
                      style={{ color: truck.currentTemp !== null && truck.currentTemp > -18 ? '#ef4444' : '#111827' }}>
                      {truck.currentTemp !== null ? `${truck.currentTemp.toFixed(1)}°C` : '--'}
                    </div>
                  </div>
                  <div className="owner-truck-card__metric">
                    <div className="owner-truck-card__metric-label">⚡ Max Shock</div>
                    <div className="owner-truck-card__metric-value"
                      style={{ color: truck.maxShock > 0.5 ? '#f59e0b' : '#111827' }}>
                      {truck.maxShock.toFixed(2)}g
                    </div>
                  </div>
                  <div className="owner-truck-card__metric">
                    <div className="owner-truck-card__metric-label">⭐ Quality</div>
                    <div className="owner-truck-card__metric-value">{truck.quality}%</div>
                  </div>
                  <div className="owner-truck-card__metric">
                    <div className="owner-truck-card__metric-label">📦 Trips</div>
                    <div className="owner-truck-card__metric-value">{truck.tripsCount}</div>
                  </div>
                </div>

                {/* Quality bar */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#9ca3af', marginBottom: '0.3rem' }}>
                    <span>Quality Score</span>
                    <span>{truck.quality}%</span>
                  </div>
                  <div style={{ height: 5, background: '#f3f4f6', borderRadius: 4 }}>
                    <div style={{
                      width: `${truck.quality}%`, height: '100%', borderRadius: 4, transition: 'width 0.6s',
                      background: truck.riskLevel === 'safe' ? '#10b981' : truck.riskLevel === 'warn' ? '#f59e0b' : '#ef4444'
                    }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* All Trips Table */}
      <div className="owner-card" style={{ marginTop: '0.5rem' }}>
        <div className="owner-card__header">
          <div className="owner-card__title">📋 All Trip Records</div>
          <span style={{ fontSize: '0.78rem', color: '#9ca3af' }}>{trips.length} total records</span>
        </div>
        <div className="owner-table-wrap">
          <table className="owner-table">
            <thead>
              <tr>
                <th>Trip ID</th>
                <th>Truck</th>
                <th>Direction</th>
                <th>Start Weight</th>
                <th>End Weight</th>
                <th>Started</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {trips.slice(0, 20).map(trip => (
                <tr key={trip.trip_id} onClick={() => navigate(`/owner/trucks/${trip.truck_id}?trip=${trip.trip_id}`)} style={{ cursor: 'pointer' }}>
                  <td style={{ fontFamily: 'monospace', fontSize: '0.78rem' }}>{trip.trip_id.slice(0, 16)}…</td>
                  <td>{trip.truck_id}</td>
                  <td>
                    <span className={`o-badge ${(trip.trip_type === 'OUTGOING' || trip.trip_direction === 'OUTBOUND') ? 'o-badge--info' : 'o-badge--neutral'}`}>
                      {trip.trip_type || trip.trip_direction || 'N/A'}
                    </span>
                  </td>
                  <td>
                    {(() => {
                      const w1 = trip.startWeight ?? trip.weight1;
                      return w1 != null ? `${w1} kg` : '--';
                    })()}
                  </td>
                  <td>
                    {(() => {
                      const w2 = trip.endWeight ?? trip.weight2;
                      return w2 != null ? `${w2} kg` : '--';
                    })()}
                  </td>
                  <td style={{ color: '#6b7280' }}>
                    {trip.timestamp ? new Date(trip.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '--'}
                  </td>
                  <td>
                    <span className={`o-badge ${(trip.status === 'Complete' || trip.status === 'COMPLETED') ? 'o-badge--neutral' : 'o-badge--safe o-badge--dot'}`}>
                      {trip.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
