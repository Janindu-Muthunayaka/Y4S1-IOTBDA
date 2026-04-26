import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useChatbot } from './Driver_Chatbot/Driver_ChatbotContext';
import detectiveIcon from './Driver_Chatbot/Driver_Detective.png';

/**
 * DriverSidebar — shared left-hand navigation for all Driver pages.
 *
 * Props:
 *  activeItem  {string}  — which nav item is currently active.
 *                          Values: 'dashboard' | 'temp' | 'shocks' | 'notif'
 *  hasAlert    {boolean} — when true, shows the red dot badge on the Notif icon.
 */
export default function DriverSidebar({ activeItem = '', hasAlert = false }) {
    const navigate = useNavigate();
    const { toggleChat, isOpen } = useChatbot();

    return (
        <div className="driver-sidebar">
            {/* ... avatar and other nav items ... */}
            <div className="driver-avatar-container">
                <div className="driver-avatar">
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="#7a5c3a">
                        <circle cx="12" cy="8" r="4" />
                        <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
                    </svg>
                </div>
                <span className="driver-avatar-name">Bumal</span>
                <span className="driver-avatar-role">Driver</span>
            </div>
            <div className="driver-divider"></div>

            {/* ── Dashboard ── */}
            <div
                className={`driver-nav-item ${activeItem === 'dashboard' ? 'active' : ''}`}
                onClick={() => navigate('/driver/dashboard')}
                style={{ cursor: 'pointer' }}
            >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className="driver-nav-icon" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="7" height="7" rx="1.5" />
                    <rect x="14" y="3" width="7" height="7" rx="1.5" />
                    <rect x="3" y="14" width="7" height="7" rx="1.5" />
                    <rect x="14" y="14" width="7" height="7" rx="1.5" />
                </svg>
                <span>Dashboard</span>
            </div>

            {/* ── Temperature ── */}
            <div
                className={`driver-nav-item ${activeItem === 'temp' ? 'active' : ''}`}
                onClick={() => navigate('/driver/temperature')}
                style={{ cursor: 'pointer' }}
            >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className="driver-nav-icon" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z" />
                </svg>
                <span>Temp</span>
            </div>

            {/* ── Shocks ── */}
            <div
                className={`driver-nav-item ${activeItem === 'shocks' ? 'active' : ''}`}
                onClick={() => navigate('/driver/shocks')}
                style={{ cursor: 'pointer' }}
            >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className="driver-nav-icon" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="2 12 6 12 8 4 10 20 13 10 15 14 17 12 22 12" />
                </svg>
                <span>Shocks</span>
            </div>

            {/* ── Notifications (with optional red-dot badge) ── */}
            <div
                className={`driver-nav-item ${activeItem === 'notif' ? 'active' : ''}`}
                onClick={() => navigate('/driver/notifications')}
                style={{ cursor: 'pointer' }}
            >
                <div style={{ position: 'relative', display: 'inline-block' }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className="driver-nav-icon" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                    </svg>
                    {hasAlert && (
                        <div style={{
                            position: 'absolute',
                            top: '-2px',
                            right: '-2px',
                            width: '8px',
                            height: '8px',
                            background: '#ff3b30',
                            borderRadius: '50%',
                            border: '1.5px solid #ffffff'
                        }} />
                    )}
                </div>
                <span>Notif</span>
            </div>

            {/* ── Spacer (pushes Chatbot to bottom) ── */}
            <div style={{ flex: 1 }}></div>

            {/* ── Chatbot (Replaces Settings) ── */}
            <div 
                className={`driver-nav-item ${isOpen ? 'active' : ''}`} 
                onClick={toggleChat}
                style={{ cursor: 'pointer' }}
            >
                <div className="driver-nav-icon-container" style={{ width: '22px', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <img src={detectiveIcon} alt="Mr. Hodha-Maalu" style={{ width: '22px', height: '22px', objectFit: 'contain' }} />
                </div>
                <span>Chatbot</span>
            </div>
        </div>
    );
}
