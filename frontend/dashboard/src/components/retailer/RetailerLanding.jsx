import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function RetailerLanding() {
  const navigate = useNavigate();

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      height: '100%', minHeight: '80vh', width: '100%', color: 'var(--text-primary)'
    }}>
      <div style={{
        background: 'var(--bg-card)', padding: '4rem 3rem', borderRadius: '16px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.3)', textAlign: 'center', border: '1px solid var(--border-color)',
        animation: 'fadeIn 0.5s ease-out'
      }}>
        <h1 style={{ fontSize: '2.5rem', marginBottom: '1.5rem', color: 'var(--accent-green)' }}>
          Enter retailer dashboard
        </h1>
        <p style={{ marginBottom: '2.5rem', fontSize: '1.1rem', color: 'var(--text-secondary)' }}>
          Manage your inventory, incoming shipments, and cargo quality reports.
        </p>
        <button
          onClick={() => navigate('/retailer/dashboard')}
          style={{
            padding: '1rem 3rem', fontSize: '1.25rem', fontWeight: 'bold',
            background: 'var(--accent-green)', color: '#000', border: 'none',
            borderRadius: '8px', cursor: 'pointer', transition: 'all 0.3s ease',
            boxShadow: '0 4px 15px rgba(0, 255, 128, 0.4)'
          }}
          onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(0, 255, 128, 0.6)'; }}
          onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 15px rgba(0, 255, 128, 0.4)'; }}
        >
          Proceed
        </button>
      </div>
    </div>
  );
}
