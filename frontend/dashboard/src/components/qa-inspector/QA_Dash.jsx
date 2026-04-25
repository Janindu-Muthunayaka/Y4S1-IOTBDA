import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import QASidebar from './QASidebar';
import { useChatbot } from './Chatbot/ChatbotContext';
import './QA.css';

const API_BASE = 'http://localhost:3001';

export default function QA_Dash() {
    const navigate = useNavigate();
    const [trips, setTrips] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [sensorMap, setSensorMap] = useState({});
    const { updateSnapshot } = useChatbot();

    // Push overview data to chatbot context
    useEffect(() => {
        if (!isLoading && trips.length > 0) {
            updateSnapshot({
                type: 'FLEET_OVERVIEW',
                trips: trips,
                activeTrips: trips.filter(t => t.status === 'ACTIVE').length,
                totalTrips: trips.length
            });
        }
    }, [isLoading, trips, updateSnapshot]);

    // Fetch all trips
    useEffect(() => {
        const fetchTrips = async () => {
            try {
                const { data } = await axios.get(`${API_BASE}/api/trips`);
                if (Array.isArray(data)) {
                    setTrips(data);
                    setIsLoading(false);
                }
            } catch (err) {
                console.error(err);
                setIsLoading(false);
            }
        };
        fetchTrips();
        const interval = setInterval(fetchTrips, 5000);
        return () => clearInterval(interval);
    }, []);

    // Fetch sensor data for each trip to detect alerts
    useEffect(() => {
        if (trips.length === 0) return;
        const fetchSensors = async () => {
            const map = {};
            for (const trip of trips) {
                try {
                    const { data } = await axios.get(`${API_BASE}/api/trips/${trip.trip_id}/sensors`);
                    map[trip.trip_id] = data.sensorData || null;
                } catch (err) {
                    /* skip */
                }
            }
            setSensorMap(map);
        };
        fetchSensors();
        const interval = setInterval(fetchSensors, 10000);
        return () => clearInterval(interval);
    }, [trips]);

    // Helpers
    const fmtTime = (d) => d ? new Date(d).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '--:--';
    const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';

    // Split trips by direction (support both trip_type and trip_direction)
    const inboundTrips = trips.filter(t => t.trip_type === 'INCOMING' || t.trip_direction === 'INBOUND');
    const outboundTrips = trips.filter(t => t.trip_type === 'OUTGOING' || t.trip_direction === 'OUTBOUND');

    // Derive alerts from sensor data
    const buildAlerts = () => {
        const alerts = [];
        for (const trip of trips) {
            const sd = sensorMap[trip.trip_id];
            if (!sd) continue;
            const temps = sd.temperature_data || [];
            const motions = sd.motion_data || [];

            // Temperature violations
            const violations = temps.filter(t => t.avg > -18);
            if (violations.length > 0) {
                const last = violations[violations.length - 1];
                alerts.push({
                    type: 'critical',
                    title: `Temperature exceeded -18°C (${last.avg?.toFixed(1)}°C)`,
                    sub: `${fmtDate(trip.timestamp)}, ${last.time || fmtTime(trip.timestamp)} · ${trip.truck_id}`,
                    truckId: trip.truck_id,
                    tripId: trip.trip_id,
                });
            }

            // Shock events
            const shocks = motions.filter(m => m.max_accel > 0.5);
            if (shocks.length > 0) {
                alerts.push({
                    type: 'warning',
                    title: `High vibration during transit (${shocks.length} events)`,
                    sub: `${fmtDate(trip.timestamp)}, ${shocks[0].time || fmtTime(trip.timestamp)} · ${trip.truck_id}`,
                    truckId: trip.truck_id,
                    tripId: trip.trip_id,
                });
            }

            // Minor shock events (between 0.3 and 0.5)
            const minorShocks = motions.filter(m => m.max_accel > 0.3 && m.max_accel <= 0.5);
            if (minorShocks.length > 0) {
                alerts.push({
                    type: 'minor',
                    title: `Minor shock event logged (${minorShocks.length} events)`,
                    sub: `${fmtDate(trip.timestamp)}, ${minorShocks[0].time || fmtTime(trip.timestamp)} · ${trip.truck_id}`,
                    truckId: trip.truck_id,
                    tripId: trip.trip_id,
                });
            }
        }

        // If no real alerts, add an info one
        if (alerts.length === 0) {
            alerts.push({
                type: 'info',
                title: 'All systems nominal',
                sub: 'No issues detected',
            });
        }

        return alerts;
    };

    const alerts = buildAlerts();

    // Count alert types for badge
    const alertCount = alerts.filter(a => a.type !== 'info').length;

    if (isLoading) {
        return (
            <div className="qa-loading-container">
                <div className="qa-loading-spinner"></div>
                <div>Loading trips…</div>
            </div>
        );
    }

    // Render a trip table row
    const renderTripRow = (trip) => {
        const departureTime = fmtTime(trip.timestamp);
        const status = trip.status || 'Unknown';

        // Pickup/Action Time: Find the most significant mid-trip event
        const pickupEvent = trip.stateChange?.find(s => 
            s.status === 'Reached pickup location and loading' || 
            s.status === 'Delivered and returning'
        );
        const pickupTime = pickupEvent ? fmtTime(pickupEvent.timestamp) : '--:--';

        // Arrival time: use endTime if complete, otherwise check if active
        const sd = sensorMap[trip.trip_id];
        const arrivalRaw = trip.endTime || sd?.last_updated || trip.end_time || trip.updatedAt;
        const arrivalTime = trip.active
            ? 'In Transit'
            : (arrivalRaw ? fmtTime(arrivalRaw) : '--:--');

        return (
            <tr key={trip._id}>
                <td className="qa-trip-id-cell">
                    <div style={{ fontWeight: 700, color: '#4F46E5', fontFamily: 'JetBrains Mono, monospace', fontSize: '12px' }}>{trip.trip_id}</div>
                </td>
                <td className="qa-time-cell">{fmtDate(trip.timestamp)}</td>
                <td className="qa-time-cell">{departureTime}</td>
                <td className="qa-time-cell">{pickupTime}</td>
                <td className="qa-time-cell">
                    <span className="qa-time-flow">{arrivalTime}</span>
                </td>
                <td>
                    <span className={`qa-status-pill ${status.toLowerCase().replace(/\s+/g, '-')}`}>
                        {status}
                    </span>
                </td>
                <td>
                    <div className="qa-truck-pill">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: '6px', opacity: 0.7 }}>
                            <path d="M1 3h15v13H1z" /><path d="M16 8l4 2v6h-4z" />
                        </svg>
                        {trip.truck_id || '--'}
                    </div>
                </td>
                <td>
                    <button
                        className="qa-view-btn"
                        onClick={() => navigate(`/qa/trip/${trip.trip_id}`)}
                    >
                        View →
                    </button>
                </td>
            </tr>
        );
    };

    // Alert icon by type
    const AlertIcon = ({ type }) => {
        switch (type) {
            case 'critical':
                return (
                    <svg viewBox="0 0 24 24" fill="none" stroke="#E53E3E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 14.76V3.5a2.5 2.5 0 00-5 0v11.26a4.5 4.5 0 105 0z" />
                    </svg>
                );
            case 'warning':
                return (
                    <svg viewBox="0 0 24 24" fill="none" stroke="#DD6B20" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M2 12c1-4 3-6 3-6s2 4 4 4 4-8 6-8 3 4 4 4 3 2 3 6" />
                    </svg>
                );
            case 'minor':
                return (
                    <svg viewBox="0 0 24 24" fill="none" stroke="#D69E2E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                    </svg>
                );
            default:
                return (
                    <svg viewBox="0 0 24 24" fill="none" stroke="#718096" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                    </svg>
                );
        }
    };

    return (
        <div className="qa-root">
            {/* ── Sidebar ──────────────────────────────────────────────── */}
            <QASidebar activeTab="dashboard" alerts={alerts} />

            {/* ── Main Content ────────────────────────────────────────── */}
            <main className="qa-main">
                {/* Header */}
                <header className="qa-header">
                    <div className="qa-header-left">
                        <h2 className="qa-header-title">QA Inspector Overview</h2>
                        <div className="qa-header-sep"></div>
                        <div className="qa-header-badge">
                            Live Monitoring
                            <div className="qa-badge-dot"></div>
                        </div>
                    </div>
                    <div className="qa-header-right">
                    </div>
                </header>

                {/* Content */}
                <div className="qa-content">

                    {/* Left Column: Tables */}
                    <div className="qa-tables-col">
                        {/* ── Incoming Trucks (INBOUND) ────────────────────── */}
                        <div className="qa-section-card">
                        <div className="qa-section-header">
                            <div className="qa-section-title-group">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6C5CE7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M1 3h15v13H1z" /><path d="M16 8l4 2v6h-4z" />
                                    <circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" />
                                </svg>
                                <span className="qa-section-title">Incoming Trucks</span>
                                <span className="qa-badge qa-badge-trucks">{inboundTrips.length} trucks</span>
                            </div>
                            <button className="qa-filter-btn">
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
                                </svg>
                                Filter
                            </button>
                        </div>
                        <div className="qa-table-wrap">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Trip ID</th>
                                        <th>Date</th>
                                        <th>Departure</th>
                                        <th>Pickup</th>
                                        <th>Arrival</th>
                                        <th>Status</th>
                                        <th>Truck ID</th>
                                        <th>Trip View</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {inboundTrips.length === 0 ? (
                                        <tr className="qa-empty-row">
                                            <td colSpan="8">No inbound trips recorded.</td>
                                        </tr>
                                    ) : (
                                        inboundTrips.map(renderTripRow)
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* ── Outgoing Trucks (OUTBOUND) ───────────────────── */}
                    <div className="qa-section-card">
                        <div className="qa-section-header">
                            <div className="qa-section-title-group">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6C5CE7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M1 3h15v13H1z" /><path d="M16 8l4 2v6h-4z" />
                                    <circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" />
                                </svg>
                                <span className="qa-section-title">Outgoing Trucks</span>
                                <span className="qa-badge qa-badge-trucks">{outboundTrips.length} trucks</span>
                            </div>
                            <button className="qa-filter-btn">
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
                                </svg>
                                Filter
                            </button>
                        </div>
                        <div className="qa-table-wrap">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Trip ID</th>
                                        <th>Date</th>
                                        <th>Departure</th>
                                        <th>Pickup</th>
                                        <th>Arrival</th>
                                        <th>Status</th>
                                        <th>Truck ID</th>
                                        <th>Trip View</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {outboundTrips.length === 0 ? (
                                        <tr className="qa-empty-row">
                                            <td colSpan="8">No outbound trips recorded.</td>
                                        </tr>
                                    ) : (
                                        outboundTrips.map(renderTripRow)
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    </div> {/* End of qa-tables-col */}
                    
                    {/* Right Column: Alerts */}
                    <div className="qa-alerts-col">
                        {/* ── Alerts & Notifications ───────────────────────── */}
                        <div className="qa-section-card">
                        <div className="qa-section-header">
                            <div className="qa-section-title-group">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#DD6B20" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 01-3.46 0" />
                                </svg>
                                <span className="qa-section-title">Alerts &amp; Notifications</span>
                                <span className="qa-badge qa-badge-alerts">{alertCount} alerts</span>
                            </div>
                            <div className="qa-alerts-meta">
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#AAA" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                                </svg>
                                Last synced just now
                            </div>
                        </div>

                        <div className="qa-alerts-grid">
                            {alerts.map((alert, i) => (
                                <div 
                                    key={i} 
                                    className={`qa-alert-card qa-alert-${alert.type}`}
                                    onClick={() => alert.tripId && navigate(`/qa/timeline/${alert.tripId}`)}
                                >
                                    <div className="qa-alert-icon-wrap">
                                        <AlertIcon type={alert.type} />
                                    </div>
                                    <div className="qa-alert-severity-row">
                                        <span className={`qa-sev-dot qa-sev-${alert.type}`}></span>
                                        <span className="qa-sev-label">{alert.type === 'critical' ? 'Critical' : alert.type === 'warning' ? 'Warning' : alert.type === 'minor' ? 'Minor' : 'Info'}</span>
                                    </div>
                                    <div className="qa-alert-title">{alert.title}</div>
                                    <div className="qa-alert-sub">{alert.sub}</div>
                                </div>
                            ))}
                        </div>

                        <div className="qa-legend-strip">
                            <span className="qa-legend-label">Severity:</span>
                            <span className="qa-legend-item"><span className="qa-legend-swatch" style={{ background: '#E53E3E' }}></span> Critical</span>
                            <span className="qa-legend-item"><span className="qa-legend-swatch" style={{ background: '#DD6B20' }}></span> Warning</span>
                            <span className="qa-legend-item"><span className="qa-legend-swatch" style={{ background: '#D69E2E' }}></span> Minor</span>
                            <span className="qa-legend-item"><span className="qa-legend-swatch" style={{ background: '#A0AEC0' }}></span> Info</span>
                        </div>
                        </div>
                    </div>

                </div>
            </main>
        </div>
    );
}
