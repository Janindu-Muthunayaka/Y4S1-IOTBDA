import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { useChatbot } from './Owner_ChatbotContext';
import './Owner_MrHodhaMaalu.css';
import detectiveIcon from './Owner_Detective.png';

const API_BASE = 'http://localhost:3001';

export default function MrHodhaMaalu() {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([]);
    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [persona, setPersona] = useState(null);
    const { dashboardData } = useChatbot();
    const scrollRef = useRef(null);

    // Fetch persona on mount (no API key needed here anymore - it lives in .env on the server)
    useEffect(() => {
        const loadPersona = async () => {
            try {
                const { data } = await axios.get(`${API_BASE}/api/chatbot/owner/persona`);
                setPersona(data.content);
            } catch (err) {
                console.error("Failed to load persona:", err);
            }
        };
        loadPersona();
    }, []);

    // Scroll to bottom when messages change
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const createPretext = useCallback(async (data) => {
        if (!data) return "No dashboard data available.";

        let pretext = "";

        if (data.type === 'FLEET_STRATEGY_OVERVIEW') {
            pretext += `FLEET DASHBOARD SNAPSHOT:\n`;
            pretext += `Total Trips Monitored: ${data.totalTrips}\n`;
            pretext += `Active Trips: ${data.activeTrips}\n`;
            pretext += `Average Fleet Quality Score: ${data.fleetAvgQuality}/100\n`;
            pretext += `Average Fleet Temperature: ${data.fleetAvgTemp}°C\n`;
            pretext += `Total Alerts Active: ${data.alertsCount}\n\n`;

            if (data.criticalAlerts && data.criticalAlerts.length > 0) {
                pretext += `CRITICAL FLEET ALERTS:\n`;
                data.criticalAlerts.slice(0, 5).forEach(a => {
                    pretext += `- Truck ${a.truck}: ${a.type} Alert ${a.val ? '(' + parseFloat(a.val).toFixed(1) + '°C)' : ''}\n`;
                });
                if (data.criticalAlerts.length > 5) {
                    pretext += `... and ${data.criticalAlerts.length - 5} other active alerts.\n`;
                }
            } else {
                pretext += `No critical alerts in the fleet.\n`;
            }
        } else {
            const { trip, sensorData, kpis, weightLoss } = data;
            
            pretext += `SINGLE TRIP DASHBOARD SNAPSHOT:\n`;
            pretext += `Trip ID: ${trip?.trip_id || 'N/A'}\n`;
            pretext += `Truck: ${trip?.truck_id || 'N/A'}\n`;
            pretext += `Status: ${trip?.status || 'N/A'}\n`;
            pretext += `Cargo Shrinkage (Weight Loss): ${weightLoss ? weightLoss + '%' : 'Data Unavailable'}\n`;
            pretext += `Quality Score: ${kpis?.qualityScore}/100\n`;
            pretext += `Temperature Compliance: ${kpis?.tempCompliance}%\n\n`;
            
            pretext += `SUMMARY OF ANOMALIES:\n`;
            pretext += `- Shock Events: ${kpis?.shocks?.length || 0}\n`;
            pretext += `- Cold Violations: ${kpis?.cold?.length || 0}\n`;
            pretext += `- Hot Violations: ${kpis?.hot?.length || 0}\n\n`;

            pretext += `DETAILED VIOLATION TIMES (Threshold Crosses):\n`;
            if (kpis?.cold?.length > 0) {
                pretext += `Low TEMP excursions (<-22°C):\n`;
                kpis.cold.slice(0, 5).forEach(v => pretext += `  - ${v.time}: ${parseFloat(v.avg).toFixed(1)}°C\n`);
                if (kpis.cold.length > 5) pretext += `  ... and ${kpis.cold.length - 5} more events.\n`;
            }
            if (kpis?.hot?.length > 0) {
                pretext += `High TEMP excursions (>-18°C):\n`;
                kpis.hot.slice(0, 5).forEach(v => pretext += `  - ${v.time}: ${parseFloat(v.avg).toFixed(1)}°C\n`);
                if (kpis.hot.length > 5) pretext += `  ... and ${kpis.hot.length - 5} more events.\n`;
            }
            if (kpis?.shocks?.length > 0) {
                pretext += `SHOCK events (>0.5G):\n`;
                kpis.shocks.slice(0, 5).forEach(v => pretext += `  - ${v.time}: ${parseFloat(v.max_accel).toFixed(2)}G\n`);
                if (kpis.shocks.length > 5) pretext += `  ... and ${kpis.shocks.length - 5} more events.\n`;
            }

            if (!kpis?.cold?.length && !kpis?.hot?.length && !kpis?.shocks?.length) {
                pretext += `No threshold violations recorded. Clean run.\n`;
            }
        }

        // Save to Owner_Pretext.txt via backend
        try {
            await axios.post(`${API_BASE}/api/chatbot/owner/pretext`, { content: pretext });
        } catch (err) {
            console.error("Failed to save Owner_Pretext.txt:", err);
        }

        return pretext;
    }, []);

    // Keep the backend pretext continuously updated as dashboardData changes
    useEffect(() => {
        if (dashboardData) {
            createPretext(dashboardData);
        }
    }, [dashboardData, createPretext]);

    const toggleChat = async () => {
        if (!isOpen) {
            // Starting fresh chat
            if (messages.length === 0) {
                setMessages([{ role: 'bot', content: "Hi. I'm Mr. Hodha-Maalu, your Business Strategist. How can I help you optimize your fleet today?" }]);
            }
            await createPretext(dashboardData);
            setIsOpen(true);
        } else {
            // Hide chat but don't clear memory!
            setIsOpen(false);
        }
    };

    const handleSendMessage = async () => {
        if (!inputValue.trim() || isLoading) return;

        const userMsg = inputValue.trim();
        setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
        setInputValue('');
        setIsLoading(true);

        try {
            // Read the latest live dashboard snapshot from the server
            const { data: pretextData } = await axios.get(`${API_BASE}/api/chatbot/owner/pretext`);

            const systemPrompt = `${persona}\n\nCURRENT DASHBOARD SNAPSHOT:\n${pretextData.content}\n\nINSTRUCTION: If the user is just saying "Hi" or small talk, respond only with a cool greeting. Only analyze the SNAPSHOT above if the user asks about the trip, quality, or "how things are looking". No markdown (no **).`;

            // Format chat history for OpenAI (sliding window of last 6 messages)
            const chatHistory = messages
                .filter(m => m.content !== "Hi. I'm Mr. Hodha-Maalu, your Business Strategist. How can I help you optimize your fleet today?")
                .slice(-6)
                .map(m => ({
                    role: m.role === 'bot' ? 'assistant' : 'user',
                    content: m.content
                }));

            // Send to our SECURE backend proxy (API key never leaves the server)
            const { data } = await axios.post(`${API_BASE}/api/chatbot/owner/chat`, {
                systemPrompt,
                messages: [
                    ...chatHistory,
                    { role: 'user', content: userMsg }
                ]
            });

            setMessages(prev => [...prev, { role: 'bot', content: data.response }]);
        } catch (err) {
            const errorDetail = err.response?.data?.error || err.message || 'Unknown error';
            console.error('[Owner Chatbot] Error:', errorDetail);
            setMessages(prev => [...prev, { role: 'bot', content: `Sorry, I'm having trouble connecting. Reason: ${errorDetail}` }]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="chatbot-wrapper">
            {isOpen && (
                <div className="chat-window">
                    <div className="chat-header">
                        <img src={detectiveIcon} alt="Detective" className="small-detective" />
                        <div className="chat-header-info">
                            <h3>Mr. Hodha-Maalu</h3>
                            <p>BUSINESS STRATEGIST</p>
                        </div>
                    </div>

                    <div className="chat-messages" ref={scrollRef}>
                        {messages.map((msg, idx) => (
                            <div key={idx} className={`message ${msg.role}`}>
                                {msg.content}
                            </div>
                        ))}
                        {isLoading && <div className="typing-indicator">Mr. Hodha-Maalu is analyzing...</div>}
                    </div>

                    <div className="chat-input-area">
                        <input 
                            type="text" 
                            placeholder="Ask about fleet performance..."
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                        />
                        <button 
                            className="send-btn" 
                            onClick={handleSendMessage}
                            disabled={!inputValue.trim() || isLoading}
                        >
                            Send
                        </button>
                    </div>
                </div>
            )}

            <div className={`chatbot-toggle ${isOpen ? 'active' : ''}`} onClick={toggleChat}>
                <img src={detectiveIcon} alt="Detective" className="chatbot-icon" />
            </div>
        </div>
    );
}
