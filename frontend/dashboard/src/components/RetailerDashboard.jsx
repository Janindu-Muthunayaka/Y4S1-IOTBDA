import React, { useEffect, useState } from 'react';
import axios from 'axios';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement,
  Title, Tooltip, Legend, Filler
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement, BarElement,
  Title, Tooltip, Legend, Filler
);

const API_BASE = 'http://localhost:3001';

export default function RetailerDashboard() {
  const [trips, setTrips] = useState([]);
  const [selectedTripId, setSelectedTripId] = useState('');
  const [sensorData, setSensorData] = useState({ temperature_data: [], motion_data: [] });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchTrips();
    const interval = setInterval(fetchTrips, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (selectedTripId) {
      fetchSensors(selectedTripId);
      const interval = setInterval(() => fetchSensors(selectedTripId), 2000);
      return () => clearInterval(interval);
    }
  }, [selectedTripId]);

  const fetchTrips = async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/trips`);
      setTrips(res.data);
      if (res.data.length > 0) {
        setSelectedTripId(prev => prev || res.data[0].trip_id);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchSensors = async (tid) => {
    setIsLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/api/trips/${tid}/sensors`);
      setSensorData(res.data.sensorData || { temperature_data: [], motion_data: [] });
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const selectedTrip = trips.find(t => t.trip_id === selectedTripId) || {};
  const temps = sensorData.temperature_data || [];
  const motions = sensorData.motion_data || [];

  // Metrics Logic
  let currentTemp = temps.length > 0 ? Number(temps[temps.length - 1].avg) : 0;
  let shockEvents = motions.filter(m => m.max_accel > 0.5).length;
  let maxShock = motions.length > 0 ? Math.max(...motions.map(m => m.max_accel)) : 0;
  
  // Starting and delivered weight logic
  const w1 = selectedTrip.weight1 || selectedTrip.start_weight || 1000;
  const w2 = selectedTrip.weight2 || selectedTrip.end_weight || 0;
  const hasEnded = selectedTrip.status === 'COMPLETED';
  const deliveredWeight = hasEnded ? w2 : w1;
  const weightLossPercentage = w1 > 0 ? (((w1 - deliveredWeight) / w1) * 100).toFixed(1) : 0;
  
  // Dynamic Quality Score
  let qualityScore = 100;
  let isTempCrit = false;
  
  const highTempEvents = temps.filter(t => Number(t.avg) > 5).length;
  if (highTempEvents > 0) {
      isTempCrit = true;
      qualityScore -= (highTempEvents * 2);
  }
  if (currentTemp > 5) qualityScore -= 10;
  if (currentTemp < 0) qualityScore -= 5;
  qualityScore -= (shockEvents * 2);
  qualityScore = Math.max(0, qualityScore);

  const isShockCrit = maxShock > 0.5;
  const isCrit = isTempCrit || isShockCrit;
  const isWarn = qualityScore < 90 && !isCrit;

  let statusText = 'SAFE';
  let statusColor = 'var(--success)';
  let statusDesc = 'Ready for retail acceptance';
  let statusBg = 'rgba(16, 185, 129, 0.15)'; // Success tint
  
  if (isCrit) {
      statusText = 'CRITICAL';
      statusColor = 'var(--danger)';
      statusDesc = 'Unsafe to accept - quarantine';
      statusBg = 'rgba(239, 68, 68, 0.15)'; // Danger tint
  } else if (isWarn) {
      statusText = 'WARNING';
      statusColor = '#F59E0B'; // Amber/Warning
      statusDesc = 'Inspect carefully upon arrival';
      statusBg = 'rgba(245, 158, 11, 0.15)'; // Warning tint
  }

  // Chart configs
  const chartLabels = temps.slice(-15).map(t => t.time);
  const tempValues = temps.slice(-15).map(t => Number(t.avg));

  const tempChartData = {
    labels: chartLabels.length > 0 ? chartLabels : ['08:00', '09:00', '10:00', '11:00', '12:00'],
    datasets: [
      {
        label: 'Safe Limit',
        data: chartLabels.length > 0 ? Array(chartLabels.length).fill(5) : [5, 5, 5, 5, 5],
        borderColor: '#EF4444',
        borderWidth: 1.5,
        borderDash: [5, 5],
        pointRadius: 0,
        fill: false,
      },
      {
        label: 'Temperature °C',
        data: tempValues.length > 0 ? tempValues : [4.1, 4.3, 4.5, 6.2, 4.8],
        borderColor: '#0CA5E9',
        backgroundColor: 'rgba(12, 165, 233, 0.1)',
        fill: true,
        tension: 0.4,
        borderWidth: 2,
        pointBackgroundColor: '#EF4444',
        pointRadius: tempValues.map(v => v > 5 ? 4 : 2)
      }
    ]
  };

  const shockChartLabels = motions.slice(-15).map(m => m.time);
  const shockValues = motions.slice(-15).map(m => m.max_accel);

  const shockChartData = {
    labels: shockChartLabels.length > 0 ? shockChartLabels : ['08:00', '09:00', '09:42', '10:00', '12:00'],
    datasets: [{
      label: 'G-Force',
      data: shockValues.length > 0 ? shockValues : [0.1, 0.2, 3.2, 0.1, 0.3],
      backgroundColor: (ctx) => {
        const val = ctx.raw;
        return val > 0.5 ? '#F59E0B' : 'rgba(255, 255, 255, 0.1)';
      },
      borderRadius: 4,
      barThickness: 16
    }]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { display: false }, ticks: { color: 'rgba(255, 255, 255, 0.5)', maxTicksLimit: 5 } },
      y: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: 'rgba(255, 255, 255, 0.5)' } }
    }
  };

  return (
    <div style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '2rem', fontFamily: 'Inter, sans-serif', width: '100%', boxSizing: 'border-box' }}>
      
      {/* Header Section */}
      <div>
        <h2 style={{ margin: '0 0 0.5rem 0', fontSize: '1.8rem', fontWeight: 700, backgroundImage: 'linear-gradient(45deg, var(--text-primary), var(--accent-cyan))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          Shipment Analytics Dashboard (Retailer)
        </h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          Trip ID: 
          <select 
              value={selectedTripId} 
              onChange={e => setSelectedTripId(e.target.value)}
              className="glass-card"
              style={{ padding: '0.25rem 0.5rem', color: 'var(--text-primary)', fontWeight: 500, fontSize: '0.9rem', cursor: 'pointer', outline: 'none' }}
          >
              {trips.map(t => <option key={t.trip_id} value={t.trip_id} style={{ background: '#111827' }}>{t.trip_id} ({t.status})</option>)}
          </select>
          • Truck: <span style={{ color: 'var(--text-primary)' }}>{selectedTrip.truck_id || 'N/A'}</span> • Destination: <span style={{ color: 'var(--text-primary)' }}>Retail Center</span>
          {isLoading && <span style={{ marginLeft: '10px', fontSize: '0.8rem', color: 'var(--accent-cyan)' }}>Loading live stream...</span>}
        </div>
      </div>

      {/* Top 3 Cards Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
        
        {/* Status Card */}
        <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', fontWeight: 600, marginBottom: '1rem' }}>Shipment Status</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
            <div style={{ width: '56px', height: '56px', background: statusBg, borderRadius: '28px', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '1.5rem' }}>
              {isCrit ? '❌' : isWarn ? '⚠️' : '✅'}
            </div>
            <div style={{ color: statusColor, fontSize: '1.75rem', fontWeight: 700 }}>{statusText}</div>
          </div>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>{statusDesc}</div>
        </div>

        {/* Quality Score Card */}
        <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', fontWeight: 600, alignSelf: 'flex-start', marginBottom: '1rem' }}>Quality Score</div>
          <div style={{ position: 'relative', width: '160px', height: '80px', overflow: 'hidden', display: 'flex', justifyContent: 'center', alignItems: 'flex-end' }}>
              <div style={{ width: '160px', height: '160px', borderRadius: '50%', border: '16px solid rgba(255,255,255,0.05)', position: 'absolute', top: 0, boxSizing: 'border-box' }}></div>
              <div style={{ width: '160px', height: '160px', borderRadius: '50%', border: `16px solid ${statusColor}`, borderBottomColor: 'transparent', borderRightColor: 'transparent', position: 'absolute', top: 0, transform: `rotate(${-45 + (qualityScore/100)*180}deg)`, transition: 'transform 1s ease-out', boxSizing: 'border-box' }}></div>
              <div style={{ fontSize: '2.5rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: '2.5rem', zIndex: 1 }}>{qualityScore}</div>
          </div>
          <div style={{ color: statusColor, fontSize: '0.9rem', fontWeight: 700, marginTop: '0.5rem' }}>
              {qualityScore >= 90 ? 'GOOD CONDITION' : qualityScore >= 70 ? 'FAIR CONDITION' : 'POOR CONDITION'}
          </div>
        </div>

        {/* Weight Delivered Card */}
        <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', fontWeight: 600, marginBottom: '1rem' }}>Weight Delivered</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <div style={{ color: 'var(--text-primary)', fontSize: '2rem', fontWeight: 700 }}>{deliveredWeight}</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '1rem', fontWeight: 500 }}>kg</div>
          </div>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1.25rem' }}>Out of {w1} kg total loaded</div>
          
          <div style={{ height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '16px', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${(deliveredWeight / w1) * 100}%`, background: 'var(--accent-cyan)', borderRadius: '16px' }}></div>
          </div>
        </div>

      </div>

      {/* Charts Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1.5fr)', gap: '1.5rem' }}>
        
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ color: 'var(--text-primary)', fontSize: '1rem', fontWeight: 600 }}>Temperature Overview</div>
          </div>
          <div style={{ padding: '1.5rem', height: '280px', position: 'relative' }}>
             <Line data={tempChartData} options={chartOptions} />
          </div>
        </div>

        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ color: 'var(--text-primary)', fontSize: '1rem', fontWeight: 600 }}>Movement & Shocks</div>
          </div>
          <div style={{ padding: '1.5rem', height: '280px', position: 'relative' }}>
             <Bar data={shockChartData} options={chartOptions} />
          </div>
        </div>

      </div>

      {/* Alerts & Details Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '1.5rem' }}>
          
          {/* Active Alerts List */}
          <div className="glass-card" style={{ display: 'flex', flexDirection: 'column' }}>
             <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ color: 'var(--text-primary)', fontSize: '1rem', fontWeight: 600 }}>Active Alerts</div>
                <div style={{ background: 'rgba(245, 158, 11, 0.15)', borderRadius: '16px', padding: '0.25rem 0.75rem', fontSize: '0.75rem', fontWeight: 600, color: '#F59E0B' }}>
                  {(isTempCrit ? 1 : 0) + (isShockCrit ? 1 : 0)} Events
                </div>
             </div>
             <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {isTempCrit ? (
                   <div style={{ padding: '1rem', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--danger)', borderRadius: '8px', display: 'flex', gap: '1rem' }}>
                       <div style={{ fontSize: '1.25rem', lineHeight: '1.25rem' }}>⚠️</div>
                       <div>
                          <div style={{ color: 'var(--text-primary)', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.25rem' }}>High Temperature Alert</div>
                          <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Over safe limit continuously. Review logs to see contamination bounds.</div>
                       </div>
                   </div>
                ) : null}

                {isShockCrit ? (
                   <div style={{ padding: '1rem', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid #F59E0B', borderRadius: '8px', display: 'flex', gap: '1rem' }}>
                       <div style={{ fontSize: '1.25rem', lineHeight: '1.25rem' }}>⚡</div>
                       <div>
                          <div style={{ color: 'var(--text-primary)', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.25rem' }}>Vibration Spike Detected</div>
                          <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Harsh handling recorded. Potential product impact.</div>
                       </div>
                   </div>
                ) : null}

                {!isTempCrit && !isShockCrit && (
                    <div style={{ textAlign: 'center', color: 'var(--success)', padding: '2rem', background: 'rgba(16, 185, 129, 0.05)', borderRadius: '8px' }}>
                        No active alerts for this trip. Safe transit confirmed.
                    </div>
                )}
             </div>
          </div>

          {/* Weight Details */}
          <div className="glass-card" style={{ display: 'flex', flexDirection: 'column' }}>
             <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ color: 'var(--text-primary)', fontSize: '1rem', fontWeight: 600 }}>Weight Comparison</div>
             </div>
             <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                 
                 <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                     <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                         <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Start Weight</span>
                         <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{w1} kg</span>
                     </div>
                     <div style={{ height: '24px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', display: 'flex' }}>
                         <div style={{ flex: 1, background: 'var(--accent-cyan)', borderRadius: '4px' }}></div>
                     </div>
                 </div>

                 <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                     <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                         <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Delivered Weight</span>
                         <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{deliveredWeight} kg</span>
                     </div>
                     <div style={{ height: '24px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', position: 'relative' }}>
                         <div style={{ width: `${(deliveredWeight / w1) * 100}%`, height: '100%', background: 'var(--success)', borderRadius: '4px' }}></div>
                     </div>
                 </div>

                 <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', display: 'flex', gap: '0.75rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                     <div>ℹ️</div>
                     <div>
                         {weightLossPercentage}% weight loss detected during transit. 
                         {Number(weightLossPercentage) <= 3 
                              ? <span style={{ color: 'var(--success)', display: 'block', marginTop: '4px' }}>This is within acceptable limits (≤ 3%).</span> 
                              : <span style={{ color: 'var(--danger)', display: 'block', marginTop: '4px', fontWeight: 'bold' }}>This EXCEEDS acceptable loss thresholds!</span>}
                     </div>
                 </div>

             </div>
          </div>
      </div>

      {/* Global Shipment Details History */}
      <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', marginBottom: '2rem' }}>
          <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
             <div style={{ color: 'var(--text-primary)', fontSize: '1rem', fontWeight: 600 }}>Fleet Details</div>
          </div>
          <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
                  <thead>
                      <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', color: 'var(--text-secondary)' }}>
                          <th style={{ padding: '1rem 1.5rem', fontWeight: 500 }}>Truck ID</th>
                          <th style={{ padding: '1rem 1.5rem', fontWeight: 500 }}>Trip ID</th>
                          <th style={{ padding: '1rem 1.5rem', fontWeight: 500 }}>Direction</th>
                          <th style={{ padding: '1rem 1.5rem', fontWeight: 500 }}>Status</th>
                      </tr>
                  </thead>
                  <tbody>
                      {trips.map(trip => (
                          <tr key={trip.trip_id} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)', color: 'var(--text-primary)' }}>
                              <td style={{ padding: '1rem 1.5rem', fontWeight: 500 }}>{trip.truck_id}</td>
                              <td style={{ padding: '1rem 1.5rem', fontFamily: 'monospace' }}>{trip.trip_id}</td>
                              <td style={{ padding: '1rem 1.5rem' }}>{trip.trip_direction || 'INBOUND'}</td>
                              <td style={{ padding: '1rem 1.5rem' }}>
                                  <span style={{ 
                                      padding: '0.25rem 0.75rem', 
                                      background: trip.status === 'COMPLETED' ? 'rgba(16, 185, 129, 0.15)' : trip.status === 'ACTIVE' ? 'rgba(12, 165, 233, 0.15)' : 'rgba(245, 158, 11, 0.15)', 
                                      color: trip.status === 'COMPLETED' ? 'var(--success)' : trip.status === 'ACTIVE' ? 'var(--accent-cyan)' : '#F59E0B', 
                                      borderRadius: '16px', 
                                      fontSize: '0.75rem', 
                                      fontWeight: 600,
                                      textTransform: 'uppercase'
                                  }}>
                                      {trip.status}
                                  </span>
                              </td>
                          </tr>
                      ))}
                  </tbody>
              </table>
          </div>
      </div>

    </div>
  );
}
