import React, { useEffect, useState } from 'react';
import axios from 'axios';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement,
  Title, Tooltip, Legend, Filler, ArcElement
} from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import { ChatbotProvider as Owner_ChatbotProvider, useChatbot } from './Owner_Chatbot/Owner_ChatbotContext';
import Owner_MrHodhaMaalu from './Owner_Chatbot/Owner_MrHodhaMaalu';

ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement, BarElement,
  Title, Tooltip, Legend, Filler, ArcElement
);

const API_BASE = 'http://localhost:3001';

function OwnerDashboardContent() {
    const [trips, setTrips] = useState([]);
    const [liveData, setLiveData] = useState({});
    const [isLoading, setIsLoading] = useState(true);
    const { updateSnapshot } = useChatbot();

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const { data } = await axios.get(`${API_BASE}/api/trips`);
            setTrips(data);
            
            // Fetch sensors for all trips to compute global history and quality
            const liveMap = {};
            await Promise.all(data.map(async (trip) => {
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
    const globalTripMetrics = trips.map(trip => {
        const sensors = liveData[trip.trip_id];
        let currentTemp = null;
        let shockEvents = 0;
        let maxShock = 0;
        let qualityScore = 100;

        if (sensors) {
            const temps = sensors.temperature_data || [];
            const motions = sensors.motion_data || [];

            if (temps.length > 0) {
                currentTemp = Number(temps[temps.length - 1].avg);
            }
            if (motions.length > 0) {
                shockEvents = motions.filter(m => m.max_accel > 0.5).length;
                maxShock = Math.max(...motions.map(m => m.max_accel));
            }

            if (currentTemp !== null && currentTemp > -18) qualityScore -= 10;
            qualityScore -= (shockEvents * 2);
            qualityScore = Math.max(0, qualityScore);
        }

        const isTempCrit = currentTemp !== null && currentTemp > -18;
        const isShockCrit = maxShock > 0.5;
        const isCrit = isTempCrit || isShockCrit;
        const isWarn = qualityScore < 90 && !isCrit;

        return { ...trip, currentTemp: currentTemp !== null ? currentTemp : '--', shockEvents, qualityScore, maxShock, isCrit, isWarn };
    });

    const activeTripMetrics = globalTripMetrics.filter(t => t.status === 'ACTIVE');
    
    // Quick Stats Calculations
    const criticalAlertsCount = globalTripMetrics.filter(t => t.isCrit).length;
    const fleetAvgQuality = globalTripMetrics.length > 0 ? (globalTripMetrics.reduce((sum, t) => sum + t.qualityScore, 0) / globalTripMetrics.length).toFixed(0) : 100;
    
    let totalTemp = 0;
    let tempCount = 0;
    activeTripMetrics.forEach(t => {
        if (t.currentTemp !== undefined && t.currentTemp !== 0) {
            totalTemp += t.currentTemp;
            tempCount++;
        }
    });

    const fleetAvgTemp = tempCount > 0 ? (totalTemp / tempCount).toFixed(1) : '--';
    
    // Process real historical Fleet Avg Trend from all fetched liveData
    const timeBuckets = {};
    Object.values(liveData).forEach(sensor => {
        (sensor.temperature_data || []).forEach(t => {
            if (!timeBuckets[t.time]) timeBuckets[t.time] = { sum: 0, count: 0 };
            timeBuckets[t.time].sum += Number(t.avg);
            timeBuckets[t.time].count += 1;
        });
    });
    
    const sortedTimes = Object.keys(timeBuckets).sort();
    const displayTimes = sortedTimes.slice(-20); // Last 20 data points
    const realChartLabels = displayTimes;
    const realAvgTempData = displayTimes.map(t => (timeBuckets[t].sum / timeBuckets[t].count).toFixed(2));

    // Push data to chatbot
    useEffect(() => {
        if (!isLoading && trips.length > 0) {
            updateSnapshot({
                type: 'FLEET_STRATEGY_OVERVIEW',
                totalTrips: trips.length,
                activeTrips: activeTripMetrics.length,
                fleetAvgQuality: fleetAvgQuality,
                fleetAvgTemp: fleetAvgTemp,
                criticalAlerts: globalTripMetrics.filter(t => t.isCrit),
                warningTrips: globalTripMetrics.filter(t => t.isWarn)
            });
        }
    }, [isLoading, trips, fleetAvgQuality, fleetAvgTemp, updateSnapshot]);

    // Line Chart config (Temperature Trend)
    const tempChartData = {
        labels: realChartLabels,
        datasets: [{
            label: 'Avg Fleet Temperature (°C)',
            data: realAvgTempData,
            borderColor: '#0CA5E9',
            backgroundColor: 'rgba(12, 165, 233, 0.1)',
            fill: true,
            tension: 0.4,
            borderWidth: 3,
            pointBackgroundColor: '#0CA5E9'
        }]
    };
    
    // Bar Chart Config (Vibrations for active and recent trips)
    // We will show vibration metrics for up to 10 latest trips with actual motion data
    const shockDataRecords = [];
    trips.slice(0, 10).forEach(t => {
        const s = liveData[t.trip_id];
        if (s && s.motion_data && s.motion_data.length > 0) {
            const max = Math.max(...s.motion_data.map(m => m.max_accel));
            shockDataRecords.push({ truck_id: t.truck_id, maxShock: max });
        }
    });

    const shockChartData = {
        labels: shockDataRecords.map(r => r.truck_id),
        datasets: [{
            label: 'Max Vibration (g)',
            data: shockDataRecords.map(r => r.maxShock),
            backgroundColor: shockDataRecords.map(r => r.maxShock > 0.5 ? '#EF4444' : '#0CA5E9'),
            borderRadius: 4
        }]
    };

    // Doughnut chart config
    const safeCount = globalTripMetrics.filter(t => t.qualityScore >= 90).length;
    const warnCount = globalTripMetrics.filter(t => t.qualityScore >= 70 && t.qualityScore < 90).length;
    const critCount = globalTripMetrics.filter(t => t.qualityScore < 70).length;
    
    const hasAny = globalTripMetrics.length > 0;
    const riskChartData = {
        labels: hasAny ? ['Safe', 'Warning', 'Critical'] : ['No Trips'],
        datasets: [{
            data: hasAny ? [safeCount, warnCount, critCount] : [1],
            backgroundColor: hasAny ? ['#10B981', '#F59E0B', '#EF4444'] : ['rgba(255,255,255,0.05)'],
            borderWidth: 0,
            hoverOffset: hasAny ? 4 : 0
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
                    <div style={{ fontSize: '2rem', fontWeight: 700 }}>{activeTripMetrics.length}</div>
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
                    <div style={{ fontSize: '0.75rem', color: fleetAvgTemp <= -18 ? 'var(--success)' : 'var(--danger)' }}>
                        {fleetAvgTemp <= -18 ? 'Within safe limits' : 'Above safe average'}
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
                        <span style={{ color: 'var(--danger)', fontSize: '0.65rem', padding: '0.25rem', fontWeight: 'bold' }}>CRITICAL ZONE (&gt;-18°C)</span>
                    </div>
                    <Line data={tempChartData} options={{...commonOptions, scales: { y: { min: -30, max: 0, grid: { color: 'rgba(255, 255, 255, 0.05)' } } } }} />
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
                                <th style={{ padding: '0.75rem' }}>Dir</th>
                                <th style={{ padding: '0.75rem' }}>Temperature</th>
                                <th style={{ padding: '0.75rem' }}>Vibration Level</th>
                                <th style={{ padding: '0.75rem' }}>Quality Score</th>
                                <th style={{ padding: '0.75rem' }}>Risk Status</th>
                                <th style={{ padding: '0.75rem' }}>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {activeTripMetrics.length > 0 ? activeTripMetrics.map(trip => {
                                const isTempCrit = trip.currentTemp !== '--' && trip.currentTemp > -18;
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
                                        <td style={{ padding: '1rem 0.75rem', fontWeight: 600, color: 'var(--text-primary)' }}>{trip.trip_direction || 'INB'}</td>
                                        <td style={{ padding: '1rem 0.75rem', color: isTempCrit ? 'var(--danger)' : 'var(--text-primary)', fontWeight: isTempCrit ? 600 : 400 }}>
                                            {trip.currentTemp !== '--' ? `${trip.currentTemp}°C` : '--'}
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
                                    <td colSpan="8" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>No active trips found.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Bottom Split Row */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
                <div className="glass-card" style={{ padding: '1.5rem', height: '300px', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1rem' }}>Vibration Monitoring</div>
                    <div style={{ flex: 1 }}>
                        <Bar data={shockChartData} options={commonOptions} />
                    </div>
                </div>

                <div className="glass-card" style={{ padding: '1.5rem', height: '300px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1rem', width: '100%' }}>Trip Risk Level</div>
                    <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%', minHeight: 0 }}>
                        <div style={{ position: 'relative', height: '200px', width: '100%', display: 'flex', justifyContent: 'center' }}>
                            <Doughnut data={riskChartData} options={{
                                maintainAspectRatio: false, cutout: '75%', plugins: { legend: { display: true, position: 'right' } }
                            }} />
                            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', pointerEvents: 'none' }}>
                                <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{hasAny ? safeCount : 0}</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Safe Trips</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Notification Bar */}
            <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '300px', overflowY: 'auto' }}>
                <div style={{ fontSize: '1.125rem', fontWeight: 600, position: 'sticky', top: 0, background: 'var(--bg-dark)', zIndex: 10, paddingBottom: '0.5rem' }}>Recent Notifications</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {globalTripMetrics.filter(t => t.isCrit || t.isWarn).length > 0 ? (
                        globalTripMetrics.filter(t => t.isCrit || t.isWarn).map((trip, idx) => (
                            <div key={idx} style={{ padding: '1rem', background: trip.isCrit ? 'rgba(239, 68, 68, 0.1)' : 'rgba(245, 158, 11, 0.1)', borderLeft: `4px solid ${trip.isCrit ? 'var(--danger)' : '#F59E0B'}`, borderRadius: '0 8px 8px 0', display: 'flex', flexDirection: 'column' }}>
                                <div style={{ fontWeight: 600, color: trip.isCrit ? 'var(--danger)' : '#F59E0B', fontSize: '0.875rem' }}>
                                    {trip.isCrit ? 'Critical Alert' : 'Warning'} - Trip #{trip.trip_id}
                                </div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                                    {trip.currentTemp !== '--' && trip.currentTemp > -18 && <span>Temperature breached safe limits ({trip.currentTemp}°C). </span>}
                                    {trip.shockEvents > 0 && <span>High vibration detected ({trip.shockEvents} events). </span>}
                                    Overall Quality Score: {trip.qualityScore}%
                                </div>
                            </div>
                        ))
                    ) : (
                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', padding: '1rem', textAlign: 'center' }}>No recent critical alerts or warnings. All fleets operating normally.</div>
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
