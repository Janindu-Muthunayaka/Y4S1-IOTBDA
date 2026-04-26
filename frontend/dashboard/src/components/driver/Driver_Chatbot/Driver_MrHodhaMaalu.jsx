import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { useChatbot } from './Driver_ChatbotContext';
import './Driver_MrHodhaMaalu.css';
import detectiveIcon from './Driver_Detective.png';

const API_BASE = 'http://localhost:3001';

export default function MrHodhaMaalu() {
    const { isOpen, toggleChat, dashboardData } = useChatbot();
    const [messages, setMessages] = useState([]);
    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [persona, setPersona] = useState(null);
    const scrollRef = useRef(null);

    const createPretext = useCallback(async (data) => {
        if (!data) return "No dashboard data available.";

        const { trip, sensorData, kpis, currentPage } = data;

        // Common metrics
        const temps = sensorData?.temperature_data || [];
        const motions = sensorData?.motion_data || [];
        const currentTemp = temps.length > 0 ? `${parseFloat(temps[temps.length - 1].avg).toFixed(1)}°C` : 'N/A';
        const shockLevel = motions.length > 0
            ? (Math.max(...motions.map(m => m.max_accel)) > 0.5 ? 'ALERT' : 'NORMAL')
            : 'N/A';

        const w1 = trip?.startWeight != null ? `${Number(trip.startWeight).toFixed(3)} kg` : 'N/A';
        const w2 = trip?.endWeight != null ? `${Number(trip.endWeight).toFixed(3)} kg` : 'N/A';
        const weightMatch = trip?.startWeight != null && trip?.endWeight != null
            ? (Math.abs(trip.startWeight - trip.endWeight) < 0.5 ? 'Secure' : 'Mismatch')
            : 'N/A';

        let pretext = `DASHBOARD SNAPSHOT CONTENT:\n`;
        pretext += `Currently Viewing: ${currentPage || 'Main Dashboard'}\n`;
        pretext += `Trip: ${trip?.trip_id || 'N/A'} (${trip?.status || 'N/A'})\n\n`;

        if (currentPage === 'Temperature Page') {
            pretext += `--- TEMPERATURE ANALYTICS ---\n`;
            pretext += `Current: ${currentTemp}\nCompliance: ${kpis?.tempCompliance}%\nAnomalies: ${kpis?.hot?.length + kpis?.cold?.length || 0}\n`;
        }
        else if (currentPage === 'Shocks Page') {
            pretext += `--- SHOCK ANALYTICS ---\n`;
            pretext += `Current Status: ${shockLevel}\nTotal Events: ${kpis?.shocks?.length || 0}\n`;
        }
        else {
            const isOutbound = trip?.trip_type === 'OUTGOING';
            pretext += `--- TRIP OVERVIEW ---\n`;
            pretext += `Route: ${isOutbound ? 'Warehouse → Retailer' : 'Supplier → Warehouse'}\n`;
            pretext += `Cargo: ${weightMatch} (Exp: ${w1}, Cur: ${w2})\n`;
            pretext += `Temp: ${currentTemp} (${kpis?.tempCompliance}% Compliance)\n`;
            pretext += `Shocks: ${shockLevel} (${kpis?.shocks?.length || 0} events)\n`;
        }

        // Save to Driver_Pretext.txt via backend
        try {
            await axios.post(`${API_BASE}/api/chatbot/driver/pretext`, { content: pretext });
        } catch (err) {
            console.error("Failed to save Driver_Pretext.txt:", err);
        }

        return pretext;
    }, []);

    const handleSendMessage = async () => {
        if (!inputValue.trim() || isLoading) return;

        const userMsg = inputValue.trim();
        setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
        setInputValue('');
        setIsLoading(true);

        try {
            // Read the latest live dashboard snapshot from the server
            const { data: pretextData } = await axios.get(`${API_BASE}/api/chatbot/driver/pretext`);

            const systemPrompt = `${persona}\n\nCURRENT DASHBOARD SNAPSHOT:\n${pretextData.content}\n\nINSTRUCTION: Respond naturally. No markdown. Use snapshot for facts. If user says Hi, just greet back coolly.`;

            // Format chat history for OpenAI (sliding window of last 6 messages)
            const chatHistory = messages
                .filter(m => m.content !== "Hi. I'm Mr. Hodha-Maalu, your Trip Assistant. How's the drive going?")
                .slice(-6)
                .map(m => ({
                    role: m.role === 'bot' ? 'assistant' : 'user',
                    content: m.content
                }));

            // Call our SECURE backend proxy
            const { data } = await axios.post(`${API_BASE}/api/chatbot/driver/chat`, {
                systemPrompt,
                messages: [
                    ...chatHistory,
                    { role: 'user', content: userMsg }
                ]
            });

            if (data.response) {
                setMessages(prev => [...prev, { role: 'bot', content: data.response }]);
            }
        } catch (err) {
            const errorMsg = err.response?.data?.error || err.message;
            console.error('Chat error:', errorMsg);
            setMessages(prev => [...prev, { role: 'bot', content: `Connection error: ${errorMsg}` }]);
        } finally {
            setIsLoading(false);
        }
    };

    // Fetch persona on mount
    useEffect(() => {
        const loadPersona = async () => {
            try {
                const { data } = await axios.get(`${API_BASE}/api/chatbot/driver/persona`);
                setPersona(data.content);
            } catch (err) {
                console.error("Failed to load persona:", err);
            }
        };
        loadPersona();
    }, []);

    // Keep the backend pretext continuously updated as dashboardData changes
    useEffect(() => {
        if (dashboardData) {
            createPretext(dashboardData);
        }
    }, [dashboardData, createPretext]);

    // Initial greeting when opened
    useEffect(() => {
        if (isOpen && messages.length === 0) {
            setMessages([{ role: 'bot', content: "Hi. I'm Mr. Hodha-Maalu, your Trip Assistant. How's the drive going?" }]);
        }
    }, [isOpen]);

    // Scroll to bottom when messages change
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    if (!isOpen) return null;

    return (
        <div className="driver-chatbot-wrapper">
            <div className="chat-window">
                <div className="chat-header">
                    <img src={detectiveIcon} alt="Detective" className="small-detective" />
                    <div className="chat-header-info">
                        <h3>Mr. Hodha-Maalu</h3>
                        <p>TRIP ASSISTANT</p>
                    </div>
                    <button onClick={toggleChat} className="chat-close-btn">×</button>
                </div>

                <div className="chat-messages" ref={scrollRef}>
                    {messages.map((msg, idx) => (
                        <div key={idx} className={`message ${msg.role}`}>
                            {msg.content}
                        </div>
                    ))}
                    {isLoading && <div className="typing-indicator">Analyzing...</div>}
                </div>

                <div className="chat-input-area">
                    <input
                        type="text"
                        placeholder="Ask..."
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
        </div>
    );
}
