import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useChatbot } from '../Retail_Chatbot/Retail_ChatbotContext';

const MOCK_DATA = {
  'TRP-2048': {
    qualityScore: 87,
    qualityLabel: '↑ Good — resalable',
    qualityColor: '#10B981',
    tripRisk: 'Warning',
    tripRiskColor: '#F59E0B',
    tripRiskScore: 64,
    anomalies: 2,
    temperature: '2.4°C',
    tempStatus: '✓ Within safe limits (0–4°C)',
    tempColor: '#10B981',
    deliveryWeight: '142 kg',
    weightNote: '⚠ -3 kg from loaded weight',
    weightNoteColor: '#F59E0B',
    loadedWeight: 145,
    exitWeight: 142,
    discrepancy: '-3 kg discrepancy',
    progressBars: [
      { label: 'Temperature Integrity', score: 78, color: '#10B981' },
      { label: 'Vibration / Handling', score: 62, color: '#F59E0B' },
      { label: 'Weight Integrity', score: 100, color: '#10B981' },
    ],
    deliveries: [
      {
        id: 'Delivery 1',
        status: 'Completed',
        alerts: [
          { color: '#10B981', title: 'Delivery completed successfully', time: '14:00 PM', sensor: 'GPS Unit', severity: 'Safe', severityColor: '#10B981' },
        ],
      },
      {
        id: 'Delivery 2',
        status: 'Flagged',
        alerts: [
          { color: '#EF4444', title: 'Temperature exceeded safe zone', time: '14:32 PM', sensor: 'Sensor T-04', severity: 'Critical', severityColor: '#EF4444' },
          { color: '#F59E0B', title: 'High vibration spike detected', time: '15:10 PM', sensor: 'Shock Sensor S-01', severity: 'Warning', severityColor: '#F59E0B' },
          { color: '#F59E0B', title: 'Weight discrepancy at exit gate', time: '16:05 PM', sensor: 'Exit Gate Scale', severity: 'Warning', severityColor: '#F59E0B' },
        ],
      },
      {
        id: 'Delivery 3',
        status: 'Accepted',
        alerts: [
          { color: '#10B981', title: 'Accepted after quality review', time: '17:00 PM', sensor: 'QA Team', severity: 'Safe', severityColor: '#10B981' },
        ],
      },
    ],
  },

  'TRP-2049': {
    qualityScore: 94,
    qualityLabel: '↑ Excellent — prime grade',
    qualityColor: '#10B981',
    tripRisk: 'Safe',
    tripRiskColor: '#10B981',
    tripRiskScore: 22,
    anomalies: 0,
    temperature: '1.8°C',
    tempStatus: '✓ Within safe limits (0–4°C)',
    tempColor: '#10B981',
    deliveryWeight: '210 kg',
    weightNote: '✓ Matches loaded weight',
    weightNoteColor: '#10B981',
    loadedWeight: 210,
    exitWeight: 210,
    discrepancy: '0 kg discrepancy',
    progressBars: [
      { label: 'Temperature Integrity', score: 96, color: '#10B981' },
      { label: 'Vibration / Handling', score: 91, color: '#10B981' },
      { label: 'Weight Integrity', score: 100, color: '#10B981' },
    ],
    deliveries: [
      {
        id: 'Delivery 1',
        status: 'Completed',
        alerts: [
          { color: '#10B981', title: 'All systems nominal', time: '09:00 AM', sensor: 'All Sensors', severity: 'Safe', severityColor: '#10B981' },
          { color: '#10B981', title: 'Delivery completed on schedule', time: '11:45 AM', sensor: 'GPS Unit', severity: 'Safe', severityColor: '#10B981' },
        ],
      },
      {
        id: 'Delivery 2',
        status: 'Accepted',
        alerts: [
          { color: '#F59E0B', title: 'Minor route deviation logged', time: '10:22 AM', sensor: 'Nav System', severity: 'Warning', severityColor: '#F59E0B' },
        ],
      },
    ],
  },

  'TRP-2050': {
    qualityScore: 61,
    qualityLabel: '↓ Poor — review required',
    qualityColor: '#EF4444',
    tripRisk: 'Critical',
    tripRiskColor: '#EF4444',
    tripRiskScore: 88,
    anomalies: 5,
    temperature: '6.1°C',
    tempStatus: '✗ Exceeded safe limits (0–4°C)',
    tempColor: '#EF4444',
    deliveryWeight: '178 kg',
    weightNote: '⚠ -12 kg from loaded weight',
    weightNoteColor: '#EF4444',
    loadedWeight: 190,
    exitWeight: 178,
    discrepancy: '-12 kg discrepancy',
    progressBars: [
      { label: 'Temperature Integrity', score: 41, color: '#EF4444' },
      { label: 'Vibration / Handling', score: 55, color: '#F59E0B' },
      { label: 'Weight Integrity', score: 70, color: '#F59E0B' },
    ],
    deliveries: [
      {
        id: 'Delivery 1',
        status: 'Flagged',
        alerts: [
          { color: '#EF4444', title: 'Critical temperature breach', time: '08:15 AM', sensor: 'Sensor T-01', severity: 'Critical', severityColor: '#EF4444' },
          { color: '#EF4444', title: 'Significant weight loss detected', time: '09:30 AM', sensor: 'Exit Gate Scale', severity: 'Critical', severityColor: '#EF4444' },
        ],
      },
      {
        id: 'Delivery 2',
        status: 'Flagged',
        alerts: [
          { color: '#F59E0B', title: 'Multiple vibration events', time: '10:05 AM', sensor: 'Shock Sensor S-03', severity: 'Warning', severityColor: '#F59E0B' },
        ],
      },
      {
        id: 'Delivery 3',
        status: 'Accepted',
        alerts: [
          { color: '#10B981', title: 'Manually accepted by manager', time: '12:00 PM', sensor: 'QA Team', severity: 'Safe', severityColor: '#10B981' },
        ],
      },
    ],
  },
}

