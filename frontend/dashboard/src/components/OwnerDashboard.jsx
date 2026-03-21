import React, { useEffect, useState } from 'react';
import axios from 'axios';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement,
  Title, Tooltip, Legend, Filler, ArcElement
} from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement, BarElement,
  Title, Tooltip, Legend, Filler, ArcElement
);

const API_BASE = 'http://localhost:3001';

export default function OwnerDashboard() {
    const [trips, setTrips] = useState([]);
    const [liveData, setLiveData] = useState({});
    const [isLoading, setIsLoading] = useState(true);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const { data } = await axios.get(`${API_BASE}/api/trips`);
            setTrips(data);
            
            // Only fetch sensors for ACTIVE trips to save on API calls
            const activeTrips = data.filter(t => t.status === 'ACTIVE');
            
            const liveMap = {};
            await Promise.all(activeTrips.map(async (trip) => {
                try {
                    const res = await axios.get(`${API_BASE}/api/trips/${trip.trip_id}/sensors`);
                    if (res.data && res.data.sensorData) {
                        liveMap[trip.trip_id] = res.data.sensorData;
                    }
                } catch (e) {
                    console.error("Error fetching sensors for", trip.trip_id);
                }
            }));
            
            setLiveData(liveMap);
        } catch (err) {
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 5000);
        return () => clearInterval(interval);
    }, []);

    // Derived Agregates
    const activeTrips = trips.filter(t => t.status === 'ACTIVE');
    
    let totalTemp = 0;
    let tempCount = 0;
    let criticalAlertsCount = 0;
    let totalQuality = 0;
    
    // Arrays for charts
    const chartLabels = [];
    const avgTempData = [];
    const maxShockData = [];

    const tripMetrics = activeTrips.map(trip => {
        const sensors = liveData[trip.trip_id];
        let currentTemp = 0;
        let shockEvents = 0;
        let maxShock = 0;
        let qualityScore = 100;

        if (sensors) {
            const temps = sensors.temperature_data || [];
            const motions = sensors.motion_data || [];

            if (temps.length > 0) {
                const latest = temps[temps.length - 1];
                currentTemp = Number(latest.avg);
                totalTemp += currentTemp;
                tempCount++;
                
                // Add to chart arrays safely
                if (avgTempData.length < 10) {
                    if (!chartLabels.includes(latest.time)) {
                        chartLabels.push(latest.time);
                    }
                    avgTempData.push(currentTemp);
                }
            }
            if (motions.length > 0) {
                shockEvents = motions.filter(m => m.max_accel > 0.5).length;
                maxShock = Math.max(...motions.map(m => m.max_accel));
                maxShockData.push(maxShock);
            }

            // Simple quality logic
            if (currentTemp > 5) qualityScore -= 10;
            if (currentTemp < 0) qualityScore -= 5;
            qualityScore -= (shockEvents * 2);
            qualityScore = Math.max(0, qualityScore);
            totalQuality += qualityScore;
            
            if (currentTemp > 5 || shockEvents > 2) {
                criticalAlertsCount++;
            }
        }

        return { ...trip, currentTemp, shockEvents, qualityScore, maxShock };
    });

    const fleetAvgTemp = tempCount > 0 ? (totalTemp / tempCount).toFixed(1) : '--';
    const fleetAvgQuality = activeTrips.length > 0 ? (totalQuality / activeTrips.length).toFixed(0) : 100;
    
    // Line Chart config (Temperature Trend)
    const tempChartData = {
        labels: chartLabels.length > 0 ? chartLabels : ['10:00', '10:05', '10:10', '10:15', '10:20'],
        datasets: [{
            label: 'Avg Fleet Temperature (°C)',
            data: avgTempData.length > 0 ? avgTempData : [2.1, 2.3, 2.0, 1.8, 2.5],
            borderColor: '#0CA5E9',
            backgroundColor: 'rgba(12, 165, 233, 0.1)',
            fill: true,
            tension: 0.4,
            borderWidth: 3,
            pointBackgroundColor: '#0CA5E9'
        }]
    };
    
    // Bar Chart Config (Vibrations)
    const shockChartData = {
        labels: activeTrips.map(t => t.truck_id),
        datasets: [{
            label: 'Max Vibration (g)',
            data: maxShockData.length > 0 ? maxShockData : [0.1, 0.4, 0.2, 0.8],
            backgroundColor: maxShockData.map(v => v > 0.5 ? '#EF4444' : '#0CA5E9'),
            borderRadius: 4
        }]
    };

    // Doughnut chart config
    const safeCount = tripMetrics.filter(t => t.qualityScore >= 90).length;
    const warnCount = tripMetrics.filter(t => t.qualityScore >= 70 && t.qualityScore < 90).length;
    const critCount = tripMetrics.filter(t => t.qualityScore < 70).length;
    
    const riskChartData = {
        labels: ['Safe', 'Warning', 'Critical'],
        datasets: [{
            data: activeTrips.length === 0 ? [1, 0, 0] : [safeCount, warnCount, critCount],
            backgroundColor: ['#10B981', '#F59E0B', '#EF4444'],
            borderWidth: 0,
            hoverOffset: 4
        }]
    };

    const commonOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false }
        },
        scales: {
            x: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#94A3B8' } },
            y: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#94A3B8' } }
        }
    };

    return (
        <div style={{ width: '100%', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', color: 'var(--text-primary)', fontFamily: 'Inter, sans-serif' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h2 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 700, backgroundImage: 'linear-gradient(45deg, var(--text-primary), var(--accent-cyan))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                    Fleet & Owner Overview
                </h2>
                
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <div className="glass-card" style={{ padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
                        📅 <span>Today</span>
                    </div>
                    <div className="glass-card" style={{ padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
                        🚚 <span>All Active Trucks</span>
                    </div>
                    <button 
                        onClick={fetchData}
                        className="glass-card" 
                        style={{ padding: '0.5rem 1rem', background: 'var(--accent-purple)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600, transition: '0.2s', opacity: isLoading ? 0.7 : 1 }}
                    >
                        {isLoading ? 'Refreshing...' : '↻ Refresh Data'}
                    </button>
                </div>
            </div>

            {/* Quick Stats Row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem' }}>
                <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.875rem' }}>Active Trucks</span>
                        <div style={{ background: 'rgba(12, 165, 233, 0.1)', color: 'var(--accent-cyan)', padding: '0.25rem', borderRadius: '4px' }}>🚚</div>
                    </div>
                    <div style={{ fontSize: '2rem', fontWeight: 700 }}>{activeTrips.length}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--success)' }}>On Schedule</div>
                </div>
                
                <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.875rem' }}>Critical Alerts</span>
                        <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', padding: '0.25rem', borderRadius: '4px' }}>⚠️</div>
                    </div>
                    <div style={{ fontSize: '2rem', fontWeight: 700 }}>{criticalAlertsCount}</div>
                    <div style={{ fontSize: '0.75rem', color: criticalAlertsCount > 0 ? 'var(--danger)' : 'var(--text-secondary)' }}>
                        {criticalAlertsCount > 0 ? 'Requires immediate action' : 'No issues'}
                    </div>
                </div>

                <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.875rem' }}>Average Temperature</span>
                        <div style={{ background: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)', padding: '0.25rem', borderRadius: '4px' }}>🌡️</div>
                    </div>
                    <div style={{ fontSize: '2rem', fontWeight: 700 }}>{fleetAvgTemp}°C</div>
                    <div style={{ fontSize: '0.75rem', color: fleetAvgTemp <= 5 ? 'var(--success)' : 'var(--danger)' }}>
                        {fleetAvgTemp <= 5 ? 'Within safe limits' : 'Above safe average'}
                    </div>
                </div>

                <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.875rem' }}>Quality Score</span>
                        <div style={{ background: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)', padding: '0.25rem', borderRadius: '4px' }}>⭐</div>
                    </div>
                    <div style={{ fontSize: '2rem', fontWeight: 700 }}>{fleetAvgQuality}%</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Overall fleet average</div>
                </div>
            </div>

            {/* Temperature Trend Full width */}
            <div className="glass-card" style={{ padding: '1.5rem', height: '350px', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                    <div style={{ fontSize: '1.125rem', fontWeight: 600 }}>Temperature Trend (Fleet Avg)</div>
                    <div className="glass-card" style={{ padding: '0.25rem 0.75rem', fontSize: '0.875rem', cursor: 'pointer' }}>Export Data</div>
                </div>
                <div style={{ flex: 1, position: 'relative' }}>
                    {/* Simulated Critical Zone highlight overlay */}
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '30%', background: 'linear-gradient(180deg, rgba(239, 68, 68, 0.1) 0%, rgba(239, 68, 68, 0.0) 100%)', pointerEvents: 'none', borderTop: '1px dashed var(--danger)' }}>
                        <span style={{ color: 'var(--danger)', fontSize: '0.65rem', padding: '0.25rem', fontWeight: 'bold' }}>CRITICAL ZONE (&gt;5°C)</span>
                    </div>
                    <Line data={tempChartData} options={{...commonOptions, scales: { y: { min: -10, max: 15, grid: { color: 'rgba(255, 255, 255, 0.05)' } } } }} />
                </div>
            </div>

            {/* Live Truck Monitoring Table */}
            <div className="glass-card" style={{ padding: '1.5rem' }}>
                <div style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1.5rem' }}>Live Truck Monitoring</div>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                                <th style={{ padding: '0.75rem' }}>Truck ID</th>
                                <th style={{ padding: '0.75rem' }}>Trip ID</th>
                                <th style={{ padding: '0.75rem' }}>Temperature</th>
                                <th style={{ padding: '0.75rem' }}>Vibration Level</th>
                                <th style={{ padding: '0.75rem' }}>Quality Score</th>
                                <th style={{ padding: '0.75rem' }}>Risk Status</th>
                                <th style={{ padding: '0.75rem' }}>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {tripMetrics.length > 0 ? tripMetrics.map(trip => {
                                const isTempCrit = trip.currentTemp > 5;
                                const isShockCrit = trip.maxShock > 0.5;
                                const isCrit = isTempCrit || isShockCrit;
                                const isWarn = trip.qualityScore < 90 && !isCrit;
                                
                                let statusColor = 'var(--success)';
                                let statusText = 'Safe';
                                let statusBg = 'rgba(16, 185, 129, 0.15)';
                                
                                if (isCrit) {
                                    statusColor = 'var(--danger)';
                                    statusText = 'Critical';
                                    statusBg = 'rgba(239, 68, 68, 0.15)';
                                } else if (isWarn) {
                                    statusColor = '#F59E0B'; // var(--warning) fallback
                                    statusText = 'Warning';
                                    statusBg = 'rgba(245, 158, 11, 0.15)';
                                }

                                return (
                                    <tr key={trip.trip_id} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                                        <td style={{ padding: '1rem 0.75rem', fontWeight: 600 }}>{trip.truck_id}</td>
                                        <td style={{ padding: '1rem 0.75rem', color: 'var(--text-secondary)' }}>{trip.trip_id.substring(0,8)}...</td>
                                        <td style={{ padding: '1rem 0.75rem', color: isTempCrit ? 'var(--danger)' : 'var(--text-primary)', fontWeight: isTempCrit ? 600 : 400 }}>
                                            {trip.currentTemp}°C
                                        </td>
                                        <td style={{ padding: '1rem 0.75rem', color: isShockCrit ? '#F59E0B' : 'var(--text-primary)' }}>
                                            {trip.maxShock.toFixed(2)}g
                                        </td>
                                        <td style={{ padding: '1rem 0.75rem' }}>{trip.qualityScore}%</td>
                                        <td style={{ padding: '1rem 0.75rem' }}>
                                            <span style={{ 
                                                background: statusBg, color: statusColor, 
                                                padding: '0.25rem 0.75rem', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' 
                                            }}>
                                                {statusText}
                                            </span>
                                        </td>
                                        <td style={{ padding: '1rem 0.75rem', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                                            •••
                                        </td>
                                    </tr>
                                );
                            }) : (
                                <tr>
                                    <td colSpan="7" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>No active trips found.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Bottom Split Row */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem', mb: '2rem' }}>
                <div className="glass-card" style={{ padding: '1.5rem', height: '300px', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1rem' }}>Vibration Monitoring</div>
                    <div style={{ flex: 1 }}>
                        <Bar data={shockChartData} options={commonOptions} />
                    </div>
                </div>

                <div className="glass-card" style={{ padding: '1.5rem', height: '300px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1rem', width: '100%' }}>Trip Risk Level</div>
                    <div style={{ flex: 1, position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%' }}>
                        <Doughnut data={riskChartData} options={{
                            cutout: '75%', plugins: { legend: { display: true, position: 'bottom' } }
                        }} />
                        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -60%)', textAlign: 'center' }}>
                            <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{safeCount}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Safe Trips</div>
                        </div>
                    </div>
                </div>
            </div>

        </div>
    );
}
