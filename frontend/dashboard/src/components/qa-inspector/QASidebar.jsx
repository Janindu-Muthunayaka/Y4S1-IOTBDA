import React from 'react';
import { useNavigate } from 'react-router-dom';
import logo from '../../assets/logo.svg';

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
            <div className="qa-sidebar__logo">
                <img src={logo} alt="Logo" style={{ width: '38px', height: '38px', objectFit: 'contain' }} />
                <div>
                    <div className="qa-sidebar__logo-text">CargoLink</div>
                    <div className="qa-sidebar__logo-sub">QA Portal</div>
                </div>
            </div>

            <nav className="qa-sidebar__nav">
                <div className="qa-nav-section">Main Menu</div>

                {/* 1. Dashboard */}
                <div 
                    className={`qa-nav-item ${activeTab === 'dashboard' ? 'active' : ''}`} 
                    onClick={() => navigate('/qa/dash')}
                >
                    <span className="qa-nav-item__icon">⊞</span>
                    Dashboard
                </div>

                {/* 2. Trip Detail */}
                <div 
                    className={`qa-nav-item ${activeTab === 'trip' ? 'active' : ''}`} 
                    onClick={() => tripId ? navigate(`/qa/trip/${tripId}`) : navigate('/qa/dash')}
                    style={{ opacity: !tripId && activeTab !== 'trip' ? 0.4 : 1 }}
                >
                    <span className="qa-nav-item__icon">🚛</span>
                    Trip Detail
                </div>

                {/* 3. Analytics */}
                <div 
                    className={`qa-nav-item ${activeTab === 'analytics' ? 'active' : ''}`} 
                    onClick={() => tripId ? navigate(`/qa/graphs/${tripId}`) : navigate('/qa/dash')}
                    style={{ opacity: !tripId && activeTab !== 'analytics' ? 0.4 : 1 }}
                >
                    <span className="qa-nav-item__icon">📈</span>
                    Analytics
                </div>

                {/* 4. Timeline */}
                <div 
                    className={`qa-nav-item ${activeTab === 'timeline' ? 'active' : ''}`} 
                    onClick={() => tripId ? navigate(`/qa/timeline/${tripId}`) : navigate('/qa/dash')}
                    style={{ opacity: !tripId && activeTab !== 'timeline' ? 0.4 : 1 }}
                >
                    <span className="qa-nav-item__icon">⏱</span>
                    Timeline
                </div>

                <div className="qa-nav-section" style={{ marginTop: '1rem' }}>System</div>
                
                {/* 5. Settings / Test Mode */}
                <div 
                    className={`qa-nav-item ${activeTab === 'settings' ? 'active' : ''}`} 
                    onClick={() => navigate('/qa/dashboard')}
                >
                    <span className="qa-nav-item__icon">⚙️</span>
                    Settings
                </div>
            </nav>

            <div className="qa-sidebar__footer">
                <div className="qa-sidebar__avatar">QA</div>
                <button className="qa-sidebar__footer-btn" title="Notifications">
                    🔔
                    {hasCriticalAlerts && <div className="qa-bell-dot"></div>}
                </button>
            </div>
        </aside>
    );
};

export default QASidebar;
