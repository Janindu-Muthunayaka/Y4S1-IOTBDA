import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { ChatbotProvider as Driver_ChatbotProvider, useChatbot } from './Driver_Chatbot/Driver_ChatbotContext';
import Driver_MrHodhaMaalu from './Driver_Chatbot/Driver_MrHodhaMaalu';
import DriverSidebar from './DriverSidebar';
import './driver.css';

const API_BASE = 'http://localhost:3001';

function DriverNotificationsContent() {
    const navigate = useNavigate();
    const [trips, setTrips] = useState([]);
    const [selectedTripId, setSelectedTripId] = useState('');
    const [sensorData, setSensorData] = useState(null);
    const [tripDetails, setTripDetails] = useState(null);
    const [lastUpdate, setLastUpdate] = useState(0);
    const { updateSnapshot } = useChatbot();

    // Fetch trips
    useEffect(() => {
        const fetch = async () => {
            try {
                const { data } = await axios.get(`${API_BASE}/api/trips`);
                if (Array.isArray(data)) {
                    setTrips(data);
                    if (data.length > 0) setSelectedTripId(p => p || data[0].trip_id);
                }
            } catch (e) { console.error(e); }
        };
        fetch();
        const id = setInterval(fetch, 5000);
        return () => clearInterval(id);
    }, []);

    // Fetch sensor + trip detail
    useEffect(() => {
        if (!selectedTripId) return;
        let alive = true;
        const fetch = async () => {
            try {
                const { data } = await axios.get(`${API_BASE}/api/trips/${selectedTripId}/sensors`);
                if (alive) {
                    setSensorData(data.sensorData || { temperature_data: [], motion_data: [] });
                    setTripDetails(data.trip || null);
                    setLastUpdate(Date.now());
                }
            } catch (e) { console.error(e); }
        };
        fetch();
        const id = setInterval(fetch, 3000);
        return () => { alive = false; clearInterval(id); };
    }, [selectedTripId]);

    // Derived alert conditions
    const temps = sensorData?.temperature_data || [];
    const motions = sensorData?.motion_data || [];
    const currentTemp = temps.length > 0 ? Number(temps[temps.length - 1].avg) : null;
    const isTempAlert = currentTemp !== null && currentTemp > -18;
    const shockEvents = motions.filter(m => m.max_accel > 0.5);
    const isShockAlert = shockEvents.length > 0;
    const w1 = tripDetails?.startWeight ?? tripDetails?.start_weight ?? tripDetails?.weight ?? null;
    const w2 = tripDetails?.endWeight ?? tripDetails?.end_weight ?? null;
    const isWeightAlert = w1 !== null && w2 !== null && Math.abs(Number(w1) - Number(w2)) > 50;

    // Build live alert feed from real data
    const alerts = [];
    if (isTempAlert) alerts.push({
        type: 'critical',
        icon: 'temp',
        title: 'Temperature Alert',
        desc: `Freezer at ${currentTemp?.toFixed(1)}°C — above safe range. Immediate cooling check recommended.`,
        tag: 'Critical',
        tagColor: '#ff3b30',
        borderColor: '#ff3b30',
        time: 'Now',
    });
    if (isShockAlert) alerts.push({
        type: 'warning',
        icon: 'shock',
        title: 'Shock Events Detected',
        desc: `${shockEvents.length} vibration spike${shockEvents.length > 1 ? 's' : ''} recorded. ${shockEvents.filter(s => s.harsh_event).length > 0 ? 'Harsh braking included.' : ''}`,
        tag: 'Warning',
        tagColor: '#ff9500',
        borderColor: '#ff9500',
        time: 'Just now',
    });
    if (isWeightAlert) alerts.push({
        type: 'warning',
        icon: 'cargo',
        title: 'Cargo Weight Shift',
        desc: `Weight delta of ${Math.abs(Number(w1) - Number(w2)).toFixed(0)} kg exceeds normal threshold. Check load stability.`,
        tag: 'Warning',
        tagColor: '#ff9500',
        borderColor: '#ff9500',
        time: '22s ago',
    });
    if (alerts.length === 0) alerts.push({
        type: 'ok',
        icon: 'ok',
        title: 'All systems normal',
        desc: 'No active alerts. Temperature, shock, and cargo status are all within safe limits.',
        tag: 'OK',
        tagColor: '#30d158',
        borderColor: '#30d158',
        time: 'Now',
    });

    const criticalCount = alerts.filter(a => a.type === 'critical').length;
    const secondsSinceUpdate = Math.round((Date.now() - lastUpdate) / 1000);

    // Push live data to chatbot context
    useEffect(() => {
        if (!tripDetails || !sensorData) return;
        const tempData = sensorData.temperature_data || [];
        const motionData = sensorData.motion_data || [];
        const currentTempVal = tempData.length > 0 ? Number(tempData[tempData.length - 1].avg) : null;
        const isSafe = currentTempVal !== null && currentTempVal <= -18;
        updateSnapshot({
            currentPage: 'Notifications Page',
            trip: tripDetails,
            sensorData,
            kpis: {
                qualityScore: 100 - (shockEvents.length * 2),
                tempCompliance: isSafe ? 100 : (currentTempVal === null ? 100 : 0),
                shocks: motionData.filter(m => m.max_accel > 0.5),
                cold: tempData.filter(t => Number(t.avg) < -22),
                hot: tempData.filter(t => Number(t.avg) > -18),
            }
        });
    }, [tripDetails, sensorData, updateSnapshot]);


    // Alert icon renderer
    const AlertIcon = ({ type }) => {
        if (type === 'temp') return (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ff3b30" strokeWidth="2" strokeLinecap="round">
                <path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z" />
            </svg>
        );
        if (type === 'shock') return (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ff9500" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="2 12 6 12 8 4 10 20 13 10 15 14 17 12 22 12" />
            </svg>
        );
        if (type === 'cargo') return (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ff9500" strokeWidth="2">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                <polyline points="3.27 6.96 12 12.01 20.73 6.96" strokeLinecap="round" />
            </svg>
        );
        return (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#30d158" strokeWidth="2">
                <circle cx="12" cy="12" r="10" /><path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
        );
    };

    const iconBg = { critical: '#fff0f0', warning: '#fff8ed', ok: '#f0fff4' };

    return (
        <div className="driver-dashboard-wrapper">
            <div className="driver-phone-frame">
                {/* Empty status bar */}
                <div className="driver-status-bar"></div>
                <div className="driver-screen">
                    <div className="driver-dynamic-island"></div>
                    <div className="driver-inner-scroll">

                        <DriverSidebar activeItem="notif" hasAlert={criticalCount > 0} />

                        {/* MAIN CONTENT */}
                        <div className="driver-main-content">

                            {/* Page Header */}
                            <div style={{ marginBottom: '12px' }}>
                                <div className="driver-header-subtitle">Driver</div>
                                <div className="driver-header-title">Notifications</div>
                            </div>

                            {/* ── Header card ── */}
                            <div className="driver-card" style={{ marginBottom: '12px' }}>
                                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
                                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                                        <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'linear-gradient(135deg,#6c63ff,#4a4aff)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="4" fill="#fff" /><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" fill="#fff" /></svg>
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '14px', fontWeight: 800, color: '#111', lineHeight: 1.2 }}>Alerts &amp;<br />Notifications</div>
                                            <div style={{ fontSize: '10px', color: '#aaa', marginTop: '4px', lineHeight: 1.4 }}>Realtime warnings for safe cargo monitoring</div>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px', flexShrink: 0 }}>
                                        <div style={{ display: 'flex', gap: '6px' }}>
                                            <div className="dn-icon-btn">
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M9 18l-6-6 6-6" stroke="#888" strokeWidth="2.5" strokeLinecap="round" /></svg>
                                            </div>
                                            <div className="dn-icon-btn">
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><line x1="4" y1="6" x2="20" y2="6" stroke="#888" strokeWidth="2" strokeLinecap="round" /><line x1="4" y1="12" x2="20" y2="12" stroke="#888" strokeWidth="2" strokeLinecap="round" /><line x1="4" y1="18" x2="14" y2="18" stroke="#888" strokeWidth="2" strokeLinecap="round" /></svg>
                                            </div>
                                        </div>
                                        {criticalCount > 0 ? (
                                            <div className="dn-critical-pill">
                                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" fill="#fff" /><line x1="12" y1="9" x2="12" y2="13" stroke="#ff3b30" strokeWidth="2" strokeLinecap="round" /><circle cx="12" cy="17" r="1" fill="#ff3b30" /></svg>
                                                <span>{criticalCount} critical now</span>
                                            </div>
                                        ) : (
                                            <div className="dn-ok-pill">
                                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" fill="#fff" fillOpacity="0.4" /><path d="M9 12l2 2 4-4" stroke="#fff" strokeWidth="2" strokeLinecap="round" /></svg>
                                                <span>All clear</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* ── Stats card ── */}
                            <div className="driver-card" style={{ marginBottom: '12px' }}>
                                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: '16px', fontWeight: 800, color: '#111', lineHeight: 1.2, letterSpacing: '-0.3px' }}>
                                            {criticalCount > 0 ? 'Critical alerts\nfirst' : 'All systems\nnormal'}
                                        </div>
                                        <div style={{ fontSize: '11px', color: '#aaa', marginTop: '6px', lineHeight: 1.5 }}>
                                            {criticalCount > 0
                                                ? 'Cargo conditions need attention. Updates refresh in realtime.'
                                                : 'Temperature, shock, and cargo all within safe parameters.'}
                                        </div>
                                    </div>
                                    <div className={`dn-priority-pill ${criticalCount > 0 ? 'critical' : 'ok'}`}>
                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" fill="#fff" fillOpacity="0.3" /><path d="M12 8v5" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" /><circle cx="12" cy="17" r="1.2" fill="#fff" /></svg>
                                        <span>{criticalCount > 0 ? 'Priority' : 'Normal'}</span>
                                    </div>
                                </div>

                                <div className="dn-stats-grid">
                                    <div className="dn-stat-box">
                                        <div className="dn-stat-label">
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="#ff3b30" strokeWidth="2" /><path d="M12 8v4m0 4h.01" stroke="#ff3b30" strokeWidth="2" strokeLinecap="round" /></svg>
                                            <span>Active critical</span>
                                        </div>
                                        <div className="dn-stat-value">{criticalCount}</div>
                                    </div>
                                    <div className="dn-stat-box">
                                        <div className="dn-stat-label">
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="#aaa" strokeWidth="2" /><polyline points="12,6 12,12 16,14" stroke="#aaa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                                            <span>Last update</span>
                                        </div>
                                        <div className="dn-stat-value">{lastUpdate > 0 ? `${secondsSinceUpdate}s` : '--'}</div>
                                    </div>
                                </div>
                            </div>

                            {/* ── Live Alert Feed ── */}
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px', padding: '0 2px' }}>
                                    <div style={{ fontSize: '14px', fontWeight: 700, color: '#111' }}>Live alert feed</div>
                                    <div style={{ fontSize: '11px', color: '#aaa' }}>{alerts.length} alert{alerts.length !== 1 ? 's' : ''} visible</div>
                                </div>

                                {alerts.map((alert, i) => (
                                    <div key={i} className="dn-alert-card" style={{ borderLeftColor: alert.borderColor, marginBottom: i < alerts.length - 1 ? '10px' : '20px' }}>
                                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                                            <div className="dn-alert-icon" style={{ background: iconBg[alert.type] || '#f5f6fa' }}>
                                                <AlertIcon type={alert.icon} />
                                            </div>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '150px' }}>
                                                        {alert.title}
                                                    </div>
                                                    <div style={{ fontSize: '11px', color: '#aaa', flexShrink: 0 }}>{alert.time}</div>
                                                </div>
                                                <div style={{ fontSize: '11px', color: '#555', marginTop: '4px', lineHeight: 1.5 }}>{alert.desc}</div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '8px', flexWrap: 'wrap' }}>
                                                    <div style={{ background: alert.tagColor, borderRadius: '6px', padding: '3px 8px' }}>
                                                        <span style={{ fontSize: '10px', fontWeight: 700, color: '#fff' }}>{alert.tag}</span>
                                                    </div>
                                                    <div style={{ background: '#f0f0f0', borderRadius: '6px', padding: '3px 8px' }}>
                                                        <span style={{ fontSize: '10px', color: '#666', fontWeight: 600 }}>
                                                            Trip #{selectedTripId?.slice(-8) || '--'}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
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

export default function DriverNotifications() {
    return (
        <Driver_ChatbotProvider>
            <DriverNotificationsContent />
        </Driver_ChatbotProvider>
    );
}
