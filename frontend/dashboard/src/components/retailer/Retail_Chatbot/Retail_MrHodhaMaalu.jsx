import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { useChatbot } from './Retail_ChatbotContext';
import './Retail_MrHodhaMaalu.css';
import detectiveIcon from './Retail_Detective.png';

const API_BASE = 'http://localhost:3001';

export default function MrHodhaMaalu() {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([]);
    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [persona, setPersona] = useState(null);
    const [apiKey, setApiKey] = useState('');
    const { dashboardData } = useChatbot();
    const scrollRef = useRef(null);

    // Fetch persona and API key on mount
    useEffect(() => {
        const loadPersona = async () => {
            try {
                const { data } = await axios.get(`${API_BASE}/api/chatbot/retailer/persona`);
                const content = data.content;
                setPersona(content);
                
                // Extract API Key robustly (Look for AIzaSy pattern)
                const keyMatch = content.match(/AIzaSy[A-Za-z0-9_-]+/);
                if (keyMatch) {
                    setApiKey(keyMatch[0].trim());
                    console.log("[Chatbot] API Key detected.");
                } else {
                    console.error("[Chatbot] API Key not found in Retail_Persona.txt");
                }
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

        const { trip, sensorData, kpis } = data;
        
        let pretext = `DASHBOARD SNAPSHOT CONTENT:\n`;
        pretext += `Trip ID: ${trip?.trip_id || 'N/A'}\n`;
        pretext += `Truck: ${trip?.truck_id || 'N/A'}\n`;
        pretext += `Status: ${trip?.status || 'N/A'}\n`;
        pretext += `Quality Score: ${kpis?.qualityScore}/100\n`;
        pretext += `Temperature Compliance: ${kpis?.tempCompliance}%\n\n`;
        
        pretext += `SUMMARY OF ANOMALIES:\n`;
        pretext += `- Shock Events: ${kpis?.shocks?.length || 0}\n`;
        pretext += `- Cold Violations: ${kpis?.cold?.length || 0}\n`;
        pretext += `- Hot Violations: ${kpis?.hot?.length || 0}\n\n`;

        pretext += `DETAILED VIOLATION TIMES (Threshold Crosses):\n`;
        if (kpis?.cold?.length > 0) {
            pretext += `Low TEMP excursions (<-22°C):\n`;
            kpis.cold.forEach(v => pretext += `  - ${v.time}: ${parseFloat(v.avg).toFixed(1)}°C\n`);
        }
        if (kpis?.hot?.length > 0) {
            pretext += `High TEMP excursions (>-18°C):\n`;
            kpis.hot.forEach(v => pretext += `  - ${v.time}: ${parseFloat(v.avg).toFixed(1)}°C\n`);
        }
        if (kpis?.shocks?.length > 0) {
            pretext += `SHOCK events (>0.5G):\n`;
            kpis.shocks.forEach(v => pretext += `  - ${v.time}: ${parseFloat(v.max_accel).toFixed(2)}G\n`);
        }

        if (!kpis?.cold?.length && !kpis?.hot?.length && !kpis?.shocks?.length) {
            pretext += `No threshold violations recorded. Clean run.\n`;
        }

        // Save to Retail_Pretext.txt via backend
        try {
            await axios.post(`${API_BASE}/api/chatbot/retailer/pretext`, { content: pretext });
        } catch (err) {
            console.error("Failed to save Retail_Pretext.txt:", err);
        }

        return pretext;
    }, []);

    const toggleChat = async () => {
        if (!isOpen) {
            // Starting fresh chat
            setMessages([{ role: 'bot', content: "Hi. I'm Mr. Hodha-Maalu, your Retail Suggestor. How can I help you today?" }]);
            await createPretext(dashboardData);
            setIsOpen(true);
        } else {
            // Ending chat
            setIsOpen(false);
            setMessages([]);
        }
    };

    const handleSendMessage = async () => {
        if (!inputValue.trim() || isLoading) return;

        if (!apiKey) {
            setMessages(prev => [...prev, { role: 'user', content: inputValue.trim() }]);
            setMessages(prev => [...prev, { role: 'bot', content: "I'm sorry, I couldn't find a valid Gemini API key in my Persona settings. Please make sure Line 18 of Retail_Persona.txt contains your Key." }]);
            setInputValue('');
            return;
        }

        const userMsg = inputValue.trim();
        setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
        setInputValue('');
        setIsLoading(true);

        try {
            // Build the prompt for Gemini
            const { data: pretextData } = await axios.get(`${API_BASE}/api/chatbot/retailer/pretext`);
            
            const systemPrompt = `${persona}\n\nCURRENT DASHBOARD SNAPSHOT:\n${pretextData.content}\n\nINSTRUCTION: If the user is just saying "Hi" or small talk, respond only with a cool greeting. Only analyze the SNAPSHOT above if the user asks about the trip, quality, or "how things are looking". No markdown (no **).`;
            
            // Format history for Gemini API (Content-based)
            const chatHistory = messages
                .filter(m => m.content !== "Hi. I'm Mr. Hodha-Maalu, your Retail Suggestor. How can I help you today?")
                .map(m => ({
                    role: m.role === 'bot' ? 'model' : 'user',
                    parts: [{ text: m.content }]
                }));

            const payload = {
                contents: [
                    ...chatHistory,
                    { role: 'user', parts: [{ text: userMsg }] }
                ],
                system_instruction: { parts: [{ text: systemPrompt }] }
            };

            // Call Gemini API
            const response = await axios.post(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`,
                payload
            );

            if (response.data.candidates && response.data.candidates[0].content) {
                const botResponse = response.data.candidates[0].content.parts[0].text;
                setMessages(prev => [...prev, { role: 'bot', content: botResponse }]);
            } else {
                throw new Error("Invalid API response structure");
            }
        } catch (err) {
            const errorDetail = err.response?.data?.error?.message || err.message || "Unknown error";
            console.error("Gemini API Error:", errorDetail);
            setMessages(prev => [...prev, { role: 'bot', content: `Sorry, I'm having trouble connecting to my central analytical core. Reason: ${errorDetail}` }]);
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
                            <p>RETAIL SUGGESTOR</p>
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
                            placeholder="Ask about cargo quality..."
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
