// src/layouts/SharedLayout.jsx
import { Outlet, useNavigate, useLocation } from 'react-router-dom'

const GridIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
    <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
  </svg>
)
const DocIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/>
    <line x1="16" y1="17" x2="8" y2="17"/>
  </svg>
)
const TruckIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/>
    <circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
  </svg>
)
const BellIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
    <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
  </svg>
)
const BackIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2">
    <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
  </svg>
)

const NAV_ITEMS = [
  { label: 'Overview',  icon: <GridIcon />,  path: '/retailer' },
  { label: 'Orders',    icon: <DocIcon />,   path: '/retailer/orders' },
  { label: 'Delivery',  icon: <TruckIcon />, path: '/retailer/delivery' },
  { label: 'Alerts',    icon: <BellIcon />,  path: '/retailer/alerts', badge: 2 },
]

export default function SharedLayout() {
  const navigate = useNavigate()
  const location = useLocation()

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden', fontFamily: "'Inter', system-ui, sans-serif", position: 'fixed', top: 0, left: 0 }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap'); * { box-sizing: border-box; margin: 0; padding: 0; }`}</style>

      {/* ── Sidebar ── */}
      <aside style={{
        width: 155, minWidth: 155, background: 'linear-gradient(180deg, #16022e 0%, #2d0a52 45%, #521278 100%)',
        display: 'flex', flexDirection: 'column',
        position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 100, boxShadow: '2px 0 20px rgba(0,0,0,0.25)',
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '18px 14px 16px' }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,255,255,0.12)',border: '1px solid rgba(255,255,255,0.18)', borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 12, flexShrink: 0 }}>CL</div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ color: '#fff', fontWeight: 700, fontSize: 13, lineHeight: 1.2 }}>CargoLink</span>
            <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 9, fontWeight: 600, letterSpacing: 0.5 }}>RETAILER PORTAL</span>
          </div>
        </div>

        {/* Nav section label */}
        <div style={{ padding: '10px 14px 4px', color: '#6B7280', fontSize: 9, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase' }}>Main Menu</div>

        {/* Nav items — driven by NAV_ITEMS array above */}
        {NAV_ITEMS.map(item => {
          // Match exact path for Overview, prefix match for others
          const active = item.path === '/retailer'
            ? location.pathname === '/retailer' || location.pathname === '/retailer/'
            : location.pathname.startsWith(item.path)

          return (
            <div
              key={item.path}
              onClick={() => navigate(item.path)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 14px', cursor: 'pointer',
                color: active ? '#fff' : '#9CA3AF',
                background: active ? 'rgba(255,255,255,0.14)' : 'transparent',
                borderRadius: active ? 6 : 0,
                margin: active ? '1px 6px' : '1px 0',
                position: 'relative',
                borderRadius: 8,
                transition: 'background 0.12s',
                fontSize: 13, fontWeight: active ? 600 : 400,
              }}
            >
              {item.icon}
              {item.label}
              {item.badge && (
                <span style={{ background: '#EF4444', color: '#fff', borderRadius: 10, fontSize: 10, fontWeight: 700, padding: '1px 5px', marginLeft: 'auto' }}>
                  {item.badge}
                </span>
              )}
            </div>
          )
        })}

        {/* Navigation section */}
        <div style={{ padding: '14px 14px 4px', color: '#6B7280', fontSize: 9, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', marginTop: 12 }}>Navigation</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 14px', color: '#9CA3AF', fontSize: 12, cursor: 'pointer' }}>
          <BackIcon /> Back to Hub
        </div>

        {/* User row */}
        <div style={{ marginTop: 'auto', borderTop: '1px solid #2D2A6E', padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#4F46E5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 10 }}>RT</div>
            <span style={{ color: '#D1D5DB', fontSize: 12, fontWeight: 500 }}>Retail Team</span>
          </div>
          <div style={{ color: '#9CA3AF', cursor: 'pointer' }}><BellIcon size={14} /></div>
        </div>
      </aside>

      {/* ── Page content renders here ── */}
      <div style={{ marginLeft: 155, flex: 1, display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
        <Outlet />
      </div>
    </div>
  )
}