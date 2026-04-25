import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { ChatbotProvider as Driver_ChatbotProvider, useChatbot } from './Driver_Chatbot/Driver_ChatbotContext';
import Driver_MrHodhaMaalu from './Driver_Chatbot/Driver_MrHodhaMaalu';
import DriverSidebar from './DriverSidebar';
import './driver.css';

const API_BASE = 'http://localhost:3001';

function DriverTemperatureContent() {
    const navigate = useNavigate();
    const [trips, setTrips] = useState([]);
    const [selectedTripId, setSelectedTripId] = useState('');
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

    // Fetch sensor data
    useEffect(() => {
        if (!selectedTripId) return;
        let isMounted = true;
        const fetchDetails = async () => {
            try {
                const { data } = await axios.get(`${API_BASE}/api/trips/${selectedTripId}/sensors`);
                if (isMounted) {
                    setTripDetails(data.trip || null);
                    setSensorData(data.sensorData || { temperature_data: [], motion_data: [] });
                }
            } catch (err) { console.error(err); }
        };
        fetchDetails();
        const interval = setInterval(fetchDetails, 3000);
        return () => { isMounted = false; clearInterval(interval); };
    }, [selectedTripId]);

    // Derived metrics
    const temps = sensorData?.temperature_data || [];
    const currentTemp = temps.length > 0 ? Number(temps[temps.length - 1].avg).toFixed(1) : '--';
    const allAvgs = temps.map(t => Number(t.avg));
    const minTemp = allAvgs.length > 0 ? Math.min(...allAvgs).toFixed(1) : '--';
    const maxTemp = allAvgs.length > 0 ? Math.max(...allAvgs).toFixed(1) : '--';
    const avgTemp = allAvgs.length > 0 ? (allAvgs.reduce((a, b) => a + b, 0) / allAvgs.length).toFixed(1) : '--';
    const dataPoints = temps.length;
    const isTempSafe = currentTemp !== '--' && Number(currentTemp) <= -18;

    // Last updated timestamp
    const lastUpdatedStr = sensorData?.last_updated
        ? new Date(sensorData.last_updated).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
        : '--';

    // Push live data to chatbot context
    useEffect(() => {
        if (!tripDetails || !sensorData) return;
        const tempData = sensorData.temperature_data || [];
        const motionData = sensorData.motion_data || [];
        const shockCount = motionData.filter(m => m.max_accel > 0.5).length;
        const currentTempVal = tempData.length > 0 ? Number(tempData[tempData.length - 1].avg) : null;
        const isSafe = currentTempVal !== null && currentTempVal <= -18;
        updateSnapshot({
            currentPage: 'Temperature Page',
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
    }, [tripDetails, sensorData, updateSnapshot]);

    // Gauge logic — range -30 to 0
    const gaugeMin = -30, gaugeMax = 0;
    const cx = 100, cy = 100, r = 84;
    const startDeg = 210, endDeg = 330, totalArc = endDeg - startDeg;
    const tempVal = currentTemp !== '--' ? Math.min(Math.max(Number(currentTemp), gaugeMin), gaugeMax) : gaugeMin;
    const fraction = (tempVal - gaugeMin) / (gaugeMax - gaugeMin);
    const needleDeg = startDeg + fraction * totalArc;
    const toRad = d => (d * Math.PI) / 180;
    const arcPath = (s, e, radius, color, w) => {
        const rs = toRad(s), re = toRad(e);
        const x1 = cx + radius * Math.cos(rs), y1 = cy + radius * Math.sin(rs);
        const x2 = cx + radius * Math.cos(re), y2 = cy + radius * Math.sin(re);
        const large = (e - s) > 180 ? 1 : 0;
        return <path key={`${s}-${e}`} d={`M ${x1} ${y1} A ${radius} ${radius} 0 ${large} 1 ${x2} ${y2}`} fill="none" stroke={color} strokeWidth={w} strokeLinecap="round" />;
    };
    const nr = toRad(needleDeg);
    const nx = cx + (r - 16) * Math.cos(nr);
    const ny = cy + (r - 16) * Math.sin(nr);

    // History chart — use last 7 readings (time stored as HH:MM string, use directly)
    const historyBars = temps.slice(-7).map((t) => {
    // History chart — use last 30 readings
    const historyBars = temps.slice(-30).map((t) => {
        const val = Number(t.avg);
        const isWarning = val > -18;
        const pct = Math.min(100, Math.max(10, ((val - gaugeMin) / (gaugeMax - gaugeMin)) * 100));
        return { pct, isWarning, time: t.time || '--:--', val };
    });


    return (
        <div className="driver-dashboard-wrapper">
            <div className="driver-phone-frame">
                <div className="driver-status-bar"></div>
                <div className="driver-screen">
                    <div className="driver-dynamic-island"></div>
                    <div className="driver-inner-scroll">

                        <DriverSidebar activeItem="temp" hasAlert={!isTempSafe} />

                        {/* MAIN CONTENT */}
                        <div className="driver-main-content">
                            {/* Page header */}
                            <div style={{ marginBottom: '14px' }}>
                                <div className="driver-header-subtitle">Driver</div>
                                <div className="driver-header-title">Temperature</div>
                            </div>

                            {/* Monitoring Header Card */}
                            <div className="driver-card">
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                                        <div className="driver-avatar" style={{ width: '34px', height: '34px', flexShrink: 0, marginTop: '2px' }}>
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="#7a5c3a"><circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" /></svg>
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '15px', fontWeight: 700, color: '#1c1c1e', lineHeight: 1.2 }}>Temperature<br />Monitoring</div>
                                            <div style={{ fontSize: '9.5px', color: '#8e8e93', marginTop: '3px', lineHeight: 1.4 }}>Live sensor data<br />&amp; analytics</div>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px', minWidth: 0, flexShrink: 1 }}>
                                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#8e8e93" strokeWidth="2"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
                                            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#8e8e93" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>
                                        </div>
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
                                </div>
                            </div>

                            {/* Current Temperature Card */}
                            <div className="driver-card">
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#1c1c1e' }}>Current Temperature</span>
                                    <div className={`dt-temp-badge ${isTempSafe ? 'safe' : 'danger'}`}>
                                        {isTempSafe
                                            ? <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#30d158" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                                            : <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#ff3b30" strokeWidth="2.5"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                                        }
                                        <span>{isTempSafe ? 'Optimal' : 'Alert'}</span>
                                    </div>
                                </div>
                                <div style={{ fontSize: '9.5px', color: '#8e8e93', marginBottom: '14px' }}>Last updated: {lastUpdatedStr}</div>

                                {/* Arc Gauge */}
                                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '4px' }}>
                                    <svg width="200" height="116" viewBox="0 0 200 116">
                                        {/* Background track */}
                                        {arcPath(startDeg, endDeg, r, '#ebebeb', 14)}
                                        {/* Green: -30 to -18 */}
                                        {arcPath(startDeg, startDeg + ((-18 - gaugeMin) / (gaugeMax - gaugeMin)) * totalArc, r, '#30d158', 14)}
                                        {/* Light green: -18 to -12 */}
                                        {arcPath(startDeg + ((-18 - gaugeMin) / (gaugeMax - gaugeMin)) * totalArc, startDeg + ((-12 - gaugeMin) / (gaugeMax - gaugeMin)) * totalArc, r, '#86d158', 14)}
                                        {/* Yellow: -12 to -6 */}
                                        {arcPath(startDeg + ((-12 - gaugeMin) / (gaugeMax - gaugeMin)) * totalArc, startDeg + ((-6 - gaugeMin) / (gaugeMax - gaugeMin)) * totalArc, r, '#ffd60a', 14)}
                                        {/* Orange: -6 to -2 */}
                                        {arcPath(startDeg + ((-6 - gaugeMin) / (gaugeMax - gaugeMin)) * totalArc, startDeg + ((-2 - gaugeMin) / (gaugeMax - gaugeMin)) * totalArc, r, '#ff9f0a', 14)}
                                        {/* Red: -2 to 0 */}
                                        {arcPath(startDeg + ((-2 - gaugeMin) / (gaugeMax - gaugeMin)) * totalArc, endDeg, r, '#ff3b30', 14)}
                                        {/* Needle */}
                                        <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="#1c1c1e" strokeWidth="3" strokeLinecap="round" />
                                        <circle cx={cx} cy={cy} r="7" fill="#1c1c1e" />
                                        <circle cx={cx} cy={cy} r="3.5" fill="#ffffff" />
                                    </svg>
                                </div>

                                <div style={{ textAlign: 'center', marginBottom: '4px' }}>
                                    <span style={{ fontSize: '42px', fontWeight: 800, color: '#1c1c1e', letterSpacing: '-2px', lineHeight: 1 }}>
                                        {currentTemp !== '--' ? currentTemp : '--'}
                                    </span>
                                    <span style={{ fontSize: '24px', fontWeight: 700, color: '#1c1c1e' }}>°C</span>
                                </div>
                                <div style={{ textAlign: 'center', fontSize: '10.5px', color: '#8e8e93', marginBottom: '18px' }}>Safe Range: −30°C – −18°C</div>

                                {/* 4 stat mini-cards */}
                                <div className="dt-stats-grid">
                                    <div className="dt-stat-card">
                                        <div className="dt-stat-label">
                                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#4a4aff" strokeWidth="2" strokeLinecap="round"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" /></svg>
                                            <span>Avg Temp</span>
                                        </div>
                                        <div className="dt-stat-value">{avgTemp !== '--' ? `${avgTemp}°C` : '--'}</div>
                                    </div>
                                    <div className="dt-stat-card">
                                        <div className="dt-stat-label">
                                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#30d158" strokeWidth="2" strokeLinecap="round">
                                                <circle cx="12" cy="12" r="10" /><polyline points="12,6 12,12 16,14" />
                                            </svg>
                                            <span>Data Points</span>
                                        </div>
                                        <div className="dt-stat-value">{dataPoints}</div>
                                    </div>
                                    <div className="dt-stat-card">
                                        <div className="dt-stat-label">
                                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#4a4aff" strokeWidth="2.5" strokeLinecap="round">
                                                <line x1="12" y1="4" x2="12" y2="20" /><polyline points="6 14 12 20 18 14" />
                                            </svg>
                                            <span>Min Temp</span>
                                        </div>
                                        <div className="dt-stat-value">{minTemp !== '--' ? `${minTemp}°C` : '--'}</div>
                                    </div>
                                    <div className="dt-stat-card">
                                        <div className="dt-stat-label">
                                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#ff3b30" strokeWidth="2.5" strokeLinecap="round">
                                                <line x1="12" y1="20" x2="12" y2="4" /><polyline points="6 10 12 4 18 10" />
                                            </svg>
                                            <span>Max Temp</span>
                                        </div>
                                        <div className="dt-stat-value">{maxTemp !== '--' ? `${maxTemp}°C` : '--'}</div>
                                    </div>
                                </div>
                            </div>

                            {/* Temperature History Card */}
                            <div className="driver-card">
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
                                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#1c1c1e', lineHeight: 1.4 }}>Temperature<br />History</span>
                                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginTop: '2px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#30d158' }}></div>
                                            <span style={{ fontSize: '9px', color: '#8e8e93' }}>Optimal</span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ff9f0a' }}></div>
                                            <span style={{ fontSize: '9px', color: '#8e8e93' }}>Warning</span>
                                        </div>
                                    </div>
                                </div>

                                <div style={{ position: 'relative' }}>
                                    {/* Safe range dashed line */}
                                    <div style={{ position: 'absolute', top: '12px', left: 0, right: 0, borderTop: '1.5px dashed #c8e6c9', zIndex: 1 }}></div>
                                    {/* Bars (or empty state) */}
                                    {historyBars.length > 0 ? (
                                        <>
                                            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', height: '80px', padding: '0 2px', position: 'relative', zIndex: 2, marginBottom: '8px' }}>
                                                {historyBars.map((bar, i) => (
                                                    <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: '100%' }}>
                                                        <div style={{
                                                            width: '100%',
                                                            height: `${bar.pct}%`,
                                                            background: bar.isWarning
                                                                ? 'linear-gradient(to top, #e67e22, #ff9f0a)'
                                                                : 'linear-gradient(to top, #1db954, #4ade80)',
                                                            borderRadius: '5px 5px 0 0',
                                                            transition: 'height 0.4s ease'
                                                        }}></div>
                                            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', height: '80px', padding: '0 2px', position: 'relative', zIndex: 2, marginBottom: '8px' }}>
                                                {historyBars.map((bar, i) => (
                                                    <div key={i} style={{ width: '3px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: '100%' }}>
                                                        {bar.isWarning ? (
                                                            <div style={{
                                                                width: '100%',
                                                                height: `${bar.pct}%`,
                                                                background: bar.val > -10 
                                                                    ? 'linear-gradient(to top, #ff9f0a, #ff3b30)' 
                                                                    : 'linear-gradient(to top, #ffd60a, #ff9f0a)',
                                                                borderRadius: '2px 2px 0 0',
                                                                transition: 'height 0.4s ease'
                                                            }}></div>
                                                        ) : null}
                                                    </div>
                                                ))}
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 2px' }}>
                                                {historyBars.map((bar, i) => (
                                                    <span key={i} style={{ fontSize: '8px', color: '#8e8e93' }}>{bar.time}</span>
                                                ))}
                                                <span style={{ fontSize: '9px', color: '#8e8e93', fontWeight: 600 }}>START</span>
                                                <span style={{ fontSize: '9px', color: '#8e8e93', fontWeight: 600 }}>END</span>
                                            </div>
                                        </>
                                    ) : (
                                        <div style={{ height: '88px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '6px', color: '#aaa' }}>
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="2"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" /></svg>
                                            <span style={{ fontSize: '10px' }}>No temperature data yet</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                        </div>
                        {/* END MAIN CONTENT */}
                    </div>
                </div>
            </div>
            <Driver_MrHodhaMaalu />
        </div>
    );
}

export default function DriverTemperature() {
    return (
        <Driver_ChatbotProvider>
            <DriverTemperatureContent />
        </Driver_ChatbotProvider>
    );
}
