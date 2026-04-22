import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { ChatbotProvider as Driver_ChatbotProvider, useChatbot } from './Driver_Chatbot/Driver_ChatbotContext';
import Driver_MrHodhaMaalu from './Driver_Chatbot/Driver_MrHodhaMaalu';

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
    
    if (sensorData) {
        const temps = sensorData.temperature_data || [];
        const motions = sensorData.motion_data || [];
        
        if (temps.length > 0) {
            currentTemp = Number(temps[temps.length - 1].avg).toFixed(1);
            isTempSafe = currentTemp <= -18;
            tempStatus = isTempSafe ? 'Within Safe Range' : 'Temperature Alert';
        }
        
        shockEventsCount = motions.filter(m => m.max_accel > 0.5).length;
    }

    const shockLabel = shockEventsCount === 0 ? 'NORMAL' : 'WARNING';
    const shockDesc = shockEventsCount === 0 ? 'Smooth Driving' : `${shockEventsCount} Events`;
    
    // Weights
    const w1 = tripDetails?.weight1 ?? tripDetails?.start_weight ?? tripDetails?.weight ?? '--';
    const w2 = tripDetails?.weight2 ?? tripDetails?.end_weight ?? '--';

    // Formatter
    const fmtT = (d) => d ? new Date(d).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '--:--';

    const isOutbound = tripDetails?.trip_direction === 'OUTBOUND';
    const step1Label = "Left Warehouse";
    const step2Label = isOutbound ? "At Customer" : "At Supplier";
    const step3Label = "Entered Warehouse";

    const time1 = fmtT(tripDetails?.timestamp);
    const tempsArr = sensorData?.temperature_data || [];
    const time2 = tempsArr.length > 0 ? (isOutbound ? tempsArr[tempsArr.length - 1].time : tempsArr[0].time) : '--:--';
    const time3 = tripDetails?.status === 'COMPLETED' ? fmtT(sensorData?.last_updated || tripDetails?.updatedAt) : '--:--';

    // Push data to chatbot
    useEffect(() => {
        if (tripDetails && sensorData) {
            updateSnapshot({
                trip: tripDetails,
                sensorData: sensorData,
                kpis: {
                    qualityScore: 100 - (shockEventsCount * 2), // Simplified for driver
                    tempCompliance: isTempSafe ? 100 : 0,
                    shocks: sensorData.motion_data.filter(m => m.max_accel > 0.5),
                    cold: sensorData.temperature_data.filter(t => Number(t.avg) < -22),
                    hot: sensorData.temperature_data.filter(t => Number(t.avg) > -18)
                }
            });
        }
    }, [tripDetails, sensorData, shockEventsCount, isTempSafe, updateSnapshot]);

    return (
        <div style={{ 
            width: '100%', 
            maxWidth: '480px', 
            margin: '0 auto', 
            background: 'var(--bg-dark)', 
            minHeight: '100vh', 
            display: 'flex', 
            flexDirection: 'column', 
            color: 'var(--text-primary)',
            fontFamily: 'Inter, sans-serif'
        }}>
            
            {/* Header */}
            <div style={{ padding: '2rem 1.5rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div 
                        onClick={() => navigate('/')} 
                        style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'center', alignItems: 'center', cursor: 'pointer', border: '1px solid var(--border-color)' }}
                    >
                        ←
                    </div>
                    <div>
                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', fontWeight: 500 }}>Driver Mode</div>
                        <div style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: '0.25rem' }}>Dashboard</div>
                    </div>
                </div>
                <select 
                    className="glass-card" 
                    style={{ padding: '0.5rem', color: 'var(--text-primary)', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', outline: 'none', borderRadius: '8px' }}
                    value={selectedTripId}
                    onChange={(e) => setSelectedTripId(e.target.value)}
                >
                    {trips.map(t => (
                        <option key={t.trip_id} value={t.trip_id} style={{ background: 'var(--bg-dark)' }}>
                            Trip #{t.trip_id}
                        </option>
                    ))}
                </select>
            </div>

            {/* Main Content Scroll Area */}
            <div style={{ flex: 1, padding: '0 1.5rem 2rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', overflowY: 'auto' }}>
                
                {/* Trip Card */}
                <div className="glass-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                            <div style={{ fontSize: '1.125rem', fontWeight: 600 }}>{tripDetails?.truck_id || '----'}</div>
                            <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginTop: '0.25rem' }}>{tripDetails?.trip_direction || 'Location Unknown'}</div>
                        </div>
                        <div style={{ 
                            padding: '0.25rem 0.75rem', 
                            background: tripDetails?.status === 'ACTIVE' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(148, 163, 184, 0.2)', 
                            color: tripDetails?.status === 'ACTIVE' ? 'var(--success)' : 'var(--text-secondary)', 
                            borderRadius: '999px', fontSize: '0.75rem', fontWeight: 600 
                        }}>
                            {tripDetails?.status || '--'}
                        </div>
                    </div>

                    {/* Progress Timeline placeholder */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', position: 'relative', marginTop: '1rem' }}>
                        <div style={{ position: 'absolute', top: '10px', left: '10%', right: '10%', height: '2px', background: 'var(--border-color)', zIndex: 0 }}></div>
                        
                        <div style={{ zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                            <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: 'var(--accent-cyan)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                                <div style={{ width: '8px', height: '8px', background: 'var(--bg-dark)', borderRadius: '50%' }}></div>
                            </div>
                            <div style={{ fontSize: '0.65rem', color: 'var(--text-primary)', fontWeight: 600 }}>{step1Label}</div>
                            <div style={{ fontSize: '0.6rem', color: 'var(--text-secondary)' }}>{time1}</div>
                        </div>
                        
                        <div style={{ zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                            <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: tripDetails?.status === 'ACTIVE' ? 'var(--accent-cyan)' : 'var(--border-color)', border: '4px solid var(--bg-dark)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}></div>
                            <div style={{ fontSize: '0.65rem', color: tripDetails?.status === 'ACTIVE' ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: 600 }}>{step2Label}</div>
                            <div style={{ fontSize: '0.6rem', color: 'var(--text-secondary)' }}>{time2}</div>
                        </div>
                        
                        <div style={{ zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                            <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: tripDetails?.status === 'COMPLETED' ? 'var(--success)' : 'var(--bg-dark)', border: '2px solid var(--border-color)' }}></div>
                            <div style={{ fontSize: '0.65rem', color: tripDetails?.status === 'COMPLETED' ? 'var(--success)' : 'var(--text-secondary)', fontWeight: 600 }}>{step3Label}</div>
                            <div style={{ fontSize: '0.6rem', color: 'var(--text-secondary)' }}>{time3}</div>
                        </div>
                    </div>
                </div>

                {/* Real-Time Conditions Section */}
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>Real-Time Conditions</div>
                    
                    <div className="glass-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Current Temperature</div>
                            <div style={{ fontSize: '2rem', fontWeight: 700, color: isTempSafe ? 'var(--text-primary)' : 'var(--danger)' }}>
                                {currentTemp !== '--' ? `${currentTemp}°C` : '--'}
                            </div>
                        </div>
                        <div style={{ 
                            padding: '0.5rem 1rem', 
                            background: isTempSafe ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)', 
                            borderRadius: '12px',
                            color: isTempSafe ? 'var(--success)' : 'var(--danger)',
                            fontSize: '0.75rem',
                            fontWeight: 600
                        }}>
                            {tempStatus}
                        </div>
                    </div>

                    <div className="glass-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Shock Level</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: shockEventsCount === 0 ? 'var(--success)' : 'var(--danger)' }}>{shockLabel}</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{shockDesc}</div>
                            </div>
                        </div>
                        {/* Decorative bar chart for shock */}
                        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height: '30px' }}>
                            {[2, 4, 3, 7, 5, 2, 4].map((h, i) => (
                                <div key={i} style={{ width: '6px', height: `${h * 4}px`, background: shockEventsCount > 0 && h > 5 ? 'var(--danger)' : 'var(--success)', opacity: 0.8, borderRadius: '2px' }}></div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Cargo Status */}
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>Cargo Status</div>
                    
                    <div className="glass-card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Cargo Weight</div>
                        
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>Start (Loading):</div>
                            <div style={{ fontWeight: 700, fontSize: '0.875rem' }}>{w1} kg</div>
                        </div>
                        
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>Expected (Current):</div>
                            <div style={{ fontWeight: 700, fontSize: '0.875rem' }}>{w2} kg</div>
                        </div>

                        <div style={{ 
                            marginTop: '0.5rem', padding: '0.5rem', 
                            background: 'rgba(16, 185, 129, 0.15)', 
                            borderRadius: '8px', textAlign: 'center', 
                            color: 'var(--success)', fontSize: '0.75rem', fontWeight: 600 
                        }}>
                            ✓ Cargo Secure
                        </div>
                    </div>
                    
                    <div className="glass-card" style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ padding: '0.5rem', background: 'rgba(16, 185, 129, 0.2)', borderRadius: '50%', color: 'var(--success)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>✓</div>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>RFID Status</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Warehouse Verified</div>
                        </div>
                    </div>
                </div>

                {/* Alerts Section */}
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>Alerts</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        
                        {!isTempSafe && (
                            <div className="glass-card" style={{ padding: '0.75rem', borderLeft: '4px solid var(--danger)', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                                <div style={{ fontSize: '0.75rem', flex: 1 }}>
                                    <div style={{ fontWeight: 600 }}>Temperature Anomaly</div>
                                    <div style={{ color: 'var(--text-secondary)' }}>Exceeding safe limits</div>
                                </div>
                            </div>
                        )}

                        {shockEventsCount > 0 && (
                            <div className="glass-card" style={{ padding: '0.75rem', borderLeft: '4px solid #CA8A04', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                                <div style={{ fontSize: '0.75rem', flex: 1 }}>
                                    <div style={{ fontWeight: 600 }}>Harsh braking / Shock detected</div>
                                    <div style={{ color: 'var(--text-secondary)' }}>Reduce speed - {shockEventsCount} events</div>
                                </div>
                            </div>
                        )}

                        {isTempSafe && shockEventsCount === 0 && (
                            <div className="glass-card" style={{ padding: '0.75rem', borderLeft: '4px solid var(--success)', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                                <div style={{ fontSize: '0.75rem', flex: 1 }}>
                                    <div style={{ fontWeight: 600 }}>Freezer temperature stable</div>
                                    <div style={{ color: 'var(--text-secondary)' }}>No anomalies</div>
                                </div>
                            </div>
                        )}
                        
                        <div className="glass-card" style={{ padding: '0.75rem', borderLeft: '4px solid var(--accent-cyan)', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                            <div style={{ fontSize: '0.75rem', flex: 1 }}>
                                <div style={{ fontWeight: 600 }}>Cargo weight stable</div>
                                <div style={{ color: 'var(--text-secondary)' }}>No discrepancies</div>
                            </div>
                        </div>

                    </div>
                </div>

            </div>
            
            <Driver_MrHodhaMaalu />
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
