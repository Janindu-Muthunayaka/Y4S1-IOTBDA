import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
    Chart as ChartJS, CategoryScale, LinearScale, PointElement,
    LineElement, Title, Tooltip, Legend, Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

const API_BASE = 'http://localhost:3001';

export default function QAInspectorB() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [sensorData, setSensorData] = useState(null);
    const [tripDetails, setTripDetails] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!id) return;
        let isMounted = true;
        const fetchDetails = async () => {
            try {
                const { data } = await axios.get(`${API_BASE}/api/trips/${id}/sensors`);
                if (isMounted) {
                    setTripDetails(data.trip);
                    setSensorData(data.sensorData || { temperature_data: [], motion_data: [] });
                    setIsLoading(false);
                }
            } catch (err) { 
                console.error(err); 
                if (isMounted) setIsLoading(false);
            }
        };
        fetchDetails();
        const interval = setInterval(fetchDetails, 3000); // Live update
        return () => { isMounted = false; clearInterval(interval); };
    }, [id]);

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
                borderWidth: 2,
                pointRadius: 2,
            },
            {
                label: 'Threshold (-18°C)',
                data: labels.map(() => -18.0),
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
                borderWidth: 2,
                pointRadius: 2,
            },
            {
                label: 'Warning (0.5 G)',
                data: (sensorData?.motion_data || []).map(() => 0.5),
                borderColor: '#ef4444',
                borderDash: [5, 5], borderWidth: 2, pointRadius: 0, fill: false,
            }
        ]
    };

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { labels: { color: 'var(--text-secondary)' } }
        },
        scales: {
            x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: 'var(--text-secondary)' } },
            y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: 'var(--text-secondary)' } }
        }
    };

    return (
        <div style={{ display: 'flex', width: '100%', height: '100vh', background: 'var(--bg-dark)', color: 'var(--text-primary)', padding: '1.5rem', gap: '1.5rem', boxSizing: 'border-box' }}>
            
            {/* Left Side: Empty space for alerts as requested */}
            <div className="glass-card" style={{ width: '320px', display: 'flex', flexDirection: 'column', padding: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
                    <button 
                        onClick={() => navigate('/qa')}
                        style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'var(--text-primary)', width: '36px', height: '36px', borderRadius: '50%', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center' }}
                    >
                        ←
                    </button>
                    <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600 }}>QA Inspector</h2>
                </div>
                
                <div style={{ flex: 1, border: '2px dashed rgba(255,255,255,0.1)', borderRadius: '8px', display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'var(--text-secondary)', textAlign: 'center', padding: '1rem' }}>
                    <div>
                        <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>🚧</div>
                        <div>Reserved for Future Alerts & Context Panel</div>
                        <div style={{ fontSize: '0.75rem', marginTop: '0.5rem', opacity: 0.7 }}>Trip ID: {id}</div>
                        <div style={{ fontSize: '0.75rem', marginTop: '0.25rem', opacity: 0.7 }}>Direction: {tripDetails?.trip_direction || '--'}</div>
                    </div>
                </div>
            </div>

            {/* Right Side: Stacked Charts spanning full height/width */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1.5rem', height: '100%' }}>
                
                {/* Top Half: Temperature Details */}
                <div className="glass-card" style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '1.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <h3 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--accent-cyan)' }}>Detailed Temperature Log</h3>
                        {isLoading && <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Loading data...</span>}
                    </div>
                    <div style={{ flex: 1, position: 'relative' }}>
                        <Line data={tempChartData} options={chartOptions} />
                    </div>
                </div>

                {/* Bottom Half: Shock Details */}
                <div className="glass-card" style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '1.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <h3 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--accent-purple)' }}>Detailed Shock & Vibration Log</h3>
                    </div>
                    <div style={{ flex: 1, position: 'relative' }}>
                        <Line data={shockChartData} options={chartOptions} />
                    </div>
                </div>

            </div>

        </div>
    );
}
