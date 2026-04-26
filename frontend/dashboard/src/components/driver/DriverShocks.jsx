import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { ChatbotProvider as Driver_ChatbotProvider, useChatbot } from './Driver_Chatbot/Driver_ChatbotContext';
import Driver_MrHodhaMaalu from './Driver_Chatbot/Driver_MrHodhaMaalu';
import DriverSidebar from './DriverSidebar';
import './driver.css';

const API_BASE = 'http://localhost:3001';

function DriverShocksContent() {
    const navigate = useNavigate();
    const [trips, setTrips] = useState([]);
    const [selectedTripId, setSelectedTripId] = useState(localStorage.getItem('driverSelectedTripId') || '');

    useEffect(() => {
        if (selectedTripId) localStorage.setItem('driverSelectedTripId', selectedTripId);
    }, [selectedTripId]);
    const [sensorData, setSensorData] = useState(null);
    const [tripDetails, setTripDetails] = useState(null);
    const { updateSnapshot } = useChatbot();

    // Fetch trips
    useEffect(() => {
        const fetchTrips = async () => {
            try {
                const { data } = await axios.get(`${API_BASE}/api/trips`);
                if (Array.isArray(data)) {
                    setTrips(data);
                    if (data.length > 0) setSelectedTripId(p => p || data[0].trip_id);
                }
            } catch (err) { console.error(err); }
        };
        fetchTrips();
        const id = setInterval(fetchTrips, 5000);
        return () => clearInterval(id);
    }, []);

    // Fetch sensor data
    useEffect(() => {
        if (!selectedTripId) return;
        let alive = true;
        const fetch = async () => {
            try {
                const { data } = await axios.get(`${API_BASE}/api/trips/${selectedTripId}/sensors`);
                if (alive) {
                    setTripDetails(data.trip || null);
                    setSensorData(data.sensorData || { temperature_data: [], motion_data: [] });
                }
            } catch (err) { console.error(err); }
        };
        fetch();
        const id = setInterval(fetch, 3000);
        return () => { alive = false; clearInterval(id); };
    }, [selectedTripId]);

    // Derived shock metrics
    const motions = sensorData?.motion_data || [];
    const shockEvents = motions.filter(m => m.max_accel > 0.5);
    const shockCount = shockEvents.length;
    const maxAccel = motions.length > 0 ? Math.max(...motions.map(m => Number(m.max_accel))).toFixed(2) : '--';
    const harshEvents = motions.filter(m => m.harsh_event);
    const isNormal = shockCount === 0;
    const peakLabel = maxAccel === '--' ? '--' : Number(maxAccel) < 0.5 ? 'Low' : Number(maxAccel) < 1.0 ? 'Medium' : 'High';
    const peakColor = peakLabel === 'Low' ? '#30d158' : peakLabel === 'Medium' ? '#ffcc00' : '#ff3b30';

    // History bars — last 60 motion readings (Filter to show only high-vibration)
    const historyBars = motions.slice(-60).map(m => {
        const val = Number(m.max_accel);
        const isWarning = val > 0.5;
        // Only show significant vibration (> 0.15G) 
        // Increased height: scaled relative to 1.0G max for larger visual impact
        const pct = val > 0.15 ? Math.min(100, (val / 1.0) * 100) : 0;
        return { pct, isWarning, val };
    });

    // Push live data to chatbot context
    useEffect(() => {
        if (!tripDetails || !sensorData) return;
        const tempData = sensorData.temperature_data || [];
        const motionData = sensorData.motion_data || [];
        const currentTempVal = tempData.length > 0 ? Number(tempData[tempData.length - 1].avg) : null;
        const isSafe = currentTempVal !== null && currentTempVal <= -18;
        updateSnapshot({
            currentPage: 'Shocks Page',
            trip: tripDetails,
            sensorData,
            kpis: {
                qualityScore: 100 - (shockCount * 2),
                tempCompliance: isSafe ? 100 : (currentTempVal === null ? 100 : 0),
                shocks: motionData.filter(m => m.max_accel > 0.5),
                cold: tempData.filter(t => Number(t.avg) < -22),
                hot: tempData.filter(t => Number(t.avg) > -18),
            }
        });
    }, [tripDetails, sensorData, shockCount, updateSnapshot]);


    return (
        <div className="driver-dashboard-wrapper">
            <div className="driver-phone-frame">
                {/* Empty status bar — no text */}
                <div className="driver-status-bar"></div>
                <div className="driver-screen">
                    <div className="driver-dynamic-island"></div>
                    <div className="driver-inner-scroll">

                        <DriverSidebar activeItem="shocks" hasAlert={shockCount > 0} />

                        {/* MAIN CONTENT */}
                        <div className="driver-main-content">

                            {/* Page Header */}
                            <div style={{ marginBottom: '12px' }}>
                                <div className="driver-header-subtitle">Driver</div>
                                <div className="driver-header-title">Shock details</div>
                            </div>

                            {/* ── Shock Status Card ── */}
                            <div className="driver-card ds-status-card">
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <div className="ds-icon-box" style={{ background: '#f0f0ff' }}>
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4a4aff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                <polyline points="2 12 6 12 8 4 10 20 13 10 15 14 17 12 22 12" />
                                            </svg>
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '14px', fontWeight: 700, color: '#111' }}>Shock Status</div>
                                            <div style={{ fontSize: '11px', color: '#999', marginTop: '1px' }}>Live vibration monitoring</div>
                                        </div>
                                    </div>
                                    {/* Trip selector */}
                                    <select
                                        className="dt-sensor-select"
                                        value={selectedTripId}
                                        onChange={e => setSelectedTripId(e.target.value)}
                                    >
                                        {trips.length > 0 ? trips.map(t => (
                                            <option key={t.trip_id} value={t.trip_id}>#{t.trip_id?.slice(-8) ?? t.trip_id}</option>
                                        )) : <option value="">No Trips</option>}
                                    </select>
                                </div>

                                {/* Current Level */}
                                <div style={{ marginTop: '14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <div>
                                        <div className="ds-label-upper">Current level</div>
                                        <div style={{ fontSize: '26px', fontWeight: 900, color: isNormal ? '#30d158' : '#ff3b30', letterSpacing: '-0.5px', lineHeight: 1.1, marginTop: '2px' }}>
                                            {isNormal ? 'NORMAL' : 'ALERT'}
                                        </div>
                                        <div style={{ fontSize: '11px', color: '#999', marginTop: '4px' }}>
                                            {isNormal ? 'Stable ride — no shock events' : `${shockCount} shock event${shockCount > 1 ? 's' : ''} detected`}
                                        </div>
                                    </div>
                                    <div className="ds-icon-box" style={{ width: '44px', height: '44px', borderRadius: '12px', background: isNormal ? '#f0fff4' : '#fff0f0' }}>
                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={isNormal ? '#30d158' : '#ff3b30'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                            <polyline points="2 12 6 12 8 4 10 20 13 10 15 14 17 12 22 12" />
                                        </svg>
                                    </div>
                                </div>

                                {/* Status badge */}
                                <div className={`ds-status-badge ${isNormal ? 'safe' : 'danger'}`}>
                                    {isNormal
                                        ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" fill="#30d158" /><path d="M9 12l2 2 4-4" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                                        : <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" fill="#ff3b30" /><line x1="12" y1="8" x2="12" y2="12" stroke="#fff" strokeWidth="2" strokeLinecap="round" /><line x1="12" y1="16" x2="12.01" y2="16" stroke="#fff" strokeWidth="2" strokeLinecap="round" /></svg>
                                    }
                                    <span>{isNormal ? 'No critical shock detected' : `${harshEvents.length} harsh event${harshEvents.length !== 1 ? 's' : ''} recorded`}</span>
                                </div>
                            </div>

                            {/* ── Shock Trend Chart (Enhanced with Peak Marker) ── */}
                            <div className="driver-card">
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
                                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#1c1c1e', lineHeight: 1.4 }}>Shock<br />Trend (Live)</span>
                                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginTop: '2px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#30d158' }}></div>
                                            <span style={{ fontSize: '9px', color: '#8e8e93' }}>Stable</span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ff3b30' }}></div>
                                            <span style={{ fontSize: '9px', color: '#8e8e93' }}>Shock</span>
                                        </div>
                                    </div>
                                </div>

                                <div style={{ position: 'relative', height: '110px' }}>
                                    {/* 0.5G threshold line (Safety benchmark) */}
                                    <div style={{ position: 'absolute', top: '42px', left: 0, right: 0, borderTop: '1.5px dashed rgba(255, 59, 48, 0.15)', zIndex: 1 }}></div>

                                    {historyBars.length > 0 ? (
                                        <>
                                            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', height: '80px', padding: '0 2px', position: 'relative', zIndex: 2, marginBottom: '8px' }}>
                                                {historyBars.map((bar, i) => (
                                                    <div key={i} style={{ width: '3px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: '100%' }}>
                                                        <div style={{
                                                            width: '100%',
                                                            height: `${bar.pct}%`,
                                                            background: bar.isWarning 
                                                                ? 'linear-gradient(to top, #ff9f0a, #ff3b30)' 
                                                                : 'linear-gradient(to top, #30d158, #86d158)',
                                                            borderRadius: '2px 2px 0 0',
                                                            transition: 'height 0.4s ease'
                                                        }}></div>
                                                    </div>
                                                ))}
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '0 2px' }}>
                                                <span style={{ fontSize: '9px', color: '#8e8e93', fontWeight: 600 }}>LIVE</span>
                                            </div>
                                        </>
                                    ) : (
                                        <div style={{ height: '88px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '6px', color: '#aaa' }}>
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="2"><polyline points="2 12 6 12 8 4 10 20 13 10 15 14 17 12 22 12" /></svg>
                                            <span style={{ fontSize: '10px' }}>No shock data yet</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* ── Peak Impact & Road Condition ── */}
                            <div className="driver-flex-row" style={{ marginBottom: '12px' }}>
                                <div className="ds-mini-card">
                                    <div className="ds-label-upper">Peak Impact</div>
                                    <div style={{ fontSize: '22px', fontWeight: 900, color: '#111', letterSpacing: '-0.5px', marginTop: '4px' }}>{peakLabel}</div>
                                    <div style={{ fontSize: '11px', color: peakColor, fontWeight: 600, marginTop: '4px' }}>
                                        {peakLabel === 'Low' ? 'Within safe limit' : peakLabel === 'Medium' ? 'Monitor closely' : 'Exceeds limit'}
                                    </div>
                                </div>
                                <div className="ds-mini-card">
                                    <div className="ds-label-upper">Road condition</div>
                                    <div style={{ fontSize: '22px', fontWeight: 900, color: '#111', letterSpacing: '-0.5px', marginTop: '4px' }}>
                                        {isNormal ? 'Stable' : 'Rough'}
                                    </div>
                                    <div style={{ fontSize: '11px', color: '#999', marginTop: '4px' }}>
                                        {isNormal ? 'No rough segment now' : 'Vibration detected'}
                                    </div>
                                </div>
                            </div>

                            {/* ── Recent Shock Events ── */}
                            <div className="driver-card" style={{ marginBottom: '20px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                                    <div style={{ fontSize: '14px', fontWeight: 700, color: '#111' }}>Recent shock events</div>
                                    <div style={{ fontSize: '11px', color: '#aaa' }}>Today</div>
                                </div>

                                {/* Dynamic events from API */}
                                {shockEvents.slice(-3).reverse().map((ev, i) => (
                                    <div key={i} className="ds-event-row" style={{ borderBottom: i < Math.min(shockEvents.length, 3) - 1 ? '1px solid #f5f5f5' : 'none' }}>
                                        <div className="ds-event-icon" style={{ background: '#fff8e1' }}>
                                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                                                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" fill="#ffcc00" />
                                                <line x1="12" y1="9" x2="12" y2="13" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
                                                <line x1="12" y1="17" x2="12.01" y2="17" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
                                            </svg>
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontSize: '12px', fontWeight: 700, color: '#111' }}>Shock event detected</div>
                                            <div style={{ fontSize: '11px', color: '#aaa', marginTop: '2px' }}>
                                                Max accel: {Number(ev.max_accel).toFixed(2)}g
                                                {ev.harsh_event ? ' — Harsh braking' : ''}
                                            </div>
                                        </div>
                                        <div style={{ fontSize: '11px', color: '#aaa', whiteSpace: 'nowrap', flexShrink: 0 }}>
                                            {ev.time || '--:--'}
                                        </div>
                                    </div>
                                ))}

                                {/* Always show "Sensor feed active" */}
                                <div className="ds-event-row" style={{ borderBottom: shockEvents.length > 0 ? 'none' : undefined }}>
                                    <div className="ds-event-icon" style={{ background: '#f0f0ff' }}>
                                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#4a4aff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                            <polyline points="2 12 6 12 8 4 10 20 13 10 15 14 17 12 22 12" />
                                        </svg>
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: '12px', fontWeight: 700, color: '#111' }}>Sensor feed active</div>
                                        <div style={{ fontSize: '11px', color: '#aaa', marginTop: '2px' }}>Shock stream synced with cargo monitor.</div>
                                    </div>
                                    <div style={{ fontSize: '11px', color: '#aaa', whiteSpace: 'nowrap', flexShrink: 0 }}>Live</div>
                                </div>

                                {/* Stable ride row — shown when no shocks */}
                                {isNormal && (
                                    <div className="ds-event-row" style={{ borderTop: '1px solid #f5f5f5', borderBottom: 'none' }}>
                                        <div className="ds-event-icon" style={{ background: '#f0fff4' }}>
                                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" fill="#30d158" /><path d="M9 12l2 2 4-4" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontSize: '12px', fontWeight: 700, color: '#111' }}>Stable ride maintained</div>
                                            <div style={{ fontSize: '11px', color: '#aaa', marginTop: '2px' }}>No vibration spikes in the latest route segment.</div>
                                        </div>
                                        <div style={{ fontSize: '11px', color: '#aaa', whiteSpace: 'nowrap', flexShrink: 0 }}>Now</div>
                                    </div>
                                )}
                            </div>

                        </div>
                        {/* END MAIN CONTENT */}
                    </div>
                    {/* Integrated Chatbot inside phone screen */}
                    <Driver_MrHodhaMaalu />
                </div>
            </div>
        </div>
    );
}

export default function DriverShocks() {
    return (
        <Driver_ChatbotProvider>
            <DriverShocksContent />
        </Driver_ChatbotProvider>
    );
}
