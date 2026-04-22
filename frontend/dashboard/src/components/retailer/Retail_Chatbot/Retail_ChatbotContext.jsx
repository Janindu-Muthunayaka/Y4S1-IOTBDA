import React, { createContext, useContext, useState, useCallback } from 'react';

const ChatbotContext = createContext();

export const useChatbot = () => {
    const context = useContext(ChatbotContext);
    if (context === undefined) {
        // Return a mock object to prevent destructuring errors if used outside provider
        return { dashboardData: null, updateSnapshot: () => {} };
    }
    return context;
};

export const ChatbotProvider = ({ children }) => {
    const [dashboardData, setDashboardData] = useState(null);

    const updateSnapshot = useCallback((data) => {
        setDashboardData(data);
    }, []);

    return (
        <ChatbotContext.Provider value={{ dashboardData, updateSnapshot }}>
            {children}
        </ChatbotContext.Provider>
    );
};
