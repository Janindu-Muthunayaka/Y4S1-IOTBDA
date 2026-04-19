import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
    Chart as ChartJS, CategoryScale, LinearScale, PointElement,
    LineElement, BarElement, Title, Tooltip, Legend, Filler
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';
import QASidebar from './QASidebar';
import './QA.css';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, Filler);

const API_BASE = 'http://localhost:3001';

/* ── Custom Chart.js plugin: Reference Lines ── */
const refLinesPlugin = {
    id: 'refLines',
    afterDraw(chart) {
        const lines = chart.options.plugins?.refLines?.lines;
        if (!lines) return;
        const { ctx, scales: { x, y } } = chart;
        lines.forEach(({ value, color, label, dash }) => {
            const yPos = y.getPixelForValue(value);
            ctx.save();
            ctx.beginPath();
            ctx.strokeStyle = color;
            ctx.lineWidth = 1.5;
            ctx.setLineDash(dash || []);
            ctx.moveTo(x.left, yPos);
            ctx.lineTo(x.right, yPos);
            ctx.stroke();
            ctx.setLineDash([]);
            if (label) {
                ctx.fillStyle = color;
                ctx.font = '10px sans-serif';
                ctx.textAlign = 'right';
                ctx.fillText(label, x.right - 2, yPos - 3);
            }
            ctx.restore();
        });
    }
};