const DATES = ['April 24, 2026', 'April 25, 2026', 'April 26, 2026']
const ORDER_TRIPS = ['TRP-2048', 'TRP-2049', 'TRP-2050']
const DELIVERY_STATUSES = ['All Deliveries', 'Completed', 'Accepted', 'Flagged']

// SVG Icons
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
    <line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
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
const StarIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#818CF8" strokeWidth="2">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
  </svg>
)
const WarnIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
    <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
)
const ThermIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#06B6D4" strokeWidth="2">
    <path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"/>
  </svg>
)
const ScaleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2">
    <line x1="12" y1="3" x2="12" y2="21"/><path d="M3 9l9-7 9 7"/>
    <path d="M3 15l9 7 9-7"/>
  </svg>
)
const CalIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
    <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
    <line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
)
const ChevronIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2">
    <polyline points="6 9 12 15 18 9"/>
  </svg>
)
const BackIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2">
    <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
  </svg>
)
const InfoIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2">
    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/>
    <line x1="12" y1="16" x2="12.01" y2="16"/>
  </svg>
)

// Gauge SVG
function TripGauge({ score, label, color }) {
  const r = 80
  const cx = 120
  const cy = 110
  const totalArc = Math.PI
  const startAngle = Math.PI

  const arcPath = (fromPct, toPct, strokeColor) => {
    const from = startAngle + fromPct * totalArc
    const to = startAngle + toPct * totalArc
    const x1 = cx + r * Math.cos(from)
    const y1 = cy + r * Math.sin(from)
    const x2 = cx + r * Math.cos(to)
    const y2 = cy + r * Math.sin(to)
    const large = (toPct - fromPct) > 0.5 ? 1 : 0
    return (
      <path
        d={`M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`}
        stroke={strokeColor}
        strokeWidth="22"
        fill="none"
        strokeLinecap="butt"
      />
    )
  }

  const needlePct = score / 100
  const needleAngle = startAngle + needlePct * totalArc
  const nx = cx + (r - 5) * Math.cos(needleAngle)
  const ny = cy + (r - 5) * Math.sin(needleAngle)

  return (
    <svg width="240" height="140" viewBox="0 0 240 140">
      {arcPath(0, 0.4, '#10B981')}
      {arcPath(0.4, 0.7, '#F59E0B')}
      {arcPath(0.7, 1.0, '#EF4444')}
      <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="#1F2937" strokeWidth="2.5" strokeLinecap="round"/>
      <circle cx={cx} cy={cy} r="5" fill="#1F2937"/>
      <text x={cx} y={cy + 22} textAnchor="middle" fontSize="15" fontWeight="700" fill={color}>{label}</text>
      <text x={cx} y={cy + 36} textAnchor="middle" fontSize="11" fill="#6B7280">Score: {score}/100</text>
    </svg>
  )
}

