import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
    Chart as ChartJS, CategoryScale, LinearScale, PointElement,
    LineElement, Title, Tooltip, Legend, Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

const API_BASE = 'http://localhost:3001';

export default function QAInspectorA() {
    const navigate = useNavigate();
    const [trips, setTrips] = useState([]);
    const [selectedTripId, setSelectedTripId] = useState('');
    const [sensorData, setSensorData] = useState(null);
    const [tripDetails, setTripDetails] = useState(null);

    useEffect(() => {
        const fetchTrips = async () => {
            try {
                const { data } = await axios.get(`${API_BASE}/api/trips`);
                if (Array.isArray(data)) {
                    setTrips(data);
                    if (data.length > 0) {
                        setSelectedTripId(prev => prev || data[0].trip_id);
                    }
                }
            } catch (err) { console.error(err); }
        };
        fetchTrips();
        const interval = setInterval(fetchTrips, 5000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (!selectedTripId) return;
        let isMounted = true;
        const fetchDetails = async () => {
            try {
                const { data } = await axios.get(`${API_BASE}/api/trips/${selectedTripId}/sensors`);
                if (isMounted) {
                    setTripDetails(data.trip);
                    setSensorData(data.sensorData || { temperature_data: [], motion_data: [] });
                }
            } catch (err) { console.error(err); }
        };
        fetchDetails();
        const interval = setInterval(fetchDetails, 3000);
        return () => { isMounted = false; clearInterval(interval); };
    }, [selectedTripId]);

    // Derived Metrics
    let tempCompliance = 100;
    let shockEvents = 0;
    let qualityScore = 100;
    let currentTemp = 0;

    const w1 = tripDetails?.weight1 ?? tripDetails?.start_weight ?? tripDetails?.weight ?? '--';
    const w2 = tripDetails?.weight2 ?? tripDetails?.end_weight ?? '--';

    const isOutbound = tripDetails?.trip_direction !== 'INBOUND';
    const step1Label = isOutbound ? "Warehouse (RFID Leave)" : "Pick-up (Button)";
    const step2Label = "In Transit (Sensors)";
    const step3Label = isOutbound ? "Retail Delivery" : "Warehouse (RFID Arrive)";

    if (sensorData) {
        const temps = sensorData.temperature_data || [];
        const motions = sensorData.motion_data || [];
        if (temps.length > 0) {
            currentTemp = temps[temps.length - 1].avg;
            const violations = temps.filter(t => t.avg > 5).length;
            tempCompliance = Math.max(0, 100 - (violations / temps.length * 100));
        }
        shockEvents = motions.filter(m => m.max_accel > 0.5).length;
        qualityScore = Math.max(0, Math.floor(tempCompliance - (shockEvents * 5)));
    }

    const labels = sensorData?.temperature_data?.map(d => d.time) || [];
    
    const tempChartData = {
        labels,
        datasets: [
            {
                label: 'Avg Temp (°C)',
                data: sensorData?.temperature_data?.map(d => d.avg) || [],
                borderColor: '#06b6d4',
                backgroundColor: 'rgba(6, 182, 212, 0.1)',
                tension: 0.4, fill: true,
            },
            {
                label: 'Threshold (5°C)',
                data: labels.map(() => 5.0),
                borderColor: '#ef4444',
                borderDash: [5, 5], borderWidth: 2, pointRadius: 0, fill: false,
            }
        ]
    };

    const shockChartData = {
        labels: sensorData?.motion_data?.map(d => d.time) || [],
        datasets: [
            {
                label: 'Max Shock (G)',
                data: sensorData?.motion_data?.map(d => d.max_accel) || [],
                borderColor: '#8b5cf6',
                backgroundColor: 'rgba(139, 92, 246, 0.1)',
                tension: 0.2, fill: true,
            },
            {
                label: 'Warning (0.5 G)',
                data: (sensorData?.motion_data || []).map(() => 0.5),
                borderColor: '#ef4444',
                borderDash: [5, 5], borderWidth: 2, pointRadius: 0, fill: false,
            }
        ]
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', padding: '1.5rem', gap: '1.5rem' }}>
            {/* Topbar equivalent */}
            <div className="glass-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem' }}>
                <div style={{ display: 'flex', gap: '2rem', alignItems: 'center' }}>
                    <div><span style={{ color: 'var(--text-secondary)' }}>Truck ID:</span> <span style={{ fontWeight: 600 }}>{tripDetails?.truck_id || '--'}</span></div>
                    <div><span style={{ color: 'var(--text-secondary)' }}>Trip ID:</span> <span style={{ color: 'var(--accent-cyan)', fontWeight: 600 }}>#{tripDetails?.trip_id || '--'}</span></div>
                    <div><span style={{ color: 'var(--text-secondary)' }}>Status:</span> <span className={`badge ${tripDetails?.status === 'ACTIVE' ? 'badge-active' : 'badge-completed'}`}>{tripDetails?.status || '--'}</span></div>
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <select 
                        className="glass-card" 
                        style={{ padding: '0.5rem', color: 'var(--text-primary)', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', outline: 'none' }}
                        value={selectedTripId}
                        onChange={(e) => setSelectedTripId(e.target.value)}
                    >
                        {trips.map(t => (
                            <option key={t.trip_id} value={t.trip_id} style={{ background: 'var(--bg-dark)' }}>
                                Trip #{t.trip_id} ({t.truck_id})
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            <div style={{ display: 'flex', gap: '1.5rem', flex: 1 }}>
                {/* Main Content Pane */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    {/* 4 Metric Cards */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem' }}>
                        <div className="glass-card" style={{ borderLeft: '4px solid var(--success)', position: 'relative', overflow: 'hidden' }}>
                            <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Quality Score</div>
                            <div style={{ color: 'var(--success)', fontSize: '2rem', fontWeight: 700, marginTop: '0.5rem' }}>{qualityScore}</div>
                            <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginTop: '0.5rem' }}>{qualityScore > 80 ? '▲ All indicators good' : '▼ Attention needed'}</div>
                        </div>
                        <div className="glass-card" style={{ borderLeft: `4px solid ${qualityScore > 80 ? 'var(--success)' : 'var(--danger)'}` }}>
                            <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Risk Status</div>
                            <div style={{ marginTop: '0.5rem', display: 'inline-block', padding: '0.25rem 0.75rem', borderRadius: '999px', background: qualityScore > 80 ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)', color: qualityScore > 80 ? 'var(--success)' : 'var(--danger)', fontSize: '0.875rem', fontWeight: 600 }}>
                                {qualityScore > 80 ? 'Low Risk' : 'High Risk'}
                            </div>
                            <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginTop: '0.75rem' }}>{qualityScore > 80 ? 'All parameters normal' : 'Anomalies detected'}</div>
                        </div>
                        <div className="glass-card" style={{ borderLeft: '4px solid var(--accent-cyan)' }}>
                            <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Temp Compliance</div>
                            <div style={{ color: 'var(--accent-cyan)', fontSize: '2rem', fontWeight: 700, marginTop: '0.5rem' }}>{tempCompliance.toFixed(1)}%</div>
                            <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginTop: '0.5rem' }}>Within safe range ({currentTemp}°C)</div>
                        </div>
                        <div className="glass-card" style={{ borderLeft: `4px solid ${shockEvents > 0 ? 'var(--danger)' : 'var(--accent-purple)'}` }}>
                            <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Shock Events</div>
                            <div style={{ color: shockEvents > 0 ? 'var(--danger)' : 'var(--accent-purple)', fontSize: '2rem', fontWeight: 700, marginTop: '0.5rem' }}>{shockEvents}</div>
                            <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginTop: '0.5rem' }}>{shockEvents > 0 ? 'Events logged' : 'No severe shocks'}</div>
                        </div>
                    </div>

                    {/* Charts */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                        <div 
                            className="glass-card" 
                            style={{ display: 'flex', flexDirection: 'column', cursor: 'pointer', transition: 'transform 0.2s' }}
                            onClick={() => selectedTripId && navigate(`/qa-b/${selectedTripId}`)}
                            title="Click for detailed view"
                        >
                            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem', color: 'var(--text-secondary)' }}>Temperature Trend (Click for Details)</h3>
                            <div style={{ height: '250px' }}>
                                <Line data={tempChartData} options={{ responsive: true, maintainAspectRatio: false }} />
                            </div>
                        </div>
                        <div 
                            className="glass-card" 
                            style={{ display: 'flex', flexDirection: 'column', cursor: 'pointer', transition: 'transform 0.2s' }}
                            onClick={() => selectedTripId && navigate(`/qa-b/${selectedTripId}`)}
                            title="Click for detailed view"
                        >
                            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem', color: 'var(--text-secondary)' }}>Shock & Movement (Click for Details)</h3>
                            <div style={{ height: '250px' }}>
                                <Line data={shockChartData} options={{ responsive: true, maintainAspectRatio: false }} />
                            </div>
                        </div>
                    </div>

                    {/* Bottom Row: Weights & Timeline */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                        <div className="glass-card">
                            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem', color: 'var(--text-secondary)' }}>Weight Comparison</h3>
                            <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', height: '100px' }}>
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{w1 !== '--' ? `${w1} kg` : '--'}</div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Loading</div>
                                </div>
                                <div style={{ height: '2px', width: '50px', background: 'var(--border-color)', position: 'relative' }}>
                                    <div style={{ position: 'absolute', top: '-4px', right: 0, width: 0, height: 0, borderTop: '5px solid transparent', borderBottom: '5px solid transparent', borderLeft: '10px solid var(--border-color)' }}></div>
                                </div>
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{w2 !== '--' ? `${w2} kg` : '--'}</div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Arrival</div>
                                </div>
                            </div>
                        </div>
                        <div className="glass-card">
                            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem', color: 'var(--text-secondary)' }}>Trip Timeline & Events</h3>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem', position: 'relative' }}>
                                <div style={{ position: 'absolute', top: '10px', left: '10%', right: '10%', height: '2px', background: 'var(--border-color)', zIndex: 0 }}></div>
                                <div style={{ zIndex: 1, textAlign: 'center' }}>
                                    <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'var(--bg-dark)', border: '2px solid var(--accent-cyan)', margin: '0 auto 0.5rem auto' }}></div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-primary)' }}>{step1Label}</div>
                                </div>
                                <div style={{ zIndex: 1, textAlign: 'center' }}>
                                    <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'var(--bg-dark)', border: shockEvents > 0 ? '2px solid var(--danger)' : '2px solid var(--accent-purple)', margin: '0 auto 0.5rem auto' }}></div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-primary)' }}>{step2Label}</div>
                                </div>
                                <div style={{ zIndex: 1, textAlign: 'center' }}>
                                    <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: tripDetails?.status === 'COMPLETED' ? 'var(--bg-dark)' : 'var(--bg-dark)', border: tripDetails?.status === 'COMPLETED' ? '2px solid var(--success)' : '2px solid var(--border-color)', margin: '0 auto 0.5rem auto' }}></div>
                                    <div style={{ fontSize: '0.75rem', color: tripDetails?.status === 'COMPLETED' ? 'var(--success)' : 'var(--text-secondary)' }}>{step3Label}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Sidebar: Alerts */}
                <div className="glass-card" style={{ width: '280px', display: 'flex', flexDirection: 'column' }}>
                    <h3 style={{ margin: '0 0 1.5rem 0', fontSize: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>Alerts & Notifications</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', flex: 1, overflowY: 'auto' }}>
                        {tempCompliance < 100 && (
                            <div style={{ borderLeft: '3px solid var(--danger)', paddingLeft: '0.5rem' }}>
                                <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>Temperature Anomaly</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Temp rose above 5°C</div>
                            </div>
                        )}
                        {shockEvents > 0 && (
                            <div style={{ borderLeft: '3px solid var(--accent-purple)', paddingLeft: '0.5rem' }}>
                                <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>High Vibration</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{shockEvents} shock events detected</div>
                            </div>
                        )}
                        {tempCompliance === 100 && shockEvents === 0 && (
                            <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', textAlign: 'center', marginTop: '2rem' }}>
                                No recent alerts. Conditions are stable.
                            </div>
                        )}
                    </div>
                    <div style={{ marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid var(--border-color)', fontSize: '0.75rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
                        ● Live Syncing Active
                    </div>
                </div>
            </div>
        </div>
    );
}
