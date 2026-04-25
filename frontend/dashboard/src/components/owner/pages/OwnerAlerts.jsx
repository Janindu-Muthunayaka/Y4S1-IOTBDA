import React, { useMemo, useState } from 'react';
import { computeQuality, riskStatus, timeAgo, fmtDate } from './OwnerHome';

// ─── Alert Builder ────────────────────────────────────────────────────────────
function buildAlerts(trips, liveData) {
  const alerts = [];

  trips.forEach(trip => {
    const sensors = liveData[trip.trip_id];
    const temps = sensors?.temperature_data || [];
    const motions = sensors?.motion_data || [];
    const quality = computeQuality(sensors);

    // Temperature Breach (aggregate to 1 per trip)
    const critTemps = temps.filter(t => Number(t.avg) > -18);
    if (critTemps.length > 0) {
      const maxTempReading = critTemps.reduce((max, t) => Number(t.avg) > Number(max.avg) ? t : max, critTemps[0]);
      const maxVal = Number(maxTempReading.avg);
      alerts.push({
        id: `temp-${trip.trip_id}`,
        type: 'crit',
        category: 'temperature',
        kind: 'High Temperature',
        truck_id: trip.truck_id,
        trip_id: trip.trip_id,
        time: sensors?.last_updated || trip.timestamp,
        timeLabel: maxTempReading.time,
        desc: `Temperature breached safe threshold for ${critTemps.length} readings, peaking at ${maxVal.toFixed(1)}°C.`,
        icon: '🌡️',
        value: `${maxVal.toFixed(1)}°C`,
      });
    }

    // Vibration spikes (aggregate to 1 per trip)
    const shockMotions = motions.filter(m => m.max_accel > 0.5);
    if (shockMotions.length > 0) {
      const maxMotion = shockMotions.reduce((max, m) => m.max_accel > max.max_accel ? m : max, shockMotions[0]);
      alerts.push({
        id: `vib-${trip.trip_id}`,
        type: 'warn',
        category: 'vibration',
        kind: 'Vibration Spikes',
        truck_id: trip.truck_id,
        trip_id: trip.trip_id,
        time: sensors?.last_updated || trip.timestamp,
        timeLabel: maxMotion.time,
        desc: `Registered ${shockMotions.length} significant force spikes (peak: ${maxMotion.max_accel.toFixed(2)}g).`,
        icon: '⚡',
        value: `${maxMotion.max_accel.toFixed(2)}g`,
      });
    }

    // Weight anomaly
    if (trip.weight1 != null && trip.weight2 != null && trip.weight1 > 0) {
      const loss = ((trip.weight1 - trip.weight2) / trip.weight1) * 100;
      if (Math.abs(loss) > 5) {
        alerts.push({
          id: `weight-${trip.trip_id}`,
          type: 'warn',
          category: 'weight',
          kind: 'Weight Anomaly',
          truck_id: trip.truck_id,
          trip_id: trip.trip_id,
          time: trip.timestamp,
          timeLabel: null,
          desc: `Load cell sensors indicate a ${Math.abs(loss).toFixed(1)}% drop in cargo weight`,
          icon: '⚖️',
          value: `${Math.abs(loss).toFixed(1)}%`,
        });
      }
    }

    // Low quality
    if (quality < 70) {
      alerts.push({
        id: `quality-${trip.trip_id}`,
        type: 'crit',
        category: 'quality',
        kind: 'Low Quality Score',
        truck_id: trip.truck_id,
        trip_id: trip.trip_id,
        time: sensors?.last_updated || trip.timestamp,
        timeLabel: null,
        desc: `Quality score dropped to ${quality}% — immediate inspection required`,
        icon: '📉',
        value: `${quality}%`,
      });
    }
  });

  return alerts.sort((a, b) => new Date(b.time) - new Date(a.time));
}

