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
    const [mlScore, setMlScore] = useState(null);
    const [mlScoreStatus, setMlScoreStatus] = useState('loading');
    const [isLoading, setIsLoading] = useState(true);
    const [lastSynced, setLastSynced] = useState('just now');
    const syncTimer = useRef(0);
    const { updateSnapshot } = useChatbot();

    // Derived data
    const temps = sensorData?.temperature_data || [];
    const motions = sensorData?.motion_data || [];
    const humidityData = sensorData?.humidity_data || [];
    const trip = tripDetails || {};

    const mostFrequentHumidity = (() => {
        if (humidityData.length === 0) return '--';
        const counts = {};
        humidityData.forEach(h => {
            counts[h.level] = (counts[h.level] || 0) + 1;
        });
        return Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b);
    })();

    // KPI calculations
    const avgTemp = temps.length > 0 ? (temps.reduce((s, t) => s + (t.avg || 0), 0) / temps.length) : null;
    const tempViolations = temps.filter(t => t.avg > -18);
    const tempCompliance = temps.length > 0 ? Math.round(((temps.length - tempViolations.length) / temps.length) * 100) : 100;
    const majorShocks = motions.filter(m => m.max_accel > 0.5);
    const minorShocks = motions.filter(m => m.max_accel > 0.2 && m.max_accel <= 0.5);
    const fallbackScore = Math.max(0, Math.floor(tempCompliance - (majorShocks.length * 5) - (minorShocks.length * 2)));
    const qualityScore = mlScore !== null ? Math.max(0, Math.min(100, Math.round(mlScore))) : fallbackScore;
    const isQualityLoading = mlScoreStatus === 'loading';
    const isLowRisk = qualityScore > 80;

    // KPI Colors
    const qualityColor = qualityScore >= 80 ? '#22c55e' : qualityScore >= 60 ? '#f97316' : '#ef4444';
    const qualityBg = qualityScore >= 80 ? '#f0fdf4' : qualityScore >= 60 ? '#fff7ed' : '#fef2f2';

    const riskColor = isLowRisk ? '#22c55e' : '#f97316';
    const riskBg = isLowRisk ? '#f0fdf4' : '#fff7ed';

    // Weight data
    const startWeight = trip.startWeight || trip.start_weight || trip.weight1 || null;
    const endWeight = trip.endWeight || trip.end_weight || trip.weight2 || null;
    const weightLoss = (startWeight && endWeight) ? startWeight - endWeight : null;
    const weightLossPct = (startWeight && weightLoss !== null) ? ((weightLoss / startWeight) * 100).toFixed(1) : null;

    let weightColorClass = 'qt-weight-green';
    let weightIcon = '✅';
    let weightHexColor = '#22c55e'; // Default Green
    if (weightLossPct !== null) {
        const pct = parseFloat(weightLossPct);
        if (pct >= 5) { 
            weightColorClass = 'qt-weight-red'; 
            weightIcon = '❌'; 
            weightHexColor = '#ef4444'; // Red
        }
        else if (pct >= 3) { 
            weightColorClass = 'qt-weight-orange'; 
            weightIcon = '⚠️'; 
            weightHexColor = '#f97316'; // Orange
        }
        else if (pct > 0) { 
            weightColorClass = 'qt-weight-yellow'; 
            weightIcon = '⚠️'; 
            weightHexColor = '#eab308'; // Yellow/Gold
        }
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
                // 1. Fetch sensor data first for immediate rendering
                const sensorRes = await axios.get(`${API_BASE}/api/trips/${id}/sensors`);
                if (mounted) {
                    setTripDetails(sensorRes.data.trip);
                    setSensorData(sensorRes.data.sensorData || { temperature_data: [], motion_data: [] });
                    setIsLoading(false);
                    syncTimer.current = 0;
                    setLastSynced('just now');
                }
                
                // 2. Fetch ML score asynchronously without blocking
                axios.get(`${API_BASE}/api/quality-score/${id}`)
                    .then(mlRes => {
                        if (mounted) {
                            if (mlRes.data && mlRes.data.success && mlRes.data.quality_score !== undefined) {
                                setMlScore(mlRes.data.quality_score);
                                setMlScoreStatus('success');
                            } else {
                                setMlScoreStatus(prev => prev === 'loading' ? 'error' : prev);
                            }
                        }
                    })
                    .catch(() => { if (mounted) setMlScoreStatus(prev => prev === 'loading' ? 'error' : prev); });
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
        
        const timeoutId = setTimeout(() => {
            if (mounted) setMlScoreStatus(prev => prev === 'loading' ? 'timeout' : prev);
        }, 10000);

        return () => { mounted = false; clearInterval(dataInterval); clearInterval(tickInterval); clearTimeout(timeoutId); };
    }, [id]);

    // Helpers
    const fmtTime = (d) => d ? new Date(d).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '--:--';

    // Build alerts
    const buildAlerts = () => {
        const alertsList = [];
        if (tempViolations.length > 0) {
            const worst = tempViolations.reduce((a, b) => (a.avg > b.avg ? a : b));
            alertsList.push({ sev: 'crit', label: 'Critical', msg: `Temperature exceeded -18°C (${worst.avg?.toFixed(1)}°C) for ${tempViolations.length} interval(s)`, time: worst.time || fmtTime(trip.timestamp), truck: trip.truck_id });
        }
        if (majorShocks.length > 0) {
            const worst = majorShocks.reduce((a, b) => (a.max_accel > b.max_accel ? a : b));
            alertsList.push({ sev: 'warn', label: 'High', msg: `High vibration detected (${worst.max_accel?.toFixed(2)}G peak)`, time: worst.time || fmtTime(trip.timestamp), truck: trip.truck_id });
        }
        const mShocks = motions.filter(m => m.max_accel > 0.3 && m.max_accel <= 0.5);
        if (mShocks.length > 0) {
            alertsList.push({ sev: 'minor', label: 'Medium', msg: `Minor shock events logged (${mShocks.length})`, time: mShocks[0].time || fmtTime(trip.timestamp), truck: trip.truck_id });
        }
        if (alertsList.length === 0) {
            alertsList.push({ sev: 'info', label: 'Info', msg: 'All parameters within normal range', time: fmtTime(trip.timestamp), truck: 'System' });
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
                            <span className="qt-header-label">Trip ID:</span>
                            <span className="qt-header-value qt-link" style={{ fontWeight: 600 }}>
                                {(() => {
                                    const tripIdStr = trip.trip_id || id || '';
                                    const parts = tripIdStr.split('-');
                                    return parts.map((part, index) => (
                                        <React.Fragment key={index}>
                                            <span style={{ color: index === 1 ? '#3B82F6' : '#111827' }}>
                                                {part}
                                            </span>
                                            {index < parts.length - 1 && <span style={{ color: '#111827' }}>-</span>}
                                        </React.Fragment>
                                    ));
                                })()}
                            </span>
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
                        <div className="qt-header-sep"></div>
                        <div className="qt-header-field">
                            <span className="qt-header-label">Humidity:</span>
                            <span className="qt-header-value" style={{ 
                                color: mostFrequentHumidity === 'High' ? '#ef4444' : mostFrequentHumidity === 'Low' ? '#22c55e' : '#f97316',
                                fontWeight: 600
                            }}>
                                {mostFrequentHumidity}
                            </span>
                        </div>
                    </div>
                    <div className="qt-header-right">
                    </div>
                </header>

                {/* KPI BANNER */}
                <div className="qt-kpi-banner">
                    <div className="qt-kpi-card" style={{ 
                        minHeight: '116px', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '1.2rem',
                        background: isQualityLoading ? '#f9fafb' : qualityBg, borderLeft: `4px solid ${isQualityLoading ? '#d1d5db' : qualityColor}`, borderColor: isQualityLoading ? '#d1d5db' : qualityColor 
                    }}>
                        <div className="qt-kpi-label" style={{ fontSize: '0.9rem', marginBottom: '6px', color: isQualityLoading ? '#6b7280' : 'inherit' }}>Quality Score</div>
                        {isQualityLoading ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', margin: 'auto 0' }}>
                                <div className="qa-loading-spinner" style={{ width: '22px', height: '22px', borderWidth: '3px', borderColor: '#d1d5db', borderTopColor: '#3b82f6' }}></div>
                                <span style={{ fontSize: '0.9rem', color: '#6b7280', fontWeight: 600 }}>Calculating…</span>
                            </div>
                        ) : (
                            <>
                                <div className="qt-kpi-value" style={{ fontSize: '2.8rem', fontWeight: 700, margin: '2px 0', color: qualityColor }}>{qualityScore}</div>
                                <div className="qt-kpi-sub" style={{ fontSize: '0.8rem', marginTop: '2px', color: qualityColor }}>
                                    <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" style={{ marginRight: '4px' }}><polyline points="18 15 12 9 6 15" /></svg>
                                    {qualityScore >= 80 ? 'All indicators good' : qualityScore >= 60 ? 'Needs attention' : 'Critical issue'}
                                </div>
                            </>
                        )}
                    </div>

                    {/* 2. Risk Status */}
                    <div className="qt-kpi-card" style={{ 
                        minHeight: '116px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '1.2rem', alignItems: 'center',
                        background: riskBg, borderLeft: `4px solid ${riskColor}`, borderColor: riskColor
                    }}>
                        <div className="qt-kpi-label" style={{ fontSize: '0.9rem', alignSelf: 'flex-start', width: '100%' }}>Risk Status</div>
                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '6px 0', width: '100%' }}>
                            <svg width="112" height="56" viewBox="0 0 100 50" style={{ overflow: 'visible' }}>
                                <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="#e5e7eb" strokeWidth="12" strokeLinecap="round" />
                                <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke={riskColor} strokeWidth="12" strokeLinecap="round" strokeDasharray={isLowRisk ? '35 125.6' : '100 125.6'} />
                                <text x="50" y="45" textAnchor="middle" fontSize="14" fontWeight="bold" fill={riskColor}>{isLowRisk ? 'Low' : 'Elevated'}</text>
                            </svg>
                        </div>
                        <div className="qt-kpi-sub" style={{ fontSize: '0.8rem', alignSelf: 'flex-start', width: '100%', color: riskColor }}>
                            {(() => {
                                if (isLowRisk) return 'All parameters normal';
                                const alertsList = [];
                                if (tempViolations.length > 0) alertsList.push(`${tempViolations.length} temp`);
                                if (majorShocks.length > 0) alertsList.push(`${majorShocks.length} shock`);
                                if (weightLossPct && parseFloat(weightLossPct) > 2) alertsList.push('weight loss');
                                
                                return alertsList.length > 0 ? alertsList.join(' + ') : 'Low quality score';
                            })()}
                        </div>
                    </div>

                    {/* Separator */}
                    <div className="qt-kpi-sep" style={{ width: '1px', height: '70px', background: '#E2E8F0', margin: '0 4px' }}></div>

                    <div className="qt-kpi-card qt-kpi-warn" style={{ minHeight: '116px', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '1.2rem' }}>
                        <div className="qt-kpi-label" style={{ fontSize: '0.9rem', marginBottom: '6px' }}>Shock Events</div>
                        <div className="qt-kpi-value qt-orange" style={{ fontSize: '2.8rem', fontWeight: 700, margin: '2px 0' }}>{majorShocks.length + minorShocks.length}</div>
                        <div className="qt-kpi-sub qt-orange" style={{ fontSize: '0.8rem', marginTop: '2px' }}>
                            <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" style={{ marginRight: '4px' }}><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                            {majorShocks.length} Major + {minorShocks.length} Minor
                        </div>
                    </div>

                    {/* 4. Temp Compliance */}
                    <div className="qt-kpi-card qt-kpi-info" style={{ minHeight: '116px', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '1.2rem' }}>
                        <div className="qt-kpi-label" style={{ fontSize: '0.9rem', marginBottom: '6px' }}>Temp Compliance</div>
                        <div className="qt-kpi-value qt-blue" style={{ fontSize: '2.8rem', fontWeight: 700, margin: '2px 0' }}>{tempCompliance}%</div>
                        <div className="qt-kpi-sub qt-gray" style={{ fontSize: '0.8rem', marginTop: '2px' }}>Within safe range (≤ -18°C)</div>
                    </div>
                </div>

                {/* SCROLLABLE CONTENT */}
                <div className="qt-scroll-area">
                    <div className="qt-content-area">
                        {/* LEFT COLUMN */}
                        <div className="qt-col-left">
                            {/* Temperature Trend */}
                            <div className="qt-card" style={{ cursor: 'pointer' }} onClick={() => navigate(`/qa/graphs/${id}`)} title="Click for detailed charts">
                                <div className="qt-card-title">
                                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#6C5CE7" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '10px', verticalAlign: 'middle' }}>
                                        <path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z" />
                                    </svg>
                                    Temperature Trend <span style={{ fontSize: '10px', color: '#6C5CE7', fontWeight: 400 }}>→ View Details</span>
                                </div>
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
                                <div className="qt-card-title">
                                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#6C5CE7" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '10px', verticalAlign: 'middle' }}>
                                        <path d="M6 20h12l-2-10H8z" />
                                        <path d="M9 10V8a3 3 0 0 1 6 0v2" />
                                        <rect x="8" y="16" width="8" height="2" />
                                    </svg>
                                    Weight Comparison
                                </div>
                                <div style={{ padding: '26px 10px 8px' }}>
                                    <div className="qt-weight-track" style={{ background: '#F8FAFC' }}>
                                        <div className="qt-weight-arrow" style={{ background: `linear-gradient(90deg, #22c55e, ${weightHexColor})`, width: '44%' }}>
                                            <div style={{ position: 'absolute', right: '-5px', top: '-4px', width: 0, height: 0, borderLeft: `7px solid ${weightHexColor}`, borderTop: '4px solid transparent', borderBottom: '4px solid transparent' }}></div>
                                        </div>
                                        <div className="qt-weight-line qt-weight-loading" style={{ left: '28%' }}>
                                            <div className="qt-weight-line-bar" style={{ background: '#22c55e' }}></div>
                                            <div className="qt-weight-line-label" style={{ color: '#22c55e' }}>Loading</div>
                                        </div>
                                        <div className="qt-weight-line qt-weight-arrival" style={{ left: '72%' }}>
                                            <div className="qt-weight-line-bar" style={{ background: weightHexColor }}></div>
                                            <div className="qt-weight-line-label" style={{ color: weightHexColor }}>Arrival</div>
                                        </div>
                                    </div>
                                    <div className="qt-weight-values">
                                        <div>
                                            <span className="qt-weight-val" style={{ color: '#22c55e', fontSize: '11px', fontWeight: 600 }}>{startWeight ? `${startWeight} kg` : '--'}</span>
                                            <span className="qt-weight-val-label">At loading dock</span>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <span className="qt-weight-val" style={{ color: weightHexColor, fontSize: '11px', fontWeight: 600 }}>{endWeight ? `${endWeight} kg` : '--'}</span>
                                            <span className="qt-weight-val-label">At arrival</span>
                                        </div>
                                    </div>
                                </div>
                                {startWeight && endWeight && (
                                    <div className="qt-plain-summary" style={{ 
                                        background: '#F5F3FF', 
                                        border: '1px solid #DDD6FE', 
                                        borderLeft: `4px solid ${weightHexColor}`,
                                        color: '#4B3F94',
                                        padding: '10px 12px',
                                        borderRadius: '8px',
                                        fontSize: '11px',
                                        marginTop: '12px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px'
                                    }}>
                                        <span className="qt-ps-icon" style={{ fontSize: '16px' }}>{weightIcon}</span>
                                        <span>Cargo lost <strong style={{ color: weightHexColor, fontWeight: 700 }}>{weightLoss.toFixed(2)} kg ({weightLossPct}%)</strong> in transit — {(weightLossPct && parseFloat(weightLossPct) <= 2) ? 'within acceptable threshold' : 'exceeds acceptable threshold'}.</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* RIGHT COLUMN */}
                        <div className="qt-col-right">
                            {/* Shock & Movement */}
                            <div className="qt-card" style={{ cursor: 'pointer' }} onClick={() => navigate(`/qa/graphs/${id}`)} title="Click for detailed charts">
                                <div className="qt-card-title">
                                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#6C5CE7" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '10px', verticalAlign: 'middle' }}>
                                        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                                    </svg>
                                    Shock &amp; Movement <span style={{ fontSize: '10px', color: '#6C5CE7', fontWeight: 400 }}>→ View Details</span>
                                </div>
                                <div className="qt-chart-legend">
                                    <div className="qt-legend-item"><div className="qt-legend-dot" style={{ background: '#CA8A04' }}></div> Shocks</div>
                                    <div className="qt-legend-item"><div className="qt-legend-dot" style={{ background: '#FCD34D' }}></div> Vibrations</div>
                                </div>
                                <div className="qt-chart-wrap">
                                    <div className="qt-y-unit">g</div>
                                    <div className="qt-bar-chart" style={{ gap: '1px' }}>
                                        {(() => {
                                            if (motions.length === 0) return <div className="qt-no-data">No motion data</div>;
                                            const step = Math.ceil(motions.length / 64);
                                            const sampled = [];
                                            for (let i = 0; i < motions.length; i += step) {
                                                const chunk = motions.slice(i, i + step);
                                                const maxVal = Math.max(...chunk.map(m => m.max_accel || 0));
                                                sampled.push({ ...chunk[0], max_accel: maxVal });
                                            }
                                            const vals = sampled.map(m => m.max_accel || 0);
                                            const max = Math.max(...vals);
                                            const min = Math.min(...vals);
                                            const range = max - min || 1;

                                            return sampled.map((m, i) => {
                                                const val = m.max_accel || 0;
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
                                <div className="qt-card-title">
                                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#6C5CE7" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '10px', verticalAlign: 'middle' }}>
                                        <circle cx="12" cy="12" r="10" />
                                        <polyline points="12 6 12 12 16 14" />
                                    </svg>
                                    Trip Timeline &amp; Events <span style={{ fontSize: '10px', color: '#6C5CE7', fontWeight: 400 }}>→ View Full Timeline</span>
                                </div>
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
                                    <span className="qt-alert-sev-label" style={{ 
                                        color: alert.sev === 'crit' ? '#ef4444' : alert.sev === 'warn' ? '#f97316' : alert.sev === 'minor' ? '#eab308' : '#64748b',
                                        fontWeight: 800,
                                        fontSize: '10px',
                                        letterSpacing: '0.05em'
                                    }}>
                                        {alert.label}
                                    </span>
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
