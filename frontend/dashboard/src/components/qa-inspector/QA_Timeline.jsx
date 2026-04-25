import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import QASidebar from './QASidebar';
import { useChatbot } from './Chatbot/ChatbotContext';
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
    const { updateSnapshot } = useChatbot();

    // Helpers
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

    // ── Update Chatbot Snapshot ──
    useEffect(() => {
        if (tripDetails && sensorData) {
            updateSnapshot({
                trip: tripDetails,
                sensorData: sensorData,
                kpis: {
                    qualityScore,
                    tempCompliance,
                    cold: tempViolationsCold,
                    hot: tempViolationsHot,
                    shocks: shockEvents
                }
            });
        }
    }, [tripDetails, sensorData, qualityScore, tempCompliance, updateSnapshot]);

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

    // ── Build normalized events with smart fallback positioning ──
    const buildSnakeEvents = () => {
        const tripStartMs = new Date(trip.timestamp || Date.now()).getTime();
        const tripEndMs = trip.status === 'COMPLETED'
            ? new Date(trip.updatedAt || trip.timestamp || Date.now()).getTime()
            : Date.now();
        const totalMs = Math.max(60000, tripEndMs - tripStartMs);

        // Parse a "HH:MM AM/PM" string into ms-since-midnight
        const parseTimeStrMs = (str) => {
            if (!str) return null;
            const m = str.match(/(\d+):(\d+)\s*(AM|PM)/i);
            if (!m) return null;
            let h = parseInt(m[1]);
            const min = parseInt(m[2]);
            const ampm = m[3].toUpperCase();
            if (ampm === 'PM' && h !== 12) h += 12;
            if (ampm === 'AM' && h === 12) h = 0;
            return h * 3600000 + min * 60000;
        };

        const startMsOfDay = parseTimeStrMs(new Date(tripStartMs).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }));

        // Get a 0-1 position for an event; falls back to even distribution
        const getPos = (rawTime, timeStr, fallbackIdx, total) => {
            // Try rawTime if it's a real timestamp inside the trip window
            if (rawTime && rawTime > tripStartMs && rawTime <= tripEndMs) {
                return Math.min(0.98, (rawTime - tripStartMs) / totalMs);
            }
            // Try to parse the time string
            if (timeStr && startMsOfDay !== null) {
                const evMs = parseTimeStrMs(timeStr);
                if (evMs !== null) {
                    const diff = evMs - startMsOfDay;
                    if (diff > 0 && diff < totalMs) {
                        return Math.min(0.98, diff / totalMs);
                    }
                }
            }
            // Spread evenly from 5% to 95% of the trip
            const spread = total > 1 ? (fallbackIdx / (total - 1)) : 0.5;
            return 0.05 + spread * 0.9;
        };

        const allEventSets = [
            ...tempViolationsCold.map(t => ({ item: t, type: 'cold', label: `Low Temp: ${parseFloat(t.avg).toFixed(1)}°C`, time: t.time || '--:--' })),
            ...tempViolationsHot.map(t => ({ item: t, type: 'hot', label: `High Temp: ${parseFloat(t.avg).toFixed(1)}°C`, time: t.time || '--:--' })),
            ...shockEvents.map(m => ({ item: m, type: 'shock', label: `Shock: ${parseFloat(m.max_accel).toFixed(2)}G`, time: m.time || '--:--' })),
            ...vibrationEvents.map(m => ({ item: m, type: 'vib', label: `Vib: ${parseFloat(m.max_accel).toFixed(2)} m/s²`, time: m.time || '--:--' })),
        ];

        return allEventSets
            .map((ev, idx) => ({
                type: ev.type,
                label: ev.label,
                time: ev.time,
                pos: getPos(ev.item.rawTime, ev.time, idx, allEventSets.length),
            }))
            .sort((a, b) => a.pos - b.pos);
    };

    const snakeEvents = buildSnakeEvents();

    const getEventColor = (type) => {
        switch (type) {
            case 'shock': return '#b45309';
            case 'cold':  return '#3b82f6';
            case 'hot':   return '#ef4444';
            case 'vib':   return '#d97706';
            default:      return '#9ca3af';
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
    const tripStatus = (trip.status || '').toUpperCase();
    const arrivalRaw = trip.endTime || trip.end_time || trip.updatedAt || trip.updated_at || sensorData?.last_updated;
    const arrivalTimeStr = (tripStatus === 'ACTIVE' || !tripStatus) 
        ? 'In Transit' 
        : (arrivalRaw ? fmtTime(arrivalRaw) : '--:--');

    // ── CSS snake helpers ──────────────────────────────────────────────────
    const ROW_DIRS = ['ltr', 'rtl', 'ltr', 'rtl'];

    // Which row (0-3) does this event belong to?
    const getRowIndex = (pos) => Math.min(3, Math.floor(Math.max(0, pos) * 4));

    // left% for a ball within its track div
    const getEventLeftPct = (pos) => {
        const seg = getRowIndex(pos);
        const dir = ROW_DIRS[seg];
        const progress = Math.min(1, (pos * 4) - seg); // 0-1 within the row
        return dir === 'ltr' ? progress * 100 : (1 - progress) * 100;
    };

    const getRowEvents = (rowIndex) =>
        snakeEvents.filter(ev => getRowIndex(ev.pos) === rowIndex);

    return (
        <div className="qa-root">
            <QASidebar activeTab="timeline" tripId={id} />

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
                    <span>🚛 Truck: <strong>{trip.truck_id || '--'}</strong></span>
                    <span>🕐 Trip Start: <strong>{departureTimeStr}</strong></span>
                    <span>🏁 Trip End: <strong>{arrivalTimeStr}</strong></span>
                    <span style={{ marginLeft: 'auto', color: '#64748b' }}>Synced: {lastSynced}</span>
                </div>

                <div className="qa-content" style={{ padding: '16px 20px', overflowY: 'auto', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', width: '100%' }}>

                        {/* KPI Row */}
                        <div className="tl-kpi-row">
                            <div className="tl-kpi-card tl-kpi-blue">
                                <div className="tl-kpi-title">Shock Events</div>
                                <div className="tl-kpi-value tl-val-orange">{shockEvents.length}</div>
                                <div className="tl-kpi-subtitle" style={{ color: '#f59e0b' }}>during transit</div>
                                <div className="tl-kpi-details">Peak: <span className="bold">{peakShock} G</span> · Avg: <span className="bold">{avgShock} G</span></div>
                            </div>
                            <div className="tl-kpi-card tl-kpi-blue">
                                <div className="tl-kpi-title">Cold Events</div>
                                <div className="tl-kpi-value tl-val-blue">{tempViolationsCold.length}</div>
                                <div className="tl-kpi-subtitle" style={{ color: '#3b82f6' }}>below -22°C</div>
                                <div className="tl-kpi-details">Min: <span className="bold">{coldMin}°C</span></div>
                            </div>
                            <div className="tl-kpi-card tl-kpi-red">
                                <div className="tl-kpi-title">Hot Events</div>
                                <div className="tl-kpi-value tl-val-red">{tempViolationsHot.length}</div>
                                <div className="tl-kpi-subtitle" style={{ color: '#ef4444' }}>above -18°C</div>
                                <div className="tl-kpi-details">Peak: <span className="bold">{hotPeak}°C</span></div>
                            </div>
                            <div className="tl-kpi-card tl-kpi-yellow">
                                <div className="tl-kpi-title">Vibration</div>
                                <div className="tl-kpi-value tl-val-yellow">{vibrationEvents.length}</div>
                                <div className="tl-kpi-subtitle" style={{ color: '#eab308' }}>moderate</div>
                                <div className="tl-kpi-details">Peak: <span className="bold">{peakVib} m/s²</span></div>
                            </div>
                            <div className="tl-kpi-card tl-kpi-green">
                                <div className="tl-kpi-title">Quality Score</div>
                                <div className="tl-kpi-value tl-val-green">{qualityScore}<span className="tl-small">/100</span></div>
                                <div style={{ fontSize: '12px', fontWeight: 600, color: isLowRisk ? '#22c55e' : '#f59e0b' }}>
                                    {isLowRisk ? '▲ Good' : '▼ Attention'}
                                </div>
                                <div className="tl-kpi-details">Compliance: <span style={{ color: '#22c55e', fontWeight: 700 }}>{tempCompliance}%</span></div>
                            </div>
                        </div>

                        {/* ── CSS Snake Timeline ── */}
                        <div className="tl-timeline-card">
                            <div className="tl-timeline-header">
                                <div>
                                    <div className="tl-timeline-title">Trip Journey Map</div>
                                    <div className="tl-timeline-subtitle">{departureTimeStr} → {arrivalTimeStr} · {trip.truck_id || '--'}</div>
                                </div>
                                <div className="tl-legend">
                                    <div className="tl-legend-item"><div className="tl-legend-dot" style={{ background: '#ef4444' }}></div> Hot</div>
                                    <div className="tl-legend-item"><div className="tl-legend-dot" style={{ background: '#3b82f6' }}></div> Cold</div>
                                    <div className="tl-legend-item"><div className="tl-legend-dot" style={{ background: '#d97706' }}></div> Vibration</div>
                                    <div className="tl-legend-item"><div className="tl-legend-dot" style={{ background: '#b45309' }}></div> Shock</div>
                                </div>
                            </div>

                            {/* The snake body */}
                            <div className="sn-wrap">
                                {ROW_DIRS.map((dir, rowIdx) => {
                                    const rowEvents = getRowEvents(rowIdx);
                                    const isFirst = rowIdx === 0;
                                    const isLast  = rowIdx === 3;
                                    // Connector side: after LTR rows→ right, after RTL rows→ left
                                    const connSide = dir === 'ltr' ? 'right' : 'left';

                                    return (
                                        <div key={rowIdx} className="sn-row">
                                            {/* Horizontal track */}
                                            <div className="sn-track">

                                                {/* START anchor ball — left of row 0 */}
                                                {isFirst && (
                                                    <div className="sn-anchor" style={{ left: 0 }}>
                                                        <span className="sn-anchor-label sn-anchor-above">▲ Trip Start: {departureTimeStr}</span>
                                                    </div>
                                                )}

                                                {/* END anchor ball — left of row 3 (RTL ends at left) */}
                                                {isLast && (
                                                    <div className="sn-anchor" style={{ left: 0 }}>
                                                        <span className="sn-anchor-label sn-anchor-below">
                                                            ▼ Trip End: {arrivalTimeStr}
                                                        </span>
                                                    </div>
                                                )}

                                                {/* Arrowheads at 25%, 50%, 75% */}
                                                {[25, 50, 75].map(pct => (
                                                    <div
                                                        key={pct}
                                                        className={dir === 'ltr' ? 'sn-arrow sn-arrow-r' : 'sn-arrow sn-arrow-l'}
                                                        style={{ left: `${pct}%` }}
                                                    />
                                                ))}

                                                {/* Event balls */}
                                                {rowEvents.map((ev, i) => {
                                                    const leftPct = getEventLeftPct(ev.pos);
                                                    const above = i % 2 === 0;
                                                    return (
                                                        <div
                                                            key={i}
                                                            className="sn-event"
                                                            style={{ left: `${leftPct}%`, background: getEventColor(ev.type) }}
                                                        >
                                                            <span className={`sn-event-tip ${above ? 'sn-tip-above' : 'sn-tip-below'}`}>
                                                                {ev.time} · {ev.label}
                                                            </span>
                                                        </div>
                                                    );
                                                })}
                                            </div>

                                            {/* Vertical L-connector (not on last row) */}
                                            {!isLast && (
                                                <div className={`sn-connector sn-conn-${connSide}`} />
                                            )}
                                        </div>
                                    );
                                })}

                                {snakeEvents.length === 0 && (
                                    <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: '13px', padding: '20px 0 0' }}>
                                        ✅ No sensor alerts — clean run!
                                    </p>
                                )}
                            </div>
                        </div>

                    </div>
                </div>
            </main>
        </div>
    );
}

