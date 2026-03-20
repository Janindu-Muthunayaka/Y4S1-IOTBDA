import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler
);

const API_BASE = 'http://localhost:3001';

export default function TripAnalytics() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [trip, setTrip] = useState(null);
    const [sensorData, setSensorData] = useState(null);

    useEffect(() => {
        let isMounted = true;
        const fetchDetails = async () => {
            try {
                const { data } = await axios.get(`${API_BASE}/api/trips/${id}/sensors`);
                if (isMounted) {
                    setTrip(data.trip);
                    setSensorData(data.sensorData || { temperature_data: [], motion_data: [] });
                }
            } catch (err) {
                console.error("Failed to load trip:", err);
            }
        };

        fetchDetails();
        // Live pull strictly from MongoDB every 3 seconds
        const interval = setInterval(fetchDetails, 3000);

        return () => {
            isMounted = false;
            clearInterval(interval);
        };
    }, [id]);

    if (!trip || !sensorData) {
        return (
            <div className="dashboard-container" style={{ textAlign: 'center', marginTop: '5rem' }}>
                <div className="pulse-dot" style={{ margin: '0 auto 1rem auto' }}></div>
                <h2>Querying MongoDB History...</h2>
            </div>
        );
    }

    const labels = sensorData.temperature_data ? sensorData.temperature_data.map(d => d.time) : [];

    const tempChartData = {
        labels,
        datasets: [
            {
                label: 'Avg Temp (°C)',
                data: sensorData.temperature_data ? sensorData.temperature_data.map(d => d.avg) : [],
                borderColor: '#06b6d4',
                backgroundColor: 'rgba(6, 182, 212, 0.1)',
                tension: 0.4,
                fill: true,
            },
            {
                label: 'Safe Threshold (5°C)',
                data: labels.map(() => 5.0),
                borderColor: '#ef4444',
                borderDash: [5, 5],
                borderWidth: 2,
                pointRadius: 0,
                fill: false,
            }
        ]
    };

    const shockChartData = {
        labels: sensorData.motion_data ? sensorData.motion_data.map(d => d.time) : [],
        datasets: [
            {
                label: 'Max Shock (G)',
                data: sensorData.motion_data ? sensorData.motion_data.map(d => d.max_accel) : [],
                borderColor: '#8b5cf6',
                backgroundColor: 'rgba(139, 92, 246, 0.1)',
                tension: 0.2,
                fill: true,
            },
            {
                label: 'Warning Threshold (0.5 G)',
                data: (sensorData.motion_data || []).map(() => 0.5),
                borderColor: '#ef4444',
                borderDash: [5, 5],
                borderWidth: 2,
                pointRadius: 0,
                fill: false,
            }
        ]
    };

    const currentTemp = (sensorData.temperature_data && sensorData.temperature_data.length > 0)
        ? sensorData.temperature_data[sensorData.temperature_data.length - 1].avg
        : '--';

    const isLive = trip.status === 'ACTIVE';

    // Legacy Schema matching for accurate metric calculation on older db records
    const w1 = trip.weight1 ?? trip.start_weight ?? trip.weight;
    const w2 = trip.weight2 ?? trip.end_weight;
    const retention = (w1 !== undefined && w2 !== undefined && w1 !== 0)
        ? ((w2 / w1) * 100).toFixed(1) + '%'
        : '--';

    return (
        <div className="glass-card">
            <button className="back-btn" onClick={() => navigate('/')}>
                ← Back to Trips
            </button>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div>
                    <h2 style={{ margin: '0 0 0.5rem 0' }}>Analytics: {trip.trip_id}</h2>
                    <div style={{ color: 'var(--text-secondary)' }}>
                        Truck: <span style={{ color: 'var(--text-primary)' }}>{trip.truck_id}</span> |
                        Status: <span className={`badge ${isLive ? 'badge-active' : 'badge-completed'}`} style={{ marginLeft: '0.5rem' }}>{trip.status}</span>
                    </div>
                </div>
                <div style={{ textAlign: 'right', display: 'flex', gap: '2rem' }}>
                    <div>
                        <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Weight Retention</div>
                        <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                            {retention}
                        </div>
                    </div>
                    <div>
                        <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Latest Temp</div>
                        <div style={{ fontSize: '2rem', fontWeight: 700, color: currentTemp > 5 ? 'var(--danger)' : 'var(--success)' }}>
                            {currentTemp !== '--' ? `${currentTemp}°C` : '--'}
                        </div>
                    </div>
                </div>
            </div>

            <div className="chart-grid">
                <div className="glass-card" style={{ background: 'rgba(0,0,0,0.2)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                        <h3 style={{ margin: 0 }}>Temperature History</h3>
                        {isLive && <div className="live-indicator" style={{ color: 'var(--accent-purple)' }}><div className="pulse-dot" style={{ backgroundColor: 'var(--accent-purple)' }}></div></div>}
                    </div>
                    <div style={{ height: '300px' }}>
                        <Line data={tempChartData} options={{ responsive: true, maintainAspectRatio: false }} />
                    </div>
                </div>

                <div className="glass-card" style={{ background: 'rgba(0,0,0,0.2)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                        <h3 style={{ margin: 0 }}>Shock & Motion (G)</h3>
                        {isLive && <div className="live-indicator" style={{ color: 'var(--accent-purple)' }}><div className="pulse-dot" style={{ backgroundColor: 'var(--accent-purple)' }}></div></div>}
                    </div>
                    <div style={{ height: '300px' }}>
                        <Line data={shockChartData} options={{ responsive: true, maintainAspectRatio: false }} />
                    </div>
                </div>
            </div>
        </div>
    );
}
