import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import QASidebar from './QASidebar';
import { useChatbot } from './Chatbot/ChatbotContext';
import './QA.css';

const API_BASE = 'http://localhost:3001';

export default function QA_Trip() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [tripDetails, setTripDetails] = useState(null);
    const [sensorData, setSensorData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [lastSynced, setLastSynced] = useState('just now');
    const syncTimer = useRef(0);
    const { updateSnapshot } = useChatbot();

    // Derived data
    const temps = sensorData?.temperature_data || [];
    const motions = sensorData?.motion_data || [];
    const trip = tripDetails || {};

    // KPI calculations
    const avgTemp = temps.length > 0 ? (temps.reduce((s, t) => s + (t.avg || 0), 0) / temps.length) : null;
    const tempViolations = temps.filter(t => t.avg > -18);
    const tempCompliance = temps.length > 0 ? Math.round(((temps.length - tempViolations.length) / temps.length) * 100) : 100;
    const majorShocks = motions.filter(m => m.max_accel > 0.5);
    const qualityScore = Math.max(0, Math.floor(tempCompliance - (majorShocks.length * 5)));
    const isLowRisk = qualityScore > 80;

    // Weight data
    const startWeight = trip.startWeight || trip.start_weight || trip.weight1 || null;
    const endWeight = trip.endWeight || trip.end_weight || trip.weight2 || null;
    const weightLoss = (startWeight && endWeight) ? startWeight - endWeight : null;
    const weightLossPct = (startWeight && weightLoss !== null) ? ((weightLoss / startWeight) * 100).toFixed(1) : null;
    
    let weightColorClass = 'qt-weight-green';
    let weightIcon = '✅';
    if (weightLossPct !== null) {
        const pct = parseFloat(weightLossPct);
        if (pct >= 5) { weightColorClass = 'qt-weight-red'; weightIcon = '❌'; }
        else if (pct >= 3) { weightColorClass = 'qt-weight-orange'; weightIcon = '⚠️'; }
        else if (pct > 0) { weightColorClass = 'qt-weight-yellow'; weightIcon = '⚠️'; }
    }

    // Bar chart helpers
    const maxTempVal = temps.length > 0 ? Math.max(...temps.map(t => Math.abs(t.avg || 0))) : 1;
    const maxShockVal = motions.length > 0 ? Math.max(...motions.map(m => m.max_accel || 0)) : 1;

    // Push trip data to chatbot context
    useEffect(() => {
        if (!isLoading && tripDetails && sensorData) {
            updateSnapshot({
                trip: tripDetails,
                sensorData: sensorData,
                kpis: {
                    qualityScore,
                    tempCompliance,
                    cold: temps.filter(t => t.avg < -22),
                    hot: temps.filter(t => t.avg > -18),
                    shocks: motions.filter(m => m.max_accel > 0.5)
                }
            });
        }
    }, [isLoading, tripDetails, sensorData, qualityScore, tempCompliance, updateSnapshot]);

    // Fetch trip + sensor data
    useEffect(() => {
        if (!id) return;
        let mounted = true;
        const fetch = async () => {
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
        fetch();
        const dataInterval = setInterval(fetch, 5000);
        const tickInterval = setInterval(() => {
            syncTimer.current += 1;
            setLastSynced(`${syncTimer.current}s ago`);
        }, 1000);
        return () => { mounted = false; clearInterval(dataInterval); clearInterval(tickInterval); };
    }, [id]);

    // Helpers
    const fmtTime = (d) => d ? new Date(d).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '--:--';

    // Build alerts
    const buildAlerts = () => {
        const alertsList = [];
        if (tempViolations.length > 0) {
            const worst = tempViolations.reduce((a, b) => (a.avg > b.avg ? a : b));
            alertsList.push({ type: 'critical', label: 'Critical', msg: `Temperature exceeded -18°C (${worst.avg?.toFixed(1)}°C) for ${tempViolations.length} interval(s)`, time: worst.time || fmtTime(trip.timestamp), truck: trip.truck_id });
        }
        if (majorShocks.length > 0) {
            const worst = majorShocks.reduce((a, b) => (a.max_accel > b.max_accel ? a : b));
            alertsList.push({ type: 'warning', label: 'High', msg: `High vibration detected (${worst.max_accel?.toFixed(2)}G peak)`, time: worst.time || fmtTime(trip.timestamp), truck: trip.truck_id });
        }
        const minorShocks = motions.filter(m => m.max_accel > 0.3 && m.max_accel <= 0.5);
        if (minorShocks.length > 0) {
            alertsList.push({ type: 'minor', label: 'Medium', msg: `Minor shock events logged (${minorShocks.length})`, time: minorShocks[0].time || fmtTime(trip.timestamp), truck: trip.truck_id });
        }
        if (alertsList.length === 0) {
            alertsList.push({ type: 'info', label: 'Info', msg: 'All parameters within normal range', time: fmtTime(trip.timestamp), truck: 'System' });
        }
        return alertsList;
    };

    const alerts = isLoading ? [] : buildAlerts();

    // Timeline events
    const buildTimeline = () => {
        const events = [];
        events.push({ icon: '🚧', name: 'Gate Entry', time: fmtTime(trip.timestamp), bg: 'gray', sev: 'ok', sevLabel: 'Normal' });
        if (tempViolations.length > 0) {
            events.push({ icon: '⚠️', name: 'Temp Alert', time: tempViolations[0].time || '--:--', bg: 'yellow', sev: 'warn', sevLabel: 'Warning' });
        }
        if (majorShocks.length > 0) {
            events.push({ icon: '💥', name: 'High Vibration', time: majorShocks[0].time || '--:--', bg: 'red', sev: 'crit', sevLabel: 'Critical' });
        }
        if (trip.status === 'COMPLETED') {
            events.push({ icon: '✅', name: 'Arrival', time: fmtTime(trip.updatedAt), bg: 'blue', sev: 'done', sevLabel: 'Completed' });
        } else if (trip.status === 'ACTIVE') {
            events.push({ icon: '🚛', name: 'In Transit', time: 'Now', bg: 'blue', sev: 'done', sevLabel: 'Active' });
        }
        return events;
    };

    if (isLoading) {
        return (
            <div className="qa-loading-container">
                <div className="qa-loading-spinner"></div>
                <div>Loading trip details…</div>
            </div>
        );
    }

    const timeline = buildTimeline();

    return (
        <div className="qa-root">
            {/* ── SIDEBAR ── */}
            <QASidebar activeTab="trip" tripId={id} alerts={alerts} />

            {/* ── MAIN WRAPPER ── */}
            <main className="qa-main">
                {/* HEADER */}
                <header className="qt-header">
                    <div className="qt-header-left">
                        <button className="qt-back-btn" onClick={() => navigate('/qa/dash')}>← Back</button>
                        <div className="qt-header-sep"></div>
                        <div className="qt-header-field">
                            <span className="qt-header-label">Truck ID:</span>
                            <span className="qt-header-value">{trip.truck_id || '--'}</span>
                        </div>
                        <div className="qt-header-sep"></div>
                        <div className="qt-header-field">
                            <span className="qt-header-label">Trip ID:</span>
                            <span className="qt-header-value qt-link">{trip.trip_id || id}</span>
                        </div>
                        <div className="qt-header-field">
                            <span className="qt-header-label">Direction:</span>
                            <span className="qt-header-value">{trip.trip_type || trip.trip_direction || '--'}</span>
                        </div>
                        <div className="qt-header-sep"></div>
                        <div className="qt-header-field">
                            <span className="qt-header-label">Trip Start:</span>
                            <span className="qt-header-value">{fmtTime(trip.timestamp)}</span>
                        </div>
                        <div className="qt-header-sep"></div>
                        <div className="qt-header-field">
                            <span className="qt-header-label">Trip End:</span>
                            <span className="qt-header-value">{
                                (trip.status || '').toUpperCase() === 'ACTIVE' || !trip.status 
                                ? 'In Transit' 
                                : (trip.endTime || trip.end_time || trip.updatedAt || trip.updated_at ? fmtTime(trip.endTime || trip.end_time || trip.updatedAt || trip.updated_at) : '--:--')
                            }</span>
                        </div>
                    </div>
                    <div className="qt-header-right">
                        <div className="qt-dropdown">
                            <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                            Last 24 Hours
                            <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>
                        </div>
                    </div>
                </header>

                {/* KPI BANNER */}
                <div className="qt-kpi-banner">
                    <div className="qt-kpi-card qt-kpi-good">
                        <div className="qt-kpi-label">Quality Score</div>
                        <div className={`qt-kpi-value ${qualityScore >= 80 ? 'qt-green' : 'qt-orange'}`}>{qualityScore}</div>
                        <div className="qt-kpi-sub qt-green">
                            <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><polyline points="18 15 12 9 6 15"/></svg>
                            {qualityScore >= 80 ? 'All indicators good' : 'Needs attention'}
                        </div>
                    </div>
                    <div className="qt-kpi-card qt-kpi-low">
                        <div className="qt-kpi-label">Risk Status</div>
                        <div style={{ margin: '4px 0' }}>
                            <span className={`qt-badge ${isLowRisk ? 'qt-badge-green' : 'qt-badge-orange'}`}>
                                {isLowRisk ? '✓ Low Risk' : '⚠ Elevated'}
                            </span>
                        </div>
                        <div className="qt-kpi-sub qt-gray">{isLowRisk ? 'All parameters normal' : `${tempViolations.length} temp + ${majorShocks.length} shock`}</div>
                    </div>
                    <div className="qt-kpi-card qt-kpi-info">
                        <div className="qt-kpi-label">Temp Compliance</div>
                        <div className="qt-kpi-value qt-blue">{tempCompliance}%</div>
                        <div className="qt-kpi-sub qt-gray">Within safe range (≤ -18°C)</div>
                    </div>
                    <div className="qt-kpi-card qt-kpi-warn">
                        <div className="qt-kpi-label">Shock Events</div>
                        <div className="qt-kpi-value qt-orange">{majorShocks.length}</div>
                        <div className="qt-kpi-sub qt-orange">
                            <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                            {majorShocks.length > 0 ? 'Events logged' : 'No events'}
                        </div>
                    </div>
                </div>

                {/* SCROLLABLE CONTENT */}
                <div className="qt-scroll-area">
                    <div className="qt-content-area">
                        {/* LEFT COLUMN */}
                        <div className="qt-col-left">
                            {/* Temperature Trend */}
                            <div className="qt-card" style={{ cursor: 'pointer' }} onClick={() => navigate(`/qa/graphs/${id}`)} title="Click for detailed charts">
                                <div className="qt-card-title">📈 Temperature Trend <span style={{ fontSize: '10px', color: '#6C5CE7', fontWeight: 400 }}>→ View Details</span></div>
                                <div className="qt-chart-legend">
                                    <div className="qt-legend-item"><div className="qt-legend-dot" style={{ background: '#93C5FD' }}></div> Normal (°C)</div>
                                    <div className="qt-legend-item"><div className="qt-legend-dot" style={{ background: '#F43F5E' }}></div> Spike / Alert</div>
                                </div>
                                <div className="qt-chart-wrap">
                                    <div className="qt-y-unit">°C</div>
                                    <div className="qt-bar-chart" style={{ gap: '1px' }}>
                                        {(() => {
                                            if (temps.length === 0) return <div className="qt-no-data">No temperature data</div>;
                                            const step = Math.ceil(temps.length / 64);
                                            const sampled = temps.filter((_, i) => i % step === 0).slice(0, 64);
                                            const vals = sampled.map(t => t.avg || 0);
                                            const max = Math.max(...vals);
                                            const min = Math.min(...vals);
                                            const range = max - min || 1;
                                            
                                            return sampled.map((t, i) => {
                                                const val = t.avg || 0;
                                                // Higher temperature = Taller bar
                                                const pct = ((val - min) / range) * 85 + 10;
                                                const isSpike = t.avg > -18;
                                                return (
                                                    <div className="qt-bar-col" key={i} style={{ gap: 0 }}>
                                                        <div className="qt-bar-tooltip">{t.avg?.toFixed(1)}°C · {t.time || '--'}</div>
                                                        <div className={`qt-bar ${isSpike ? 'qt-bar-spike' : 'qt-bar-blue'}`} style={{ height: `${pct}%` }}></div>
                                                    </div>
                                                );
                                            });
                                        })()}
                                    </div>
                                </div>
                            </div>

                            {/* Weight Comparison */}
                            <div className="qt-card">
                                <div className="qt-card-title">⚖️ Weight Comparison</div>
                                <div style={{ padding: '26px 10px 8px' }}>
                                    <div className="qt-weight-track">
                                        <div className="qt-weight-arrow"></div>
                                        <div className="qt-weight-line qt-weight-loading">
                                            <div className="qt-weight-line-bar"></div>
                                            <div className="qt-weight-line-label">Loading</div>
                                        </div>
                                        <div className="qt-weight-line qt-weight-arrival">
                                            <div className="qt-weight-line-bar"></div>
                                            <div className="qt-weight-line-label">Arrival</div>
                                        </div>
                                    </div>
                                    <div className="qt-weight-values">
                                        <div>
                                            <span className="qt-weight-val qt-weight-load">{startWeight ? `${startWeight} kg` : '--'}</span>
                                            <span className="qt-weight-val-label">At loading dock</span>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <span className="qt-weight-val qt-weight-arr">{endWeight ? `${endWeight} kg` : '--'}</span>
                                            <span className="qt-weight-val-label">At arrival</span>
                                        </div>
                                    </div>
                                </div>
                                {startWeight && endWeight && (
                                    <div className="qt-plain-summary" style={{ borderLeft: `4px solid ${weightColorClass === 'qt-weight-red' ? '#ef4444' : weightColorClass === 'qt-weight-orange' ? '#f97316' : weightColorClass === 'qt-weight-yellow' ? '#eab308' : '#22c55e'}` }}>
                                        <span className="qt-ps-icon">{weightIcon}</span>
                                        <span>Cargo lost <strong style={{ color: weightColorClass === 'qt-weight-red' ? '#ef4444' : weightColorClass === 'qt-weight-orange' ? '#f97316' : weightColorClass === 'qt-weight-yellow' ? '#eab308' : 'inherit' }}>{weightLoss} kg ({weightLossPct}%)</strong> in transit — {(weightLossPct && parseFloat(weightLossPct) <= 2) ? 'within acceptable threshold' : 'exceeds acceptable threshold'}.</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* RIGHT COLUMN */}
                        <div className="qt-col-right">
                            {/* Shock & Movement */}
                            <div className="qt-card" style={{ cursor: 'pointer' }} onClick={() => navigate(`/qa/graphs/${id}`)} title="Click for detailed charts">
                                <div className="qt-card-title">💥 Shock &amp; Movement <span style={{ fontSize: '10px', color: '#6C5CE7', fontWeight: 400 }}>→ View Details</span></div>
                                <div className="qt-chart-legend">
                                    <div className="qt-legend-item"><div className="qt-legend-dot" style={{ background: '#CA8A04' }}></div> G-force (g)</div>
                                    <div className="qt-legend-item"><div className="qt-legend-dot" style={{ background: '#FCD34D' }}></div> Low intensity</div>
                                </div>
                                <div className="qt-chart-wrap">
                                    <div className="qt-y-unit">g</div>
                                    <div className="qt-bar-chart" style={{ gap: '1px' }}>
                                        {(() => {
                                            if (motions.length === 0) return <div className="qt-no-data">No motion data</div>;
                                            const step = Math.ceil(motions.length / 64);
                                            const sampled = motions.filter((_, i) => i % step === 0).slice(0, 64);
                                            const vals = sampled.map(m => m.max_accel || 0);
                                            const max = Math.max(...vals);
                                            const min = Math.min(...vals);
                                            const range = max - min || 1;

                                            return sampled.map((m, i) => {
                                                const val = m.max_accel || 0;
                                                // Relative scaling to fill 10% to 95% of height
                                                const pct = ((val - min) / range) * 85 + 10;
                                                const isHigh = val > 0.5;
                                                return (
                                                    <div className="qt-bar-col" key={i} style={{ gap: 0 }}>
                                                        <div className="qt-bar-tooltip">{val.toFixed(2)}g · {m.time || '--'}</div>
                                                        <div className={`qt-bar ${isHigh ? 'qt-bar-gold' : 'qt-bar-gold-light'}`} style={{ height: `${pct}%` }}></div>
                                                    </div>
                                                );
                                            });
                                        })()}
                                    </div>
                                </div>
                            </div>

                            {/* Trip Timeline */}
                            <div className="qt-card" style={{ cursor: 'pointer' }} onClick={() => navigate(`/qa/timeline/${id}`)} title="Click for full timeline">
                                <div className="qt-card-title">🗺️ Trip Timeline &amp; Events <span style={{ fontSize: '10px', color: '#6C5CE7', fontWeight: 400 }}>→ View Full Timeline</span></div>
                                <div className="qt-timeline-row">
                                    <div className="qt-timeline-line"></div>
                                    {timeline.map((ev, i) => (
                                        <div className="qt-timeline-event" key={i}>
                                            <div className={`qt-timeline-icon qt-tl-${ev.bg}`}>{ev.icon}</div>
                                            <div className="qt-timeline-name">{ev.name}</div>
                                            <div className="qt-timeline-time">{ev.time}</div>
                                            <div className={`qt-timeline-severity qt-tsev-${ev.sev}`}>{ev.sevLabel}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* STATUS BAR */}
                <div className="qt-status-bar">
                    <div className="qt-sync-dot"></div>
                    Last synced {lastSynced}
                </div>
            </main>

            {/* ── ALERTS PANEL ── */}
            <aside className="qt-alerts-panel">
                <div className="qt-alerts-header">
                    Alerts &amp; Notifications
                    <span className="qt-alerts-count">{alerts.length}</span>
                </div>
                <div className="qt-alerts-list">
                    {alerts.map((alert, i) => {
                        const alertBorder = alert.sev === 'crit' ? '#fca5a5' : alert.sev === 'warn' ? '#fdba74' : alert.sev === 'minor' ? '#fde047' : '#e2e8f0';
                        return (
                            <div className={`qt-alert-item qt-asev-${alert.sev}`} key={i} style={{ border: `1px solid ${alertBorder}`, borderRadius: '8px', marginBottom: '8px' }}>
                                <div className={`qt-alert-dot qt-adot-${alert.sev}`}></div>
                                <div className="qt-alert-body">
                                    <span className={`qt-alert-sev-label qt-asl-${alert.sev}`}>{alert.label}</span>
                                    <div className="qt-alert-msg">{alert.msg}</div>
                                    <div className="qt-alert-meta"><span>{alert.time}</span><span>·</span><span>{alert.truck}</span></div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </aside>
        </div>
    );
}
