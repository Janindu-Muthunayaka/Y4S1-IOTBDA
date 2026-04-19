import React from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Shared QASidebar component to ensure consistency across the QA module.
 * @param {string} activeTab - The currently active tab ('dashboard', 'trip', 'analytics', 'timeline', 'settings')
 * @param {string} tripId - The current trip ID (optional, required for trip-specific views)
 * @param {Array} alerts - List of alerts for the notification dot (optional)
 */
const QASidebar = ({ activeTab, tripId, alerts = [] }) => {
    const navigate = useNavigate();

    // Check if any alerts should trigger a notification dot
    const hasCriticalAlerts = alerts.some(a => a.type === 'critical' || a.type === 'warning');

    return (
        <aside className="qa-sidebar">
            <div className="qa-sidebar-logo-group">
                <div className="qa-sidebar-logo">
                    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <line x1="12" y1="2" x2="12" y2="22" stroke="white" strokeWidth="2" strokeLinecap="round"/><line x1="2" y1="12" x2="22" y2="12" stroke="white" strokeWidth="2" strokeLinecap="round"/><line x1="5" y1="5" x2="19" y2="19" stroke="white" strokeWidth="2" strokeLinecap="round"/><line x1="19" y1="5" x2="5" y2="19" stroke="white" strokeWidth="2" strokeLinecap="round"/><circle cx="12" cy="2" r="1.5" fill="white"/><circle cx="12" cy="22" r="1.5" fill="white"/><circle cx="2" cy="12" r="1.5" fill="white"/><circle cx="22" cy="12" r="1.5" fill="white"/>
                    </svg>
                </div>
                <div className="qa-sidebar-brand">Cargo Link</div>
            </div>

            <nav className="qa-nav-items">
                {/* 1. Dashboard */}
                <div 
                    className={`qa-nav-item ${activeTab === 'dashboard' ? 'active' : ''}`} 
                    onClick={() => navigate('/qa/dash')}
                >
                    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
                        <rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
                    </svg>
                    <span className="qa-tooltip">Dashboard</span>
                </div>

                {/* 2. Trip Detail */}
                <div 
                    className={`qa-nav-item ${activeTab === 'trip' ? 'active' : ''}`} 
                    onClick={() => tripId ? navigate(`/qa/trip/${tripId}`) : navigate('/qa/dash')}
                    style={{ opacity: !tripId && activeTab !== 'trip' ? 0.4 : 1 }}
                >
                    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 3h15v13H1z" /><path d="M16 8l4 2v6h-4z" />
                        <circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" />
                    </svg>
                    <span className="qa-tooltip">Trip Detail</span>
                </div>

                {/* 3. Analytics */}
                <div 
                    className={`qa-nav-item ${activeTab === 'analytics' ? 'active' : ''}`} 
                    onClick={() => tripId ? navigate(`/qa/graphs/${tripId}`) : navigate('/qa/dash')}
                    style={{ opacity: !tripId && activeTab !== 'analytics' ? 0.4 : 1 }}
                >
                    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                    </svg>
                    <span className="qa-tooltip">Analytics</span>
                </div>

                {/* 4. Timeline */}
                <div 
                    className={`qa-nav-item ${activeTab === 'timeline' ? 'active' : ''}`} 
                    onClick={() => tripId ? navigate(`/qa/timeline/${tripId}`) : navigate('/qa/dash')}
                    style={{ opacity: !tripId && activeTab !== 'timeline' ? 0.4 : 1 }}
                >
                    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="17" y1="2" x2="17" y2="22" /><line x1="7" y1="2" x2="7" y2="22" />
                        <line x1="2" y1="12" x2="22" y2="12" />
                    </svg>
                    <span className="qa-tooltip">Timeline</span>
                </div>

                {/* 5. Settings / Test Mode */}
                <div 
                    className={`qa-nav-item ${activeTab === 'settings' ? 'active' : ''}`} 
                    onClick={() => navigate('/qa/dashboard')}
                >
                    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="3" />
                        <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
                    </svg>
                    <span className="qa-tooltip">Settings</span>
                </div>
            </nav>

            <div className="qa-sidebar-bottom">
                <div className="qa-bell-btn">
                    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 01-3.46 0" />
                    </svg>
                    {hasCriticalAlerts && (
                        <div className="qa-bell-dot"></div>
                    )}
                </div>
                <div className="qa-avatar">QA</div>
            </div>
        </aside>
    );
};

export default QASidebar;