// Weight Bar Chart
function WeightChart({ loaded, exit, discrepancy }) {
  const maxH = 120
  const maxW = loaded > exit ? loaded : exit
  const loadedH = (loaded / maxW) * maxH
  const exitH = (exit / maxW) * maxH

  return (
    <div style={{ position: 'relative', padding: '0 24px 0 60px', marginTop: 16 }}>
      <div style={{ position: 'relative', height: maxH + 80 }}>
        <div style={{
          position: 'absolute',
          top: maxH - loadedH + 10,
          left: 0,
          right: 0,
          borderTop: '2px dashed #F59E0B',
          zIndex: 1,
        }}>
          <span style={{ position: 'absolute', left: -55, top: -10, fontSize: 10, color: '#F59E0B', fontWeight: 700, letterSpacing: 1 }}>EXPECTED</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 40, height: maxH + 20, paddingTop: 10, position: 'relative', zIndex: 2, justifyContent: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#1F2937', marginBottom: 6 }}>{loaded} kg</div>
            <div style={{ width: 80, height: loadedH, background: '#3B82F6', borderRadius: '4px 4px 0 0' }}/>
            <div style={{ fontSize: 12, color: '#6B7280', marginTop: 8 }}>Loaded Weight</div>
          </div>
          <div style={{
            position: 'absolute',
            top: maxH - Math.min(loadedH, exitH) / 2 - 10,
            left: '50%',
            transform: 'translateX(-50%)',
            background: '#EF4444',
            color: '#fff',
            borderRadius: 20,
            padding: '4px 12px',
            fontSize: 12,
            fontWeight: 600,
            whiteSpace: 'nowrap',
            zIndex: 10,
          }}>{discrepancy}</div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#1F2937', marginBottom: 6 }}>{exit} kg</div>
            <div style={{ width: 80, height: exitH, background: '#818CF8', borderRadius: '4px 4px 0 0' }}/>
            <div style={{ fontSize: 12, color: '#6B7280', marginTop: 8 }}>Exit Weight</div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function RetailerHome() {
  const [dateIdx, setDateIdx] = useState(0)
  const [orderTrip, setOrderTrip] = useState('TRP-2048')
  const [deliveryFilter, setDeliveryFilter] = useState('All Deliveries')
  const [time, setTime] = useState('')
  const navigate = useNavigate()

  // ── CHANGED: reset delivery filter whenever the order changes ──
  const handleOrderChange = (newOrder) => {
    setOrderTrip(newOrder)
    setDeliveryFilter('All Deliveries')
  }

  useEffect(() => {
    const style = document.createElement('style')
    style.textContent = `@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body, #root { height: 100%; width: 100%; overflow: hidden; }
    body { font-family: 'Inter', sans-serif; }`
    document.head.appendChild(style)
    return () => document.head.removeChild(style)
  }, [])

  useEffect(() => {
    const tick = () => {
      const now = new Date()
      setTime(now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }))
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  const { updateSnapshot } = useChatbot();

  const data = MOCK_DATA[orderTrip]

  useEffect(() => {
    updateSnapshot({
      trip: { trip_id: orderTrip, truck_id: 'N/A', status: 'DELIVERED' },
      sensorData: null,
      kpis: {
        qualityScore: data.qualityScore,
        tempCompliance: data.qualityScore,
        shocks: [],
        cold: [],
        hot: data.qualityLabel === 'Critical' ? [{ time: 'N/A', avg: '5.0' }] : [],
      }
    });
  }, [orderTrip, data]);

  // ── CHANGED: compute filtered deliveries and their merged alerts ──
  const filteredDeliveries = deliveryFilter === 'All Deliveries'
    ? data.deliveries
    : data.deliveries.filter(d => d.status === deliveryFilter)

  const visibleAlerts = filteredDeliveries.flatMap(d => d.alerts)

  const exportCSV = () => {
    const rows = [
      ['Type', 'Weight (kg)'],
      ['Loaded Weight', data.loadedWeight],
      ['Exit Weight', data.exitWeight],
      ['Discrepancy', data.loadedWeight - data.exitWeight],
    ]
    const csv = rows.map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `weight-comparison-${orderTrip}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const s = {
    root: {
      display: 'flex',
      height: '100vh',
      width: '100vw',
      fontFamily: "'Inter', sans-serif",
      overflow: 'hidden',
      position: 'fixed',
      top: 0,
      left: 0,
    },
    sidebar: {
      width: 155,
      minWidth: 155,
      background: '#1E1B4B',
      display: 'flex',
      flexDirection: 'column',
      padding: '0',
      position: 'fixed',
      top: 0,
      left: 0,
      bottom: 0,
      zIndex: 100,
    },
    logoArea: { display: 'flex', alignItems: 'center', gap: 10, padding: '18px 14px 16px' },
    logoAvatar: { width: 32, height: 32, borderRadius: '50%', background: '#4F46E5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 12, flexShrink: 0 },
    logoText: { display: 'flex', flexDirection: 'column' },
    logoTitle: { color: '#fff', fontWeight: 700, fontSize: 13, lineHeight: 1.2 },
    logoSub: { color: '#818CF8', fontSize: 9, fontWeight: 600, letterSpacing: 0.5 },
    navSection: { padding: '10px 14px 4px', color: '#6B7280', fontSize: 9, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase' },
    navItem: (active) => ({
      display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', cursor: 'pointer',
      color: active ? '#fff' : '#9CA3AF', background: active ? '#3730A3' : 'transparent',
      borderRadius: active ? 6 : 0, margin: active ? '1px 6px' : '1px 0',
      fontSize: 13, fontWeight: active ? 600 : 400, position: 'relative',
    }),
    badge: { background: '#EF4444', color: '#fff', borderRadius: 10, fontSize: 10, fontWeight: 700, padding: '1px 5px', marginLeft: 'auto' },
    backLink: { display: 'flex', alignItems: 'center', gap: 6, padding: '10px 14px', color: '#9CA3AF', fontSize: 12, cursor: 'pointer' },
    sidebarBottom: { marginTop: 'auto', borderTop: '1px solid #2D2A6E', padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
    userRow: { display: 'flex', alignItems: 'center', gap: 8 },
    userAvatar: { width: 28, height: 28, borderRadius: '50%', background: '#4F46E5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 10, flexShrink: 0 },
    userName: { color: '#D1D5DB', fontSize: 12, fontWeight: 500 },
    main: { marginLeft: 155, flex: 1, display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' },
    topHeader: { background: '#fff', borderBottom: '1px solid #E5E7EB', padding: '10px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 },
    breadcrumb: { color: '#6B7280', fontSize: 13 },
    breadcrumbActive: { color: '#111827', fontWeight: 500 },
    headerRight: { display: 'flex', alignItems: 'center', gap: 12 },
    liveIndicator: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#374151' },
    greenDot: { width: 8, height: 8, borderRadius: '50%', background: '#10B981', flexShrink: 0 },
    btnOutline: { border: '1px solid #4F46E5', color: '#4F46E5', background: 'transparent', borderRadius: 6, padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' },
    btnSolid: { background: '#4F46E5', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' },
    content: { flex: 1, overflowY: 'auto', background: '#F8F8FC', padding: '24px' },
    pageTitle: { fontSize: 24, fontWeight: 800, color: '#111827', marginBottom: 2 },
    pageSubtitle: { fontSize: 13, color: '#6B7280', marginBottom: 20 },
    orderBanner: { background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    orderBannerTitle: { fontSize: 14, fontWeight: 700, color: '#111827' },
    card: { background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10 },
    filtersCard: { background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: '14px 16px', display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' },
    filterControl: { display: 'flex', alignItems: 'center', gap: 8, border: '1px solid #E5E7EB', borderRadius: 6, padding: '7px 12px', background: '#F9FAFB', cursor: 'pointer', fontSize: 13, color: '#374151', minWidth: 160 },
    statsRow: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 20 },
    statCard: { background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: '16px', position: 'relative' },
    statLabel: { fontSize: 11, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
    statIcon: { position: 'absolute', top: 14, right: 14 },
    statValue: (color) => ({ fontSize: 30, fontWeight: 800, color, marginBottom: 4, lineHeight: 1.1 }),
    statSub: (color) => ({ fontSize: 12, color: color || '#6B7280' }),
    midRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 },
    panelCard: { background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: '18px' },
    panelTitle: { fontSize: 15, fontWeight: 700, color: '#111827', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 },
    progressRow: { marginBottom: 14 },
    progressLabel: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 },
    progressLabelText: { fontSize: 13, color: '#374151' },
    scoreBadge: { fontSize: 12, fontWeight: 600, color: '#374151', background: '#F3F4F6', borderRadius: 4, padding: '2px 6px' },
    progressBg: { height: 8, background: '#F3F4F6', borderRadius: 4, overflow: 'hidden' },
    hintText: { fontSize: 11, color: '#9CA3AF', fontStyle: 'italic', marginTop: 8 },
    gaugeLegend: { display: 'flex', justifyContent: 'center', gap: 16, fontSize: 12, color: '#6B7280', marginTop: 4 },
    legendDot: (c) => ({ width: 8, height: 8, borderRadius: '50%', background: c, display: 'inline-block', marginRight: 4 }),
    weightCard: { background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: '18px', marginBottom: 20 },
    weightHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
    exportBtn: { fontSize: 12, color: '#4F46E5', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 },
    alertsCard: { background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: '18px' },
    alertsHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
    seeAll: { fontSize: 12, color: '#4F46E5', fontWeight: 600, cursor: 'pointer', textDecoration: 'none' },
    alertRow: { display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid #F3F4F6' },
    alertDot: (c) => ({ width: 10, height: 10, borderRadius: '50%', background: c, flexShrink: 0 }),
    alertContent: { flex: 1 },
    alertTitle: { fontSize: 13, fontWeight: 600, color: '#111827' },
    alertMeta: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
    severityBadge: (c) => ({ fontSize: 13, fontWeight: 700, color: c, border: `1.5px solid ${c}`, borderRadius: 6, padding: '6px 18px', whiteSpace: 'nowrap', alignSelf: 'center', minWidth: 90, textAlign: 'center' }),
  }

  return (
    <div style={s.root}>
      <div style={s.main}>
        {/* Top Header */}
        <header style={s.topHeader}>
          <div style={s.breadcrumb}>
            Retailer <span style={{ color: '#9CA3AF' }}>/</span> <span style={s.breadcrumbActive}>Overview</span>
          </div>
          <div style={s.headerRight}>
            <div style={s.liveIndicator}>
              <div style={s.greenDot}/>
              <strong>Live</strong>&nbsp; Updated {time || '12:48:44 PM'}
            </div>
            <button style={s.btnOutline}>Real-Time Stream</button>
            <button style={s.btnSolid}>Refresh Data</button>
          </div>
        </header>

        {/* Content */}
        <div style={s.content}>
          <h1 style={s.pageTitle}>Overview</h1>
          <p style={s.pageSubtitle}>Order #{orderTrip} · {DATES[dateIdx]}</p>

          {/* Order Banner */}
          <div style={s.orderBanner}>
            <span style={s.orderBannerTitle}>Order #{orderTrip}</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#4F46E5' }}>Fish Quality Score: {data.qualityScore}</span>
          </div>

          {/* ── FILTERS — CHANGED SECTION ── */}
          <div style={s.filtersCard}>
            {/* Date picker (unchanged) */}
            <div style={s.filterControl} onClick={() => setDateIdx((dateIdx + 1) % DATES.length)}>
              <CalIcon /> {DATES[dateIdx]}
            </div>

            {/* Order ID dropdown — now calls handleOrderChange */}
            <div style={{ ...s.filterControl, position: 'relative' }}>
              <select
                value={orderTrip}
                onChange={e => handleOrderChange(e.target.value)}
                style={{ border: 'none', background: 'transparent', fontSize: 13, color: '#374151', cursor: 'pointer', appearance: 'none', paddingRight: 20, outline: 'none', width: '100%' }}
              >
                {ORDER_TRIPS.map(t => (
                  <option key={t} value={t}>Order #{t}</option>
                ))}
              </select>
              <span style={{ position: 'absolute', right: 10, pointerEvents: 'none' }}><ChevronIcon /></span>
            </div>

            {/* Deliveries dropdown — shows Completed / Accepted / Flagged counts per order */}
            <div style={{ ...s.filterControl, position: 'relative' }}>
              <select
                value={deliveryFilter}
                onChange={e => setDeliveryFilter(e.target.value)}
                style={{ border: 'none', background: 'transparent', fontSize: 13, color: '#374151', cursor: 'pointer', appearance: 'none', paddingRight: 20, outline: 'none', width: '100%' }}
              >
                <option value="All Deliveries">All Deliveries ({data.deliveries.length})</option>
                {DELIVERY_STATUSES.filter(st => st !== 'All Deliveries').map(status => {
                  const count = data.deliveries.filter(d => d.status === status).length
                  return count > 0 ? (
                    <option key={status} value={status}>{status} ({count})</option>
                  ) : null
                })}
              </select>
              <span style={{ position: 'absolute', right: 10, pointerEvents: 'none' }}><ChevronIcon /></span>
            </div>
          </div>
          {/* ── END FILTERS ── */}

          {/* Stats Row (unchanged) */}
          <div style={s.statsRow}>
            <div style={s.statCard}>
              <div style={s.statLabel}>Fish Quality Score</div>
              <div style={s.statIcon}><StarIcon /></div>
              <div style={s.statValue('#4F46E5')}>{data.qualityScore}</div>
              <div style={s.statSub(data.qualityColor)}>{data.qualityLabel}</div>
            </div>
            <div style={s.statCard}>
              <div style={s.statLabel}>Trip Risk</div>
              <div style={s.statIcon}><WarnIcon /></div>
              <div style={s.statValue(data.tripRiskColor)}>{data.tripRisk}</div>
              <div style={s.statSub('#F59E0B')}>⚠ {data.anomalies} anomalies detected</div>
            </div>
            <div style={s.statCard}>
              <div style={s.statLabel}>Temperature Status</div>
              <div style={s.statIcon}><ThermIcon /></div>
              <div style={s.statValue(data.tempColor)}>{data.temperature}</div>
              <div style={s.statSub(data.tempColor)}>{data.tempStatus}</div>
            </div>
            <div style={s.statCard}>
              <div style={s.statLabel}>Delivery Weight</div>
              <div style={s.statIcon}><ScaleIcon /></div>
              <div style={s.statValue('#4F46E5')}>{data.deliveryWeight}</div>
              <div style={s.statSub(data.weightNoteColor)}>{data.weightNote}</div>
            </div>
          </div>

          {/* Mid Row (unchanged) */}
          <div style={s.midRow}>
            <div style={s.panelCard}>
              <div style={s.panelTitle}>Quality Score Breakdown <InfoIcon /></div>
              {data.progressBars.map((bar, i) => (
                <div key={i} style={s.progressRow}>
                  <div style={s.progressLabel}>
                    <span style={s.progressLabelText}>{bar.label}</span>
                    <span style={s.scoreBadge}>{bar.score}/100</span>
                  </div>
                  <div style={s.progressBg}>
                    <div style={{ height: '100%', width: `${bar.score}%`, background: bar.color, borderRadius: 4, transition: 'width 0.5s ease' }}/>
                  </div>
                </div>
              ))}
              <p style={s.hintText}>Click score card above to see full breakdown modal</p>
            </div>
            <div style={s.panelCard}>
              <div style={s.panelTitle}>Trip Risk</div>
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <TripGauge score={data.tripRiskScore} label={data.tripRisk} color={data.tripRiskColor} />
              </div>
              <div style={s.gaugeLegend}>
                <span><span style={s.legendDot('#10B981')}/>Safe</span>
                <span><span style={s.legendDot('#F59E0B')}/>Warning</span>
                <span><span style={s.legendDot('#EF4444')}/>Critical</span>
              </div>
            </div>
          </div>

          {/* Weight Chart (unchanged) */}
          <div style={s.weightCard}>
            <div style={s.weightHeader}>
              <span style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>Weight Comparison — Loaded vs Exit</span>
              <button style={s.exportBtn} onClick={exportCSV}>↓ Export CSV</button>
            </div>
            <WeightChart loaded={data.loadedWeight} exit={data.exitWeight} discrepancy={data.discrepancy} />
          </div>

          {/* ── ALERTS — CHANGED: now uses visibleAlerts from filtered deliveries ── */}
          <div style={s.alertsCard}>
            <div style={s.alertsHeader}>
              <span style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>
                Recent Alerts
                {deliveryFilter !== 'All Deliveries' && (
                  <span style={{ fontSize: 12, fontWeight: 400, color: '#9CA3AF', marginLeft: 8 }}>
                    — {deliveryFilter}
                  </span>
                )}
              </span>
              <a style={s.seeAll} href="#" onClick={e => { e.preventDefault(); navigate('/retailer/alerts') }}>See all alerts →</a>
            </div>
            {visibleAlerts.length === 0 ? (
              <p style={{ color: '#9CA3AF', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>
                No alerts for the selected delivery filter.
              </p>
            ) : (
              visibleAlerts.map((alert, i) => (
                <div key={i} style={{ ...s.alertRow, borderBottom: i < visibleAlerts.length - 1 ? '1px solid #F3F4F6' : 'none' }}>
                  <div style={s.alertDot(alert.color)}/>
                  <div style={s.alertContent}>
                    <div style={s.alertTitle}>{alert.title}</div>
                    <div style={s.alertMeta}>{alert.time} — {alert.sensor}</div>
                  </div>
                  <div style={s.severityBadge(alert.severityColor)}>{alert.severity}</div>
                </div>
              ))
            )}
          </div>
          {/* ── END ALERTS ── */}

        </div>
      </div>
    </div>
  )
}