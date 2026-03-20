import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const API_BASE = 'http://localhost:3001';

export default function TripsTable() {
    const [trips, setTrips] = useState([]);
    const navigate = useNavigate();

    const fetchTrips = async () => {
        try {
            const { data } = await axios.get(`${API_BASE}/api/trips`);
            if (Array.isArray(data)) {
                setTrips(data);
            }
        } catch (err) {
            console.error("Failed to fetch trips:", err);
        }
    };

    useEffect(() => {
        fetchTrips();
        // Exclusively fetch from MongoDB via our standalone API every 5 seconds
        const interval = setInterval(fetchTrips, 5000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="glass-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h2 style={{ margin: 0 }}>Active & Historical Trips</h2>
                <div className="live-indicator" style={{ color: 'var(--accent-purple)' }}>
                    <div className="pulse-dot" style={{ backgroundColor: 'var(--accent-purple)' }}></div> MongoDB Polling
                </div>
            </div>

            <div className="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Trip ID</th>
                            <th>Truck ID</th>
                            <th>Direction</th>
                            <th>Date Started</th>
                            <th>Final Weight (kg)</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {trips.length === 0 && (
                            <tr><td colSpan="6" style={{ textAlign: 'center' }}>No trips recorded yet.</td></tr>
                        )}
                        {trips.map(trip => (
                            <tr key={trip._id} onClick={() => navigate(`/trip/${trip.trip_id}`)}>
                                <td style={{ fontWeight: 600 }}>{trip.trip_id}</td>
                                <td style={{ color: 'var(--accent-cyan)' }}>{trip.truck_id}</td>
                                <td>{trip.trip_direction}</td>
                                <td>{trip.timestamp ? new Date(trip.timestamp).toLocaleString() : '--'}</td>
                                <td>{trip.weight ? trip.weight.toFixed(2) : '--'}</td>
                                <td>
                                    <span className={`badge ${trip.status === 'ACTIVE' ? 'badge-active' : 'badge-completed'}`}>
                                        {trip.status}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