// ─── Alert Row ────────────────────────────────────────────────────────────────
function AlertRow({ alert, isFirst }) {
  const isCrit = alert.type === 'crit';
  const borderColor = isCrit ? '#dc2626' : '#d97706';
  const bgColor = isCrit ? '#fef2f2' : '#fffbeb';
  const textColor = isCrit ? '#dc2626' : '#d97706';
  const badgeCls = isCrit ? 'o-badge--crit' : 'o-badge--warn';

  const fmtTime = d => {
    if (!d) return '--';
    return new Date(d).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-start',
      gap: '1rem',
      padding: '1rem 1.25rem',
      borderBottom: '1px solid #f0f2f8',
      transition: 'background 0.12s',
      cursor: 'default',
    }}
      onMouseEnter={e => e.currentTarget.style.background = '#fafbfd'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >
      {/* Icon */}
      <div style={{
        width: 40, height: 40, borderRadius: 11,
        background: bgColor, border: `1px solid ${borderColor}22`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '1.1rem', flexShrink: 0, marginTop: '0.1rem',
      }}>
        {alert.icon}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.25rem' }}>
          <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#0f1523' }}>
            {alert.kind}
          </span>
          <span className={`o-badge ${badgeCls} o-badge--dot`}>
            {isCrit ? 'CRITICAL' : 'WARNING'}
          </span>
        </div>
        <div style={{ fontSize: '0.8rem', color: '#5b6478', lineHeight: 1.5, marginBottom: '0.3rem' }}>
          {alert.desc}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', flexWrap: 'wrap' }}>
          <span style={{
            background: '#f3f4f6', border: '1px solid #e5e7eb',
            padding: '0.12rem 0.5rem', borderRadius: 5,
            fontSize: '0.7rem', fontFamily: 'monospace', fontWeight: 800,
            color: '#374151',
          }}>
            {alert.truck_id}
          </span>
          <span style={{ fontSize: '0.7rem', color: '#9ca3af', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            🕐 {alert.timeLabel || fmtTime(alert.time)}
          </span>
          <span style={{ fontSize: '0.7rem', color: '#9ca3af' }}>
            {timeAgo(alert.time)}
          </span>
        </div>
      </div>

      {/* Value pill */}
      <div style={{
        background: bgColor,
        border: `1px solid ${borderColor}33`,
        borderRadius: 8,
        padding: '0.4rem 0.75rem',
        textAlign: 'center',
        flexShrink: 0,
        minWidth: 60,
      }}>
        <div style={{ fontSize: '1rem', fontWeight: 900, color: textColor, letterSpacing: '-0.02em' }}>
          {alert.value}
        </div>
        <div style={{ fontSize: '0.62rem', color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '0.1rem' }}>
          {alert.category}
        </div>
      </div>
    </div>
  );
}

// ─── Vertical Timeline ────────────────────────────────────────────────────────
function VerticalTimeline({ alerts }) {
  // Group by date
  const groups = {};
  alerts.forEach(a => {
    const d = fmtDate(a.time);
    if (!groups[d]) groups[d] = [];
    groups[d].push(a);
  });

  const fmtTime = d => {
    if (!d) return '';
    return new Date(d).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div style={{ padding: '0.25rem 1.5rem 1.25rem' }}>
      {Object.entries(groups).map(([date, items]) => (
        <div key={date}>
          {/* Date separator */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '0.75rem',
            margin: '1.25rem 0 0.875rem',
          }}>
            <div style={{ height: 1, flex: 1, background: '#f0f2f8' }} />
            <span style={{
              fontSize: '0.68rem', fontWeight: 700, color: '#9ca3af',
              textTransform: 'uppercase', letterSpacing: '0.07em',
              whiteSpace: 'nowrap',
            }}>
              📅 {date}
            </span>
            <div style={{ height: 1, flex: 1, background: '#f0f2f8' }} />
          </div>

          {/* Timeline items */}
          {items.map((a, i) => {
            const isCrit = a.type === 'crit';
            const dotColor = isCrit ? '#dc2626' : '#d97706';
            const bgColor = isCrit ? '#fef2f2' : '#fffbeb';
            const isLast = i === items.length - 1;

            return (
              <div key={a.id} style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start', position: 'relative' }}>
                {/* Timeline spine */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, paddingTop: '0.15rem' }}>
                  <div style={{
                    width: 11, height: 11, borderRadius: '50%',
                    background: dotColor,
                    border: `2px solid #fff`,
                    boxShadow: `0 0 0 3px ${dotColor}25`,
                    flexShrink: 0,
                    zIndex: 1,
                  }} />
                  {!isLast && (
                    <div style={{ width: 2, flex: 1, background: '#f0f2f8', minHeight: 28, marginTop: 3 }} />
                  )}
                </div>

                {/* Content */}
                <div style={{
                  flex: 1, background: bgColor,
                  borderRadius: 10, border: `1px solid ${dotColor}20`,
                  padding: '0.75rem 1rem',
                  marginBottom: isLast ? 0 : '0.5rem',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#111827', marginBottom: '0.2rem' }}>
                        {a.icon} {a.kind}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#6b7280', lineHeight: 1.45 }}>
                        {a.desc}
                      </div>
                      <div style={{ display: 'flex', gap: '0.6rem', marginTop: '0.35rem', alignItems: 'center' }}>
                        <span style={{
                          background: '#fff', border: '1px solid #e5e7eb',
                          padding: '0.1rem 0.45rem', borderRadius: 5,
                          fontSize: '0.67rem', fontFamily: 'monospace', fontWeight: 800, color: '#374151'
                        }}>{a.truck_id}</span>
                      </div>
                    </div>
                    <div style={{ flexShrink: 0, textAlign: 'right' }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: 800, color: dotColor }}>
                        {a.value}
                      </div>
                      <div style={{ fontSize: '0.65rem', color: '#9ca3af', marginTop: '0.15rem' }}>
                        {a.timeLabel || fmtTime(a.time)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ─── Main Alerts Page ─────────────────────────────────────────────────────────
export default function OwnerAlerts({ trips, liveData }) {
  const [filter, setFilter] = useState('all'); // 'all' | 'crit' | 'warn' | 'temperature' | 'vibration' | 'weight'
  const [view, setView] = useState('list');     // 'list' | 'timeline'

  const allAlerts = useMemo(() => buildAlerts(trips, liveData), [trips, liveData]);

  const critAlerts = allAlerts.filter(a => a.type === 'crit');
  const warnAlerts = allAlerts.filter(a => a.type === 'warn');
  const tempAlerts = allAlerts.filter(a => a.category === 'temperature');
  const vibAlerts = allAlerts.filter(a => a.category === 'vibration');
  const weightAlerts = allAlerts.filter(a => a.category === 'weight');

  const filtered = filter === 'all' ? allAlerts
    : filter === 'crit' ? critAlerts
      : filter === 'warn' ? warnAlerts
        : filter === 'temperature' ? tempAlerts
          : filter === 'vibration' ? vibAlerts
            : filter === 'weight' ? weightAlerts
              : allAlerts;

  // Export CSV
  const exportCSV = () => {
    const rows = [['Type', 'Category', 'Kind', 'Truck ID', 'Description', 'Time']];
    allAlerts.forEach(a => rows.push([
      a.type, a.category, a.kind, a.truck_id,
      `"${a.desc}"`,
      new Date(a.time).toLocaleString()
    ]));
    const blob = new Blob([rows.map(r => r.join(',')).join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const el = document.createElement('a'); el.href = url; el.download = 'alerts.csv'; el.click();
  };

  const FILTERS = [
    { key: 'all', label: `All (${allAlerts.length})` },
    { key: 'crit', label: `🔴 Critical (${critAlerts.length})` },
    { key: 'warn', label: `⚠️ Warning (${warnAlerts.length})` },
    { key: 'temperature', label: `🌡️ Temp (${tempAlerts.length})` },
    { key: 'vibration', label: `⚡ Vibration (${vibAlerts.length})` },
    { key: 'weight', label: `⚖️ Weight (${weightAlerts.length})` },
  ];

  return (
    <>
      {/* Page Header */}
      <div className="owner-page-header">
        <div>
          <div className="owner-page-header__title">Alerts Monitoring</div>
          <div className="owner-page-header__sub">Real-time incident tracking across entire fleet</div>
        </div>
        <div className="owner-page-header__actions">
          <button className="owner-btn owner-btn--outline" onClick={exportCSV}>⬇ Export CSV</button>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
        {[
          {
            label: 'Critical', value: critAlerts.length, icon: '🔴', bg: '#fef2f2',
            color: critAlerts.length > 0 ? '#dc2626' : '#6b7280',
            border: '#dc2626',
            sub: critAlerts.length > 0 ? 'Immediate action required' : 'No critical issues',
          },
          {
            label: 'Warnings', value: warnAlerts.length, icon: '⚠️', bg: '#fffbeb',
            color: warnAlerts.length > 0 ? '#d97706' : '#6b7280',
            border: '#d97706',
            sub: warnAlerts.length > 0 ? 'Monitor closely' : 'No warnings',
          },
          {
            label: 'Temp Breaches', value: tempAlerts.length, icon: '🌡️', bg: '#eff6ff',
            color: tempAlerts.length > 0 ? '#2563eb' : '#6b7280',
            border: '#3b82f6',
            sub: tempAlerts.length > 0 ? 'Above -18°C threshold' : 'Temperature normal',
          },
          {
            label: 'Total Events', value: allAlerts.length, icon: '📊', bg: '#f5f3ff',
            color: '#7c3aed', border: '#7c3aed',
            sub: `${trips.length} trips analysed`,
          },
        ].map((k, i) => (
          <div key={i} className="owner-kpi-card" style={{ '--kpi-color': k.border }}>
            <div className="owner-kpi-card__header">
              <span className="owner-kpi-card__label">{k.label}</span>
              <div className="owner-kpi-card__icon" style={{ background: k.bg }}>{k.icon}</div>
            </div>
            <div className="owner-kpi-card__value" style={{ color: k.color }}>{k.value}</div>
            <div className="owner-kpi-card__sub" style={{ color: k.color === '#6b7280' ? '#9ca3af' : k.color }}>
              {k.sub}
            </div>
          </div>
        ))}
      </div>

      {/* Alert Feed Card */}
      <div className="owner-card">
        {/* Card header with filter chips + view toggle */}
        <div style={{
          padding: '0.875rem 1.25rem',
          borderBottom: '1px solid #f0f2f8',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexWrap: 'wrap', gap: '0.75rem',
          background: '#fafbfd',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
            {FILTERS.map(f => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                style={{
                  padding: '0.3rem 0.7rem', borderRadius: 6, border: '1px solid',
                  fontSize: '0.73rem', fontWeight: 600, cursor: 'pointer',
                  transition: 'all 0.12s',
                  borderColor: filter === f.key ? '#7c3aed' : '#e5e7eb',
                  background: filter === f.key ? '#f5f3ff' : '#fff',
                  color: filter === f.key ? '#7c3aed' : '#6b7280',
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '0.375rem' }}>
            {['list', 'timeline'].map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                style={{
                  padding: '0.3rem 0.7rem', borderRadius: 6, border: '1px solid',
                  fontSize: '0.73rem', fontWeight: 600, cursor: 'pointer',
                  borderColor: view === v ? '#7c3aed' : '#e5e7eb',
                  background: view === v ? '#7c3aed' : '#fff',
                  color: view === v ? '#fff' : '#6b7280',
                  transition: 'all 0.12s',
                  textTransform: 'capitalize',
                }}
              >
                {v === 'list' ? '≡ List' : '⏱ Timeline'}
              </button>
            ))}
          </div>
        </div>

        {/* Result count */}
        <div style={{ padding: '0.5rem 1.25rem', borderBottom: '1px solid #f0f2f8', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.73rem', color: '#9ca3af', fontWeight: 500 }}>
            Showing {filtered.length} of {allAlerts.length} alerts
          </span>
          {filtered.length > 0 && filter !== 'all' && (
            <button onClick={() => setFilter('all')} style={{ fontSize: '0.7rem', color: '#7c3aed', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, padding: 0 }}>
              Clear filter ✕
            </button>
          )}
        </div>

        {/* Content */}
        {filtered.length === 0 ? (
          <div className="owner-empty" style={{ padding: '3rem' }}>
            <div className="owner-empty__icon">✅</div>
            <div className="owner-empty__title">No alerts in this category</div>
            <div className="owner-empty__sub">All monitored parameters are within acceptable limits</div>
          </div>
        ) : view === 'list' ? (
          <div>
            {filtered.map((a, i) => (
              <AlertRow key={a.id} alert={a} isFirst={i === 0} />
            ))}
          </div>
        ) : (
          <VerticalTimeline alerts={filtered} />
        )}
      </div>

      {/* Per-Truck Summary */}
      {allAlerts.length > 0 && (
        <div className="owner-card">
          <div className="owner-card__header">
            <div className="owner-card__title">🚛 Alert Summary by Truck</div>
          </div>
          <div className="owner-card__body">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
              {[...new Set(allAlerts.map(a => a.truck_id))].map(truckId => {
                const truckAlerts = allAlerts.filter(a => a.truck_id === truckId);
                const critCount = truckAlerts.filter(a => a.type === 'crit').length;
                const warnCount = truckAlerts.filter(a => a.type === 'warn').length;
                const riskColor = critCount > 0 ? '#dc2626' : warnCount > 0 ? '#d97706' : '#059669';
                const riskLabel = critCount > 0 ? 'Critical' : warnCount > 0 ? 'At Risk' : 'Safe';

                return (
                  <div key={truckId} style={{
                    background: '#f8f9fc',
                    borderRadius: 10, border: '1px solid #e5e7eb',
                    padding: '1rem 1.125rem',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: '1.1rem' }}>🚛</span>
                        <span style={{ fontWeight: 800, fontSize: '0.9rem', color: '#111827', fontFamily: 'monospace' }}>{truckId}</span>
                      </div>
                      <span style={{
                        background: critCount > 0 ? '#fef2f2' : warnCount > 0 ? '#fffbeb' : '#ecfdf5',
                        color: riskColor,
                        border: `1px solid ${riskColor}33`,
                        borderRadius: 999, padding: '0.15rem 0.6rem',
                        fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em'
                      }}>
                        {riskLabel}
                      </span>
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      {[
                        { label: 'Critical', count: critCount, color: '#dc2626', bg: '#fef2f2' },
                        { label: 'Warning', count: warnCount, color: '#d97706', bg: '#fffbeb' },
                        { label: 'Total', count: truckAlerts.length, color: '#7c3aed', bg: '#f5f3ff' },
                      ].map(m => (
                        <div key={m.label} style={{
                          flex: 1, background: m.bg, borderRadius: 8, padding: '0.5rem',
                          textAlign: 'center', border: `1px solid ${m.color}15`
                        }}>
                          <div style={{ fontSize: '1.2rem', fontWeight: 900, color: m.color }}>{m.count}</div>
                          <div style={{ fontSize: '0.6rem', color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{m.label}</div>
                        </div>
                      ))}
                    </div>

                    {/* Alert type breakdown */}
                    <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                      {[...new Set(truckAlerts.map(a => a.category))].map(cat => (
                        <span key={cat} style={{
                          background: '#fff', border: '1px solid #e5e7eb',
                          borderRadius: 5, padding: '0.12rem 0.5rem',
                          fontSize: '0.65rem', fontWeight: 600, color: '#6b7280',
                          textTransform: 'capitalize'
                        }}>
                          {cat === 'temperature' ? '🌡️' : cat === 'vibration' ? '⚡' : cat === 'weight' ? '⚖️' : '📉'} {cat}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
