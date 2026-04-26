import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { ChatbotProvider as Driver_ChatbotProvider, useChatbot } from './Driver_Chatbot/Driver_ChatbotContext';
import Driver_MrHodhaMaalu from './Driver_Chatbot/Driver_MrHodhaMaalu';
import DriverSidebar from './DriverSidebar';
import './driver.css';

const API_BASE = 'http://localhost:3001';

function DriverDashboardContent() {
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

    // Fetch sensors
    useEffect(() => {
        if (!selectedTripId) return;
        let isMounted = true;
        const fetchDetails = async () => {
            try {
                const { data } = await axios.get(`${API_BASE}/api/trips/${selectedTripId}/sensors`);
                if (isMounted) {
                    setTripDetails(data.trip);
                    setSensorData(data.sensorData || { temperature_data: [], motion_data: [] });
                }
            } catch (err) { console.error(err); }
        };
        fetchDetails();
        const interval = setInterval(fetchDetails, 3000);
        return () => { isMounted = false; clearInterval(interval); };
    }, [selectedTripId]);

    // Metric Calculations
    let currentTemp = '--';
    let tempStatus = 'Waiting for data';
    let isTempSafe = true;
    let shockEventsCount = 0;
    let maxRecordedTemp = undefined;

    if (sensorData) {
        const temps = sensorData.temperature_data || [];
        const motions = sensorData.motion_data || [];

        if (temps.length > 0) {
            currentTemp = Number(temps[temps.length - 1].avg).toFixed(1);
            // Sync with -18 to -20 safe range
            isTempSafe = Number(currentTemp) <= -18 && Number(currentTemp) >= -20;
            tempStatus = isTempSafe ? 'Within Safe Range' : 'Temperature Alert';
            maxRecordedTemp = Math.max(...temps.map(t => Number(t.max))).toFixed(1);
        }

        shockEventsCount = motions.filter(m => m.max_accel > 0.5).length;
    }

    const shockLabel = shockEventsCount === 0 ? 'NORMAL' : 'WARNING';
    const shockDesc = shockEventsCount === 0 ? 'Smooth Driving' : `${shockEventsCount} Events`;

    // Weights
    const w1 = tripDetails?.startWeight ?? tripDetails?.start_weight ?? tripDetails?.weight ?? '--';
    const w2 = tripDetails?.endWeight ?? tripDetails?.end_weight ?? '--';

    // Formatter
    const fmtT = (d) => d ? new Date(d).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '--:--';

    const isOutbound = tripDetails?.trip_type === 'OUTGOING';
    const step1Label = "Left Warehouse";
    const step2Label = isOutbound ? "At Retailer" : "At Supplier";
    const step3Label = "Entered Warehouse";

    const routeText = isOutbound ? 'Warehouse → Retailer' : 'Supplier → Warehouse';

    const time1 = fmtT(tripDetails?.timestamp);
    const tempsArr = sensorData?.temperature_data || [];
    const time2 = tempsArr.length > 0 ? (isOutbound ? tempsArr[tempsArr.length - 1].time : tempsArr[0].time) : '--:--';
    const time3 = tripDetails?.status === 'Complete' ? fmtT(sensorData?.last_updated || tripDetails?.updatedAt) : '--:--';

    // State Change Logic
    const stateHistory = tripDetails?.stateChange || [];

    // Push data to chatbot
    useEffect(() => {
        if (tripDetails && sensorData) {
            updateSnapshot({
                currentPage: 'Main Dashboard',
                trip: tripDetails,
                sensorData: sensorData,
                kpis: {
                    qualityScore: 100 - (shockEventsCount * 2),
                    tempCompliance: isTempSafe ? 100 : 0,
                    shocks: sensorData.motion_data.filter(m => m.max_accel > 0.5),
                    cold: sensorData.temperature_data.filter(t => Number(t.avg) < -20),
                    hot: sensorData.temperature_data.filter(t => Number(t.avg) > -18)
                }
            });
        }
    }, [tripDetails, sensorData, shockEventsCount, isTempSafe, updateSnapshot]);

    return (
        <div className="driver-dashboard-wrapper">
            <div className="driver-phone-frame">
                <div className="driver-status-bar"></div>
                <div className="driver-screen">
                    <div className="driver-dynamic-island"></div>
                    <div className="driver-inner-scroll">
                        {/* LEFT SIDEBAR NAV */}
                        <DriverSidebar activeItem="dashboard" hasAlert={!isTempSafe || shockEventsCount > 0} />

                        {/* MAIN CONTENT */}
                        <div className="driver-main-content">
                            <div className="driver-header-title">Driver dashboard</div>

                            {/* Compact Trip Selector Card */}
                            <div className="driver-card" style={{ padding: '10px 15px', marginBottom: '15px' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <div style={{ fontSize: '14px', fontWeight: 700, color: '#1c1c1e' }}>Select Trip</div>
                                    <select
                                        className="driver-dropdown"
                                        style={{ width: '100%' }}
                                        value={selectedTripId}
                                        onChange={(e) => setSelectedTripId(e.target.value)}
                                    >
                                        {trips.length > 0 ? trips.map(t => (
                                            <option key={t.trip_id} value={t.trip_id}>
                                                Trip #{t.trip_id}
                                            </option>
                                        )) : (
                                            <option value="">No Trips</option>
                                        )}
                                    </select>
                                </div>
                            </div>

                            {/* Trip Status Card */}
                            <div className="driver-card">
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                                    <span style={{ fontSize: '15px', fontWeight: 700, color: '#1c1c1e' }}>{tripDetails?.truck_id || '----'}</span>
                                    <div className={`driver-trip-badge ${tripDetails?.status === 'Complete' ? 'completed' : ''}`}>
                                        {tripDetails?.status === 'Complete' ? (
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#30d158" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                                        ) : (
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#f0a500" strokeWidth="2.5"><rect x="1" y="3" width="15" height="13" rx="2" /><path d="M16 8h4l3 3v5h-7V8z" /><circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" /></svg>
                                        )}
                                        <span className="driver-trip-badge-text">{tripDetails?.status || 'In Transit'}</span>
                                    </div>
                                </div>
                                <div style={{ fontSize: '11px', color: '#8e8e93', marginBottom: '14px' }}>{routeText}</div>

                                {/* Progress Steps */}
                                <div className="driver-progress-container">
                                    {stateHistory.map((state, idx, arr) => (
                                        <React.Fragment key={idx}>
                                            <div className="driver-step" style={{ minWidth: 'auto', flex: 1 }}>
                                                <div className="driver-step-circle done" title={fmtT(state.timestamp)}>
                                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
                                                </div>
                                                <span className="driver-step-text done" style={{ fontSize: '9px', textAlign: 'center', marginTop: '4px' }}>{state.status}</span>
                                            </div>
                                            {idx < arr.length - 1 && <div className="driver-step-line done" style={{ minWidth: '15px' }}></div>}
                                        </React.Fragment>
                                    ))}
                                    {stateHistory.length === 0 && (
                                        <div style={{ fontSize: '11px', color: '#8e8e93', fontStyle: 'italic', textAlign: 'center', width: '100%' }}>No tracking history available</div>
                                    )}
                                </div>
                            </div>

                            {/* Real-Time Conditions */}
                            <div style={{ marginBottom: '8px' }}>
                                <div className="driver-section-title">Real-Time Conditions</div>
                                <div className="driver-flex-row">

                                    {/* Temperature */}
                                    <div
                                        className="driver-condition-card"
                                        onClick={() => navigate('/driver/temperature')}
                                        style={{ cursor: 'pointer' }}
                                    >
                                        <div className="driver-condition-title">Current Temperature</div>
                                        {/* Clean Arc Gauge */}
                                        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '4px' }}>
                                            {(() => {
                                                const cx = 60, cy = 56, r = 44;
                                                // Range: -30°C (safe) to 0°C (danger)
                                                const minTemp = -30, maxTemp = 0;
                                                const tempVal = currentTemp !== '--' ? Math.min(Math.max(Number(currentTemp), minTemp), maxTemp) : minTemp;
                                                // Angle from 210° (left) to 330° (right) = 120° sweep, clockwise
                                                const startAngleDeg = 210;
                                                const endAngleDeg = 330;
                                                const totalArc = endAngleDeg - startAngleDeg;
                                                const fraction = (tempVal - minTemp) / (maxTemp - minTemp);
                                                const needleAngleDeg = startAngleDeg + fraction * totalArc;
                                                const toRad = (d) => (d * Math.PI) / 180;
                                                // Arc path helper
                                                const arcPath = (startDeg, endDeg, radius, color, width) => {
                                                    const s = toRad(startDeg);
                                                    const e = toRad(endDeg);
                                                    const x1 = cx + radius * Math.cos(s);
                                                    const y1 = cy + radius * Math.sin(s);
                                                    const x2 = cx + radius * Math.cos(e);
                                                    const y2 = cy + radius * Math.sin(e);
                                                    const largeArc = (endDeg - startDeg) > 180 ? 1 : 0;
                                                    return <path d={`M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" />;
                                                };
                                                // Needle
                                                const needleRad = toRad(needleAngleDeg);
                                                const needleLen = r - 8;
                                                const nx = cx + needleLen * Math.cos(needleRad);
                                                const ny = cy + needleLen * Math.sin(needleRad);
                                                return (
                                                    <svg width="120" height="74" viewBox="0 0 120 74">
                                                        {/* Background track */}
                                                        {arcPath(210, 330, r, '#ebebeb', 9)}
                                                        {/* Green zone: -30 to -18 */}
                                                        {arcPath(210, 210 + ((-18 - minTemp) / (maxTemp - minTemp)) * totalArc, r, '#30d158', 9)}
                                                        {/* Yellow zone: -18 to -10 */}
                                                        {arcPath(210 + ((-18 - minTemp) / (maxTemp - minTemp)) * totalArc, 210 + ((-10 - minTemp) / (maxTemp - minTemp)) * totalArc, r, '#ffd60a', 9)}
                                                        {/* Red zone: -10 to 0 */}
                                                        {arcPath(210 + ((-10 - minTemp) / (maxTemp - minTemp)) * totalArc, 330, r, '#ff3b30', 9)}
                                                        {/* Needle */}
                                                        <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="#1c1c1e" strokeWidth="2.5" strokeLinecap="round" />
                                                        {/* Center cap */}
                                                        <circle cx={cx} cy={cy} r="5" fill="#1c1c1e" />
                                                        <circle cx={cx} cy={cy} r="2.5" fill="#ffffff" />
                                                    </svg>
                                                );
                                            })()}
                                        </div>
                                        <div style={{ textAlign: 'center', fontSize: '18px', fontWeight: 700, color: '#1c1c1e' }}>
                                            {currentTemp !== '--' ? `${currentTemp}°C` : '--'}
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', marginTop: '6px' }}>
                                            {isTempSafe ? (
                                                <>
                                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#30d158" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                                                    <span style={{ fontSize: '10px', color: '#30d158', fontWeight: 600 }}>{tempStatus}</span>
                                                </>
                                            ) : (
                                                <>
                                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#ff3b30" strokeWidth="2.5"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                                                    <span style={{ fontSize: '10px', color: '#ff3b30', fontWeight: 600 }}>{tempStatus}</span>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    {/* Shock Level */}
                                    <div
                                        className="driver-condition-card"
                                        onClick={() => navigate('/driver/shocks')}
                                        style={{ cursor: 'pointer' }}
                                    >
                                        <div className="driver-condition-title">Shock Level</div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '8px' }}>
                                            <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: shockEventsCount === 0 ? '#e8faf0' : '#fff3cd', border: `2px solid ${shockEventsCount === 0 ? '#30d158' : '#f0a500'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                {shockEventsCount === 0 ? (
                                                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#30d158" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
                                                ) : (
                                                    <span style={{ color: '#f0a500', fontSize: '10px', fontWeight: 'bold' }}>!</span>
                                                )}
                                            </div>
                                            <div>
                                                <div style={{ fontSize: '12px', fontWeight: 700, color: shockEventsCount === 0 ? '#30d158' : '#f0a500' }}>{shockLabel}</div>
                                                <div style={{ fontSize: '9px', color: '#8e8e93' }}>{shockDesc}</div>
                                            </div>
                                        </div>
                                        {/* Mini bar chart */}
                                        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height: '36px', padding: '0 2px' }}>
                                            {[40, 55, 30, 70, 45, 60, 35].map((h, i) => (
                                                <div key={i} style={{ flex: 1, background: `linear-gradient(to top, ${shockEventsCount > 0 && i % 2 === 0 ? '#f0a500, #fcd34d' : '#30d158, #86efac'})`, borderRadius: '3px 3px 0 0', height: `${h}%` }}></div>
                                            ))}
                                        </div>
                                        <div style={{ fontSize: '9px', color: '#8e8e93', marginTop: '4px', textAlign: 'right' }}>15/30 min</div>
                                    </div>

                                </div>
                            </div>

                            {/* Cargo Status */}
                            <div style={{ marginBottom: '12px' }}>
                                <div className="driver-section-title">Cargo Status</div>
                                <div className="driver-flex-row">

                                    {/* Cargo Weight */}
                                    <div className="driver-condition-card" style={{ flex: 1 }}>
                                        <div className="driver-condition-title">Cargo Weight</div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                            <span style={{ fontSize: '10px', color: '#8e8e93' }}>Current:</span>
                                            <span style={{ fontSize: '10px', fontWeight: 700, color: '#1c1c1e' }}>{w2} kg</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                                            <span style={{ fontSize: '10px', color: '#8e8e93' }}>Expected:</span>
                                            <span style={{ fontSize: '10px', fontWeight: 700, color: '#1c1c1e' }}>{w1} kg</span>
                                        </div>
                                        <div style={{ background: '#e8faf0', borderRadius: '20px', padding: '5px 10px', display: 'flex', alignItems: 'center', gap: '5px', justifyContent: 'center' }}>
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#30d158" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                                            <span style={{ fontSize: '11px', color: '#30d158', fontWeight: 600 }}>Cargo Secure</span>
                                        </div>
                                    </div>

                                </div>
                            </div>

                            {/* Alerts */}
                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                    <div className="driver-section-title" style={{ marginBottom: 0 }}>Alerts</div>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8e8e93" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
                                </div>

                                {!isTempSafe && (
                                    <div className="driver-alert-warning">
                                        <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontSize: '12px', fontWeight: 600, color: '#1c1c1e' }}>Temperature Anomaly</div>
                                            <div style={{ fontSize: '10px', color: '#8e8e93' }}>Exceeding safe limits</div>
                                        </div>
                                    </div>
                                )}

                                {shockEventsCount > 0 && (
                                    <div className="driver-alert-warning">
                                        <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#fff3cd', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#f0a500" strokeWidth="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontSize: '12px', fontWeight: 600, color: '#1c1c1e' }}>Harsh braking detected</div>
                                            <div style={{ fontSize: '10px', color: '#8e8e93' }}>Reduce speed - {shockEventsCount} events</div>
                                        </div>
                                    </div>
                                )}

                                {isTempSafe && shockEventsCount === 0 && (
                                    <div className="driver-alert-success">
                                        <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#e8faf0', border: '2px solid #30d158', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#30d158" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                                        </div>
                                        <span style={{ fontSize: '12px', color: '#1c1c1e', flex: 1 }}>Freezer temperature stable</span>
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8e8e93" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                    {/* Integrated Chatbot inside phone screen */}
                    <Driver_MrHodhaMaalu />
                </div>
            </div>
        </div>
    );
}

export default function DriverDashboard() {
    return (
        <Driver_ChatbotProvider>
            <DriverDashboardContent />
        </Driver_ChatbotProvider>
    );
}