export default function QA_Graphs() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [tripDetails, setTripDetails] = useState(null);
    const [sensorData, setSensorData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [lastSynced, setLastSynced] = useState('just now');
    const syncTimer = useRef(0);

    useEffect(() => {
        if (!id) return;
        let mounted = true;
        const fetchData = async () => {
            try {
                const { data } = await axios.get(`${API_BASE}/api/trips/${id}/sensors`);
                if (mounted) {
                    setTripDetails(data.trip);
                    setSensorData(data.sensorData || { temperature_data: [], motion_data: [] });
                    setIsLoading(false);
                    syncTimer.current = 0;
                    setLastSynced('just now');
                }
            } catch (err) {
                console.error(err);
                if (mounted) setIsLoading(false);
            }
        };
        fetchData();
        const dataInterval = setInterval(fetchData, 5000);
        const tickInterval = setInterval(() => {
            syncTimer.current += 1;
            setLastSynced(`${syncTimer.current}s ago`);
        }, 1000);
        return () => { 
            mounted = false; 
            clearInterval(dataInterval); 
            clearInterval(tickInterval);
        };
    }, [id]);

    const fmtTime = (d) => d ? new Date(d).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '--:--';

    const trip = tripDetails || {};
    const temps = sensorData?.temperature_data || [];
    const motions = sensorData?.motion_data || [];

    // ── KPI computations ──
    const tempAvg = temps.length > 0 ? (temps.reduce((s, t) => s + (t.avg || 0), 0) / temps.length).toFixed(1) : '--';
    const tempMin = temps.length > 0 ? Math.min(...temps.map(t => t.min ?? t.avg ?? 0)).toFixed(1) : '--';
    const tempMax = temps.length > 0 ? Math.max(...temps.map(t => t.max ?? t.avg ?? 0)).toFixed(1) : '--';
    const tempBreaches = temps.filter(t => t.avg > -18).length;

    const motionPeak = motions.length > 0 ? Math.max(...motions.map(m => m.max_accel || 0)).toFixed(2) : '--';
    const motionAvg = motions.length > 0 ? (motions.reduce((s, m) => s + (m.max_accel || 0), 0) / motions.length).toFixed(2) : '--';
    const impactEvents = motions.filter(m => m.max_accel > 0.3);

    // ── Time labels ──
    const timeLabels = temps.map(t => t.time || '');
    const motionLabels = motions.map(m => m.time || '');

    // ── Chart 1: Thermal Stability (Floating Bar + Trend Line) ──
    const tempChartData = {
        labels: timeLabels,
        datasets: [
            {
                label: 'Temperature Range',
                data: temps.map(t => {
                    const avg = t.avg || 0;
                    const min = t.min ?? avg - 0.5;
                    const max = t.max ?? avg + 0.5;
                    return [min, max];
                }),
                backgroundColor: temps.map(t => {
                    const avg = t.avg || 0;
                    if (avg > -18) return '#ef4444'; // Red for breach
                    return '#1e293b'; // Dark blue for normal
                }),
                barPercentage: 0.7,
                categoryPercentage: 0.8,
            },
            {
                label: 'Trend',
                data: temps.map(t => t.avg || 0),
                type: 'line',
                borderColor: '#6366f1',
                borderWidth: 2,
                pointRadius: 0,
                fill: false,
                tension: 0.4,
            }
        ]
    };
    // ── Data Derivations ──
    const impactData = motions.filter(m => m.max_accel > 0.3);

    // ── Pre-calculate Chart Bounds for dynamic scaling ──
    const tMinArr = temps.map(t => t.min ?? t.avg ?? -20);
    const tMaxArr = temps.map(t => t.max ?? t.avg ?? -15);
    const tMin = tMinArr.length > 0 ? Math.min(...tMinArr) : -25;
    const tMax = tMaxArr.length > 0 ? Math.max(...tMaxArr) : -15;
    const tRange = tMax - tMin || 2;
    const tChartMin = tMin - (tRange * 0.15);
    const tChartMax = tMax + (tRange * 0.15);

    const vArr = motions.map(m => m.max_accel || 0);
    const vMax = vArr.length > 0 ? Math.max(...vArr) : 1;
    const vChartMax = Math.max(0.6, vMax * 1.15); 

    const iArr = impactData.map(m => m.max_accel || 0);
    const iMax = iArr.length > 0 ? Math.max(...iArr) : 1;
    const iChartMax = Math.max(1.0, iMax * 1.2);

    const tempChartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            tooltip: {
                callbacks: {
                    label: (ctx) => {
                        if (ctx.datasetIndex === 0) {
                            const v = ctx.raw;
                            if (Array.isArray(v)) return `Range: ${v[0]?.toFixed(1)} – ${v[1]?.toFixed(1)}°C`;
                        }
                        return `Trend: ${ctx.parsed.y?.toFixed(1)}°C`;
                    }
                }
            },
            refLines: {
                lines: [{ value: -18, color: '#ef4444', label: '-18°C Max' }]
            }
        },
        scales: {
            x: { ticks: { font: { size: 10 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 10 }, grid: { display: false } },
            y: { 
                min: tChartMin, 
                max: tChartMax, 
                ticks: { font: { size: 10 }, callback: v => v.toFixed(1) + '°' }, 
                grid: { color: 'rgba(0,0,0,0.06)' } 
            }
        }
    };

    // ── Chart 2: Vibration Frequency ──
    const vibChartData = {
        labels: motionLabels,
        datasets: [
            {
                label: 'Vibration',
                data: motions.map(m => m.max_accel || 0),
                borderColor: '#111',
                borderWidth: 1.5,
                borderDash: [4, 4],
                pointRadius: 0,
                fill: false,
                tension: 0.3,
            },
            {
                label: 'Peak events',
                data: motions.map(m => (m.max_accel > 0.5) ? m.max_accel : null),
                borderColor: 'transparent',
                backgroundColor: '#f59e0b',
                pointRadius: 6,
                pointStyle: 'circle',
                showLine: false,
            }
        ]
    };
    const vibChartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            refLines: {
                lines: [ { value: 0.5, color: '#f59e0b', label: '0.5 m/s²', dash: [5, 5] } ]
            }
        },
        scales: {
            x: { ticks: { font: { size: 10 }, autoSkip: true, maxTicksLimit: 10 }, grid: { display: false } },
            y: { min: 0, max: vChartMax, ticks: { font: { size: 10 } }, grid: { color: 'rgba(0,0,0,0.06)' } }
        }
    };

    // ── Chart 3: G-Force Impacts ──
    const gforceChartData = {
        labels: impactData.map(m => m.time || ''),
        datasets: [{
            label: 'G-Force',
            data: impactData.map(m => m.max_accel || 0),
            backgroundColor: impactData.map(m => (m.max_accel || 0) > 0.8 ? '#ef4444' : '#f59e0b'),
            barThickness: 16,
            borderRadius: 4,
        }]
    };
    const gforceChartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            refLines: {
                lines: [
                    { value: 0.8, color: '#ef4444', label: '0.8G Limit' },
                    { value: 0.5, color: '#f59e0b', label: '0.5G Warning' },
                ]
            }
        },
        scales: {
            x: { ticks: { font: { size: 10 } }, grid: { display: false } },
            y: { min: 0, max: iChartMax, ticks: { font: { size: 10 }, callback: v => v + 'G' }, grid: { color: 'rgba(0,0,0,0.06)' } }
        }
    };

    if (isLoading) {
        return (
            <div className="qa-loading-container">
                <div className="qa-loading-spinner"></div>
                <div>Loading sensor analytics…</div>
            </div>
        );
    }

    return (
        <div className="qa-root">
            {/* ── Sidebar ── */}
            <QASidebar activeTab="analytics" tripId={id} />

            {/* ── Main Content ── */}
            <main className="qa-main">
                {/* Header */}
                <header className="qa-header" style={{ padding: '0 24px', justifyContent: 'space-between' }}>
                    <div className="qa-header-left">
                        <h2 className="qa-header-title">Detailed Sensor Analytics</h2>
                    </div>
                    <div className="qa-header-right">
                        <div className="qa-header-controls">
                            <div className="qa-trip-badge">ID: <span style={{ color: '#6366f1' }}>{trip.trip_id || id}</span></div>
                            <div className="qa-header-btn" onClick={() => navigate(`/qa/trip/${id}`)}>← Back to Trip</div>
                        </div>
                    </div>
                </header>

                {/* Topbar Info Row */}
                <div style={{ background: '#fff', padding: '12px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', gap: '32px', fontSize: '13px' }}>
                    <div>Truck: <strong>{trip.truck_id || '--'}</strong></div>
                    <div>Direction: <strong>{trip.trip_direction || '--'}</strong></div>
                    <div>Last Sync: <span style={{ color: '#64748b' }}>{lastSynced || 'just now'}</span></div>
                    <div style={{ marginLeft: 'auto', color: '#6366f1', fontWeight: 600 }}>Quality: {trip.quality_score || 95}%</div>
                </div>

                <div className="qa-content" style={{ padding: '24px 0', overflowY: 'auto', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', width: '100%' }}>
                        
                        {/* Thermal Stability */}
                        <div className="qt-card" style={{ padding: '20px 24px', borderRadius: 0, borderLeft: 'none', borderRight: 'none' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                                <div>
                                    <h3 style={{ fontSize: '15px', fontWeight: 600 }}>Thermal Stability Gradient (°C)</h3>
                                    <p style={{ fontSize: '12px', color: '#64748b' }}>Interval monitoring active • {temps.length} points</p>
                                </div>
                                <div style={{ display: 'flex', gap: '16px', textAlign: 'right' }}>
                                    <div><div style={{ fontSize: '10px', color: '#64748b' }}>AVG</div><div style={{ fontSize: '14px', fontWeight: 700 }}>{tempAvg}°</div></div>
                                    <div><div style={{ fontSize: '10px', color: '#64748b' }}>MIN</div><div style={{ fontSize: '14px', fontWeight: 700, color: '#2563eb' }}>{tempMin}°</div></div>
                                    <div><div style={{ fontSize: '10px', color: '#64748b' }}>MAX</div><div style={{ fontSize: '14px', fontWeight: 700, color: '#dc2626' }}>{tempMax}°</div></div>
                                </div>
                            </div>
                            <div style={{ height: '160px', position: 'relative' }}>
                                <Bar data={tempChartData} options={tempChartOptions} plugins={[refLinesPlugin]} />
                            </div>
                        </div>

                        {/* Vibration Frequency */}
                        <div className="qt-card" style={{ padding: '20px 24px', borderRadius: 0, borderLeft: 'none', borderRight: 'none' }}>
                            <div style={{ marginBottom: '16px' }}>
                                <h3 style={{ fontSize: '15px', fontWeight: 600 }}>Vibration Frequency Spectrum (m/s²)</h3>
                                <p style={{ fontSize: '12px', color: '#64748b' }}>Real-time accelerometer logs</p>
                            </div>
                            <div style={{ height: '140px', position: 'relative' }}>
                                <Line data={vibChartData} options={vibChartOptions} plugins={[refLinesPlugin]} />
                            </div>
                        </div>

                        {/* G-Force Impacts */}
                        <div className="qt-card" style={{ padding: '20px 24px', borderRadius: 0, borderLeft: 'none', borderRight: 'none' }}>
                            <div style={{ marginBottom: '16px' }}>
                                <h3 style={{ fontSize: '15px', fontWeight: 600 }}>G-Force Critical Impact Events</h3>
                                <p style={{ fontSize: '12px', color: '#64748b' }}>Detection threshold: {'>'} 0.3G</p>
                            </div>
                            <div style={{ height: '140px', position: 'relative' }}>
                                <Bar data={gforceChartData} options={gforceChartOptions} plugins={[refLinesPlugin]} />
                            </div>
                        </div>

                    </div>
                </div>
            </main>
        </div>
    );
}
