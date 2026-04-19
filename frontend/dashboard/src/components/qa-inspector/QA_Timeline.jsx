import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import './QA.css';

const API_BASE = 'http://localhost:3001';

export default function QA_Timeline() {
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
    const tempViolationsCold = temps.filter(t => t.avg < -22);
    const tempViolationsHot = temps.filter(t => t.avg > -18);
    const shockEvents = motions.filter(m => m.max_accel > 0.5);
    const vibrationEvents = motions.filter(m => m.max_accel > 0.3 && m.max_accel <= 0.5);
    const tempCompliance = temps.length > 0 ? Math.round(((temps.length - tempViolationsHot.length) / temps.length) * 100) : 100;
    const qualityScore = Math.max(0, Math.floor(tempCompliance - (shockEvents.length * 5)));
    const isLowRisk = qualityScore > 80;
    const peakShock = shockEvents.length > 0 ? Math.max(...shockEvents.map(s => s.max_accel)).toFixed(2) : '--';
    const avgShock = shockEvents.length > 0 ? (shockEvents.reduce((s, e) => s + e.max_accel, 0) / shockEvents.length).toFixed(2) : '--';
    const coldMin = tempViolationsCold.length > 0 ? Math.min(...tempViolationsCold.map(t => t.avg)).toFixed(1) : '--';
    const hotPeak = tempViolationsHot.length > 0 ? Math.max(...tempViolationsHot.map(t => t.avg)).toFixed(1) : '--';
    const peakVib = motions.length > 0 ? Math.max(...motions.map(m => m.max_accel || 0)).toFixed(2) : '--';
    const avgVib = motions.length > 0 ? (motions.reduce((s, m) => s + (m.max_accel || 0), 0) / motions.length).toFixed(2) : '--';

    // ── Build timeline events from real data ──
    const buildTimelineEvents = () => {
        const events = [];
        const departureTime = fmtTime(trip.timestamp);
        const arrivalTime = trip.updatedAt ? fmtTime(trip.updatedAt) : null;

        // Departure event
        if (trip.timestamp) {
            events.push({ time: departureTime, type: 'departure', label: 'Departure', rawTime: new Date(trip.timestamp).getTime() });
        }

        // Temperature cold events
        tempViolationsCold.forEach(t => {
            events.push({ time: t.time || '--:--', type: 'cold', label: `Temp ${t.avg?.toFixed(1)}°C`, rawTime: t.rawTime || 0 });
        });

        // Temperature hot events
        tempViolationsHot.forEach(t => {
            events.push({ time: t.time || '--:--', type: 'hot', label: `Temp ${t.avg?.toFixed(1)}°C`, rawTime: t.rawTime || 0 });
        });

        // Shock events
        shockEvents.forEach(m => {
            events.push({ time: m.time || '--:--', type: 'shock', label: `Shock ${m.max_accel?.toFixed(2)}G`, rawTime: m.rawTime || 0 });
        });

        // Vibration events
        vibrationEvents.forEach(m => {
            events.push({ time: m.time || '--:--', type: 'vib', label: `Vib ${m.max_accel?.toFixed(2)} m/s²`, rawTime: m.rawTime || 0 });
        });

        // Arrival event
        if (trip.status === 'COMPLETED' && arrivalTime) {
            events.push({ time: arrivalTime, type: 'arrival', label: 'Arrival', rawTime: new Date(trip.updatedAt).getTime() });
        }

        return events;
    };

    // Group timeline events into rows of ~4 for display
    const allEvents = buildTimelineEvents();
    const chunkSize = Math.max(4, Math.ceil(allEvents.length / 4));
    const timelineRows = [];
    for (let i = 0; i < allEvents.length; i += chunkSize) {
        timelineRows.push(allEvents.slice(i, i + chunkSize));
    }

    // Ensure at least 4 display rows
    while (timelineRows.length < 4) {
        timelineRows.push([]);
    }

    const getEventColor = (type) => {
        switch (type) {
            case 'shock': return '#92400e';
            case 'cold': return '#3b82f6';
            case 'hot': return '#ef4444';
            case 'vib': return '#eab308';
            case 'arrival': return '#22c55e';
            case 'departure': return '#374151';
            default: return '#9ca3af';
        }
    };

    if (isLoading) {
        return (
            <div className="qa-loading-container">
                <div className="qa-loading-spinner"></div>
                <div>Loading timeline…</div>
            </div>
        );
    }

    const departureTimeStr = fmtTime(trip.timestamp);
    const arrivalTimeStr = trip.updatedAt ? fmtTime(trip.updatedAt) : 'In Transit';

    return (
        <div className="qa-root">
            {/* ── Sidebar ── */}
            <aside className="qa-sidebar">
                <div className="qa-sidebar-logo">
                    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <line x1="12" y1="2" x2="12" y2="22" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                        <line x1="2" y1="12" x2="22" y2="12" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                        <line x1="5" y1="5" x2="19" y2="19" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                        <line x1="19" y1="5" x2="5" y2="19" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                        <circle cx="12" cy="2" r="1.5" fill="white"/>
                        <circle cx="12" cy="22" r="1.5" fill="white"/>
                        <circle cx="2" cy="12" r="1.5" fill="white"/>
                        <circle cx="22" cy="12" r="1.5" fill="white"/>
                    </svg>
                </div>
                <nav className="qa-nav-items">
                    <div className="qa-nav-item" onClick={() => navigate('/qa/dash')}>
                        <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
                            <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
                        </svg>
                        <span className="qa-tooltip">Dashboard</span>
                    </div>
                    <div className="qa-nav-item" onClick={() => navigate(`/qa/trip/${id}`)}>
                        <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M1 3h15v13H1z"/><path d="M16 8l4 2v6h-4z"/>
                            <circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
                        </svg>
                        <span className="qa-tooltip">Trip Detail</span>
                    </div>
                    <div className="qa-nav-item" onClick={() => navigate(`/qa/graphs/${id}`)}>
                        <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                        </svg>
                        <span className="qa-tooltip">Analytics (Graphs)</span>
                    </div>
                    <div className="qa-nav-item active">
                        <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="17" y1="2" x2="17" y2="22"/><line x1="7" y1="2" x2="7" y2="22"/>
                            <line x1="2" y1="12" x2="22" y2="12"/>
                        </svg>
                        <span className="qa-tooltip">Timeline</span>
                    </div>
                    <div className="qa-nav-item" onClick={() => navigate('/qa/dashboard')}>
                        <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="3"/>
                            <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
                        </svg>
                        <span className="qa-tooltip">Settings (Test Mode)</span>
                    </div>
                </nav>
                <div className="qa-sidebar-bottom">
                    <div className="qa-avatar">QA</div>
                </div>
            </aside>

            {/* ── Main Content ── */}
            <main className="qa-main">
                {/* Header */}
                <header className="qa-header" style={{ padding: '0 24px', justifyContent: 'space-between' }}>
                    <div className="qa-header-left">
                        <h2 className="qa-header-title">QA Inspector — Timeline</h2>
                    </div>
                    <div className="qa-header-right">
                        <div className="qa-header-controls">
                            <div className="qa-trip-badge">Trip: <span style={{ color: '#6366f1' }}>{trip.trip_id || id}</span></div>
                            <div className="qa-header-btn" onClick={() => navigate(`/qa/trip/${id}`)}>← Back to Trip</div>
                        </div>
                    </div>
                </header>

                {/* Info Row */}
                <div style={{ background: '#fff', padding: '10px 24px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: '24px', fontSize: '13px', color: '#5a6070' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>🚛 Truck ID: <strong>{trip.truck_id || '--'}</strong></span>
                    <span>🕐 Departure: <strong>{departureTimeStr}</strong></span>
                    <span>🏁 Arrival: <strong>{arrivalTimeStr}</strong></span>
                    <span style={{ marginLeft: 'auto', color: '#64748b' }}>Synced: {lastSynced}</span>
                </div>

                {/* Scrollable Content */}
                <div className="qa-content" style={{ padding: '16px 20px', overflowY: 'auto', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', width: '100%' }}>

                        {/* ── KPI Row ── */}
                        <div className="tl-kpi-row">
                            {/* Shock Events */}
                            <div className="tl-kpi-card tl-kpi-blue">
                                <div className="tl-kpi-title">Shock Events</div>
                                <div className="tl-kpi-value tl-val-orange">{shockEvents.length}</div>
                                <div className="tl-kpi-subtitle" style={{ color: '#f59e0b' }}>during transit</div>
                                <div className="tl-kpi-details">
                                    Peak: <span className="bold">{peakShock} G</span> · Avg: <span className="bold">{avgShock} G</span>
                                </div>
                            </div>

                            {/* Cold Events */}
                            <div className="tl-kpi-card tl-kpi-blue">
                                <div className="tl-kpi-title">Cold Events</div>
                                <div className="tl-kpi-value tl-val-blue">{tempViolationsCold.length}</div>
                                <div className="tl-kpi-subtitle" style={{ color: '#3b82f6' }}>below -22°C</div>
                                <div className="tl-kpi-details">
                                    Min recorded: <span className="bold">{coldMin}°C</span>
                                </div>
                            </div>

                            {/* Hot Events */}
                            <div className="tl-kpi-card tl-kpi-red">
                                <div className="tl-kpi-title">Hot Events</div>
                                <div className="tl-kpi-value tl-val-red">{tempViolationsHot.length}</div>
                                <div className="tl-kpi-subtitle" style={{ color: '#ef4444' }}>above -18°C</div>
                                <div className="tl-kpi-details">
                                    Peak: <span className="bold">{hotPeak}°C</span> · Risk: <span style={{ color: tempViolationsHot.length > 0 ? '#ef4444' : '#22c55e', fontWeight: 700 }}>{tempViolationsHot.length > 0 ? 'High' : 'Low'}</span>
                                </div>
                            </div>

                            {/* Vibration Events */}
                            <div className="tl-kpi-card tl-kpi-yellow">
                                <div className="tl-kpi-title">Vibration Events</div>
                                <div className="tl-kpi-value tl-val-yellow">{vibrationEvents.length}</div>
                                <div className="tl-kpi-subtitle" style={{ color: '#eab308' }}>moderate readings</div>
                                <div className="tl-kpi-details">
                                    Peak: <span className="bold">{peakVib} m/s²</span> · Avg: <span className="bold">{avgVib} m/s²</span>
                                </div>
                            </div>

                            {/* Quality Score */}
                            <div className="tl-kpi-card tl-kpi-green">
                                <div className="tl-kpi-title">Quality Score</div>
                                <div className="tl-kpi-value tl-val-green">{qualityScore}<span className="tl-small">/100</span></div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: 600, color: isLowRisk ? '#22c55e' : '#f59e0b', marginBottom: '4px' }}>
                                    {isLowRisk ? '▲ Good condition' : '▼ Needs attention'}
                                </div>
                                <div className="tl-kpi-details">
                                    Temp compliance: <span style={{ color: '#22c55e', fontWeight: 700 }}>{tempCompliance}%</span><br/>
                                    Risk: <span style={{ color: isLowRisk ? '#22c55e' : '#f59e0b', fontWeight: 700 }}>{isLowRisk ? 'Low Risk' : 'Elevated'}</span>
                                </div>
                            </div>
                        </div>

                        {/* ── Timeline Card ── */}
                        <div className="tl-timeline-card">
                            <div className="tl-timeline-header">
                                <div>
                                    <div className="tl-timeline-title">Trip Event Timeline</div>
                                    <div className="tl-timeline-subtitle">{departureTimeStr} → {arrivalTimeStr} · {trip.truck_id || '--'}</div>
                                </div>
                                <div className="tl-legend">
                                    <div className="tl-legend-item"><div className="tl-legend-dot" style={{ background: '#ef4444' }}></div> Too Hot</div>
                                    <div className="tl-legend-item"><div className="tl-legend-dot" style={{ background: '#3b82f6' }}></div> Too Cold</div>
                                    <div className="tl-legend-item"><div className="tl-legend-dot" style={{ background: '#eab308' }}></div> Vibration</div>
                                    <div className="tl-legend-item"><div className="tl-legend-dot" style={{ background: '#92400e' }}></div> Shock</div>
                                    <div className="tl-legend-item"><div className="tl-legend-dot" style={{ background: '#22c55e' }}></div> Arrival</div>
                                    <div className="tl-legend-item"><div className="tl-legend-line"></div> Timeline</div>
                                </div>
                            </div>

                            <div className="tl-timeline-rows">
                                {timelineRows.map((row, rowIdx) => {
                                    const rowLabel = row.length > 0 ? row[0].time : '--:--';
                                    const rowEndLabel = row.length > 0 ? row[row.length - 1].time : '--:--';
                                    return (
                                        <div className="tl-timeline-row" key={rowIdx}>
                                            <div className="tl-row-label">{rowLabel}</div>
                                            <div className="tl-timeline-track">
                                                <div className="tl-track-line"></div>
                                                <div className="tl-track-arrow"></div>
                                                {row.map((ev, evIdx) => {
                                                    const pct = row.length > 1 ? (evIdx / (row.length - 1)) * 90 + 5 : 50;
                                                    const isAbove = evIdx % 2 === 0;
                                                    return (
                                                        <div key={evIdx}>
                                                            <div
                                                                className="tl-event-dot"
                                                                style={{ left: `${pct}%`, background: getEventColor(ev.type) }}
                                                                title={`${ev.time} - ${ev.label}`}
                                                            ></div>
                                                            <div
                                                                className={`tl-event-label ${isAbove ? 'tl-label-above' : 'tl-label-below'}`}
                                                                style={{ left: `${pct}%` }}
                                                            >
                                                                {ev.time} - {ev.label}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                                <div style={{ position: 'absolute', right: '-8px', top: '-8px', fontSize: '10px', color: '#9099aa', fontFamily: "'JetBrains Mono', monospace" }}>{rowEndLabel}</div>
                                            </div>
                                        </div>
                                    );
                                })}

                                {/* If no events at all */}
                                {allEvents.length === 0 && (
                                    <div style={{ textAlign: 'center', padding: '40px', color: '#9099aa', fontSize: '14px' }}>
                                        No timeline events recorded for this trip.
                                    </div>
                                )}
                            </div>
                        </div>

                    </div>
                </div>
            </main>

        </div>
    );
}
