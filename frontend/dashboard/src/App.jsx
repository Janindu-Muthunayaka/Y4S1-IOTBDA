import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import TripsTable from './components/TripsTable';
import TripAnalytics from './components/TripAnalytics';

export default function App() {
  return (
    <div className="dashboard-container">
      <h1 className="header-title">Cold-Chain Logistics Nexus</h1>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<TripsTable />} />
          <Route path="/trip/:id" element={<TripAnalytics />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}
