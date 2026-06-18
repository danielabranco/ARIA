import { useState, useRef, useEffect } from "react";

// ── DESIGN TOKENS (dark) ─────────────────────────────────
const T = {
  bg:           "#0A0E1A",
  bgElevated:   "#0D1525",
  sidebar:      "#080C16",
  card:         "#111D35",
  cardHover:    "#152040",
  border:       "#1C2B4A",
  borderLight:  "#243354",
  accent:       "#3B82F6",
  accentHover:  "#2563EB",
  accentGlow:   "rgba(59,130,246,0.12)",
  accentGlowMd: "rgba(59,130,246,0.22)",
  success:      "#10B981",
  successGlow:  "rgba(16,185,129,0.12)",
  warning:      "#F59E0B",
  warningGlow:  "rgba(245,158,11,0.12)",
  danger:       "#EF4444",
  dangerGlow:   "rgba(239,68,68,0.12)",
  purple:       "#8B5CF6",
  purpleGlow:   "rgba(139,92,246,0.12)",
  pink:         "#F472B6",
  teal:         "#34D399",
  text:         "#E2E8F4",
  textSecondary:"#A8B8D0",
  textMuted:    "#6B7FA8",
  textDim:      "#3D4F72",
  shadow:       "0 1px 4px rgba(0,0,0,0.5)",
  shadowMd:     "0 4px 16px rgba(0,0,0,0.6)",
  radius:       "10px",
  radiusSm:     "6px",
  radiusLg:     "14px",
};

// Use relative paths — nginx proxies /api/ and /health to aria-backend:4001
const API = "";

// ── API HELPERS ──────────────────────────────────────────
const useApi = () => {
  const cfg = () => { try { return JSON.parse(localStorage.getItem("aria_config") || "{}"); } catch { return {}; } };
  const headers = () => ({
    "Content-Type": "application/json",
    "x-aria-key":  cfg().ariaKey || "aria-dev",
  });
  const get  = async (path)       => { const r = await fetch(`${API}${path}`, { headers: headers() }); if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `HTTP ${r.status}`); return r.json(); };
  const post = async (path, body) => { const r = await fetch(`${API}${path}`, { method: "POST", headers: headers(), body: JSON.stringify(body) }); if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `HTTP ${r.status}`); return r.json(); };
  const put  = async (path, body) => { const r = await fetch(`${API}${path}`, { method: "PUT",  headers: headers(), body: JSON.stringify(body) }); if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `HTTP ${r.status}`); return r.json(); };
  const del  = async (path)       => { const r = await fetch(`${API}${path}`, { method: "DELETE", headers: headers() }); if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `HTTP ${r.status}`); return r.json(); };
  return { get, post, put, del, cfg };
};

// ── ICONS ────────────────────────────────────────────────
const Icon = ({ name, size = 16, color = "currentColor", style = {} }) => {
  const paths = {
    dashboard:   <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
    knowledge:   <><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></>,
    sync:        <><polyline points="23,4 23,10 17,10"/><polyline points="1,20 1,14 7,14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></>,
    train:       <><path d="M12 2a5 5 0 0 1 5 5c0 2.5-2 4.5-5 6-3-1.5-5-3.5-5-6a5 5 0 0 1 5-5z"/><path d="M12 13v9"/><path d="M9 19l3 3 3-3"/></>,
    query:       <><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></>,
    memory:      <><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><circle cx="12" cy="12" r="10"/><line x1="12" y1="17" x2="12.01" y2="17"/></>,
    settings:    <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></>,
    close:       <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>,
    plus:        <><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>,
    check:       <><polyline points="20,6 9,17 4,12"/></>,
    trash:       <><polyline points="3,6 5,6 21,6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></>,
    edit:        <><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></>,
    arrowRight:  <><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12,5 19,12 12,19"/></>,
    chevronRight:<polyline points="9,18 15,12 9,6"/>,
    refresh:     <><polyline points="23,4 23,10 17,10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></>,
    send:        <><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22,2 15,22 11,13 2,9"/></>,
    sparkle:     <><path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z"/><path d="M5 17l.75 2.25L8 20l-2.25.75L5 23l-.75-2.25L2 20l2.25-.75L5 17z"/></>,
    key:         <><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></>,
    link2:       <><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></>,
    brain:       <><path d="M9 3a5 5 0 0 1 10 0c2.21 0 4 1.79 4 4s-1.79 4-4 4H9C5.69 11 3 8.31 3 5s2.69-5 6-5z"/><path d="M9 21v-8M15 21v-8"/></>,
    monitor:     <><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></>,
    ticket:      <><path d="M2 9a1 1 0 0 1 0-2V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v2a1 1 0 0 1 0 2v2a1 1 0 0 1 0 2v2a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-2a1 1 0 0 1 0-2V9z"/></>,
    folder:      <><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></>,
    user:        <><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></>,
    users:       <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></>,
    flow:        <><path d="M5 12h14"/><path d="M12 5l7 7-7 7"/></>,
    info:        <><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></>,
    warning:     <><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></>,
    download:    <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7,10 12,15 17,10"/><line x1="12" y1="15" x2="12" y2="3"/></>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color}
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" style={style}>
      {paths[name] || <circle cx="12" cy="12" r="10"/>}
    </svg>
  );
};

// ── SHARED COMPONENTS ────────────────────────────────────
const Badge = ({ label, color = T.accent }) => (
  <span style={{
    display: "inline-flex", alignItems: "center",
    fontSize: 11, fontWeight: 600, letterSpacing: "0.01em",
    background: `${color}18`, color, borderRadius: 20,
    padding: "2px 9px", border: `1px solid ${color}28`,
    whiteSpace: "nowrap",
  }}>{label}</span>
);

const Card = ({ children, style = {}, onClick, hoverable }) => {
  const [hov, setHov] = useState(false);
  return (
    <div onClick={onClick}
      onMouseEnter={() => hoverable && setHov(true)}
      onMouseLeave={() => hoverable && setHov(false)}
      style={{
        background: hov ? T.cardHover : T.card,
        borderRadius: T.radius,
        border: `1px solid ${hov && onClick ? T.borderLight : T.border}`,
        boxShadow: hov ? T.shadowMd : T.shadow,
        transition: "background 0.15s, box-shadow 0.15s",
        cursor: onClick ? "pointer" : "default",
        ...style,
      }}>{children}</div>
  );
};

const Btn = ({ children, onClick, variant = "primary", size = "md", disabled, icon, style = {}, color }) => {
  const [hov, setHov] = useState(false);
  const ac = color || T.accent;
  const acH = color ? color : T.accentHover;
  const base = {
    display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "inherit",
    fontWeight: 600, cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.45 : 1, border: "none", outline: "none",
    transition: "background 0.15s, box-shadow 0.15s",
    whiteSpace: "nowrap",
  };
  const sizes = {
    sm: { fontSize: 12, padding: "6px 12px", borderRadius: T.radiusSm },
    md: { fontSize: 13, padding: "9px 18px", borderRadius: T.radius },
    lg: { fontSize: 14, padding: "11px 22px", borderRadius: T.radius },
  };
  const variants = {
    primary: {
      background: hov && !disabled ? acH : ac,
      color: "#fff",
      boxShadow: hov && !disabled ? `0 2px 10px ${ac}40` : "none",
    },
    secondary: {
      background: hov && !disabled ? T.borderLight : T.border,
      color: T.textSecondary,
    },
    ghost: {
      background: hov && !disabled ? T.accentGlow : "transparent",
      color: ac,
      border: `1px solid ${hov ? ac + "40" : "transparent"}`,
    },
    danger: {
      background: hov && !disabled ? "#B91C1C" : T.danger,
      color: "#fff",
    },
  };
  return (
    <button onClick={onClick} disabled={disabled}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ ...base, ...sizes[size], ...variants[variant], ...style }}>
      {icon && <Icon name={icon} size={size === "sm" ? 13 : 14} />}
      {children}
    </button>
  );
};

const DarkInput = ({ value, onChange, onKeyDown, placeholder, type = "text", style = {} }) => {
  const [focused, setFocused] = useState(false);
  return (
    <input type={type} value={value} onChange={onChange} onKeyDown={onKeyDown}
      placeholder={placeholder}
      onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
      style={{
        fontFamily: "inherit", fontSize: 13, color: T.text,
        background: T.bgElevated,
        border: `1.5px solid ${focused ? T.accent : T.border}`,
        borderRadius: T.radius, padding: "9px 14px", outline: "none",
        transition: "border-color 0.15s, box-shadow 0.15s",
        boxShadow: focused ? `0 0 0 3px ${T.accentGlow}` : "none",
        width: "100%",
        ...style,
      }} />
  );
};

const DarkTextarea = ({ value, onChange, placeholder, rows = 6, style = {} }) => {
  const [focused, setFocused] = useState(false);
  return (
    <textarea value={value} onChange={onChange} placeholder={placeholder} rows={rows}
      onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
      style={{
        fontFamily: "inherit", fontSize: 13, color: T.text,
        background: T.bgElevated,
        border: `1.5px solid ${focused ? T.accent : T.border}`,
        borderRadius: T.radius, padding: "10px 14px", outline: "none",
        transition: "border-color 0.15s", resize: "vertical",
        boxSizing: "border-box", width: "100%",
        ...style,
      }} />
  );
};

const DarkSelect = ({ value, onChange, children, style = {} }) => {
  const [focused, setFocused] = useState(false);
  return (
    <select value={value} onChange={onChange}
      onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
      style={{
        fontFamily: "inherit", fontSize: 13, color: T.text,
        background: T.bgElevated,
        border: `1.5px solid ${focused ? T.accent : T.border}`,
        borderRadius: T.radius, padding: "9px 14px", outline: "none", cursor: "pointer",
        transition: "border-color 0.15s",
        ...style,
      }}>{children}</select>
  );
};

const SectionHeader = ({ title, subtitle, actions }) => (
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 }}>
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: T.text, letterSpacing: "-0.01em" }}>{title}</h1>
      {subtitle && <p style={{ color: T.textMuted, fontSize: 13, marginTop: 3 }}>{subtitle}</p>}
    </div>
    {actions && <div style={{ display: "flex", gap: 8, alignItems: "center" }}>{actions}</div>}
  </div>
);

const EmptyState = ({ icon, title, description, action }) => (
  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "64px 32px", textAlign: "center" }}>
    <div style={{ width: 52, height: 52, borderRadius: 13, background: T.accentGlow, border: `1px solid ${T.accent}30`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
      <Icon name={icon} size={22} color={T.accent} />
    </div>
    <div style={{ fontSize: 15, fontWeight: 600, color: T.text, marginBottom: 6 }}>{title}</div>
    <div style={{ fontSize: 13, color: T.textMuted, maxWidth: 300, lineHeight: 1.6, marginBottom: action ? 20 : 0 }}>{description}</div>
    {action}
  </div>
);

const FieldLabel = ({ children }) => (
  <div style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>{children}</div>
);

const FieldHint = ({ children }) => (
  <div style={{ fontSize: 11, color: T.textDim, marginTop: 5 }}>{children}</div>
);

// ── NAV CONFIG ───────────────────────────────────────────
const NAV = [
  { id: "dashboard", label: "Dashboard",    icon: "dashboard" },
  { id: "knowledge", label: "Knowledge",    icon: "knowledge" },
  { id: "sync",      label: "GLPI Sync",    icon: "sync"      },
  { id: "map",       label: "Architecture", icon: "flow"      },
  { id: "train",     label: "Chat with ARIA", icon: "query"   },
  { id: "memory",    label: "Memory",       icon: "memory"    },
  { id: "settings",  label: "Settings",     icon: "settings"  },
];

// ── DASHBOARD ────────────────────────────────────────────
const Dashboard = ({ api, setPage }) => {
  const [stats, setStats] = useState(null);
  const [health, setHealth] = useState(null);
  const [recent, setRecent] = useState([]);

  useEffect(() => {
    api.get("/health").then(setHealth).catch(() => {});
    api.get("/api/stats").then(setStats).catch(() => {});
    api.get("/api/memory?limit=5").then(d => setRecent(Array.isArray(d) ? d : [])).catch(() => {});
  }, []);

  const neo4jOk = health?.neo4j === "connected";
  const statCards = [
    { label: "Knowledge Entries", value: stats?.knowledge || 0, color: T.accent,   glow: T.accentGlow,   icon: "knowledge" },
    { label: "Training Sessions", value: stats?.sessions  || 0, color: T.success,  glow: T.successGlow,  icon: "train"     },
    { label: "Memory Items",      value: stats?.memory    || 0, color: T.warning,  glow: T.warningGlow,  icon: "memory"    },
    { label: "Neo4j Graph",       value: neo4jOk ? "Live" : "Offline", color: neo4jOk ? T.success : T.danger, glow: neo4jOk ? T.successGlow : T.dangerGlow, icon: "link2" },
  ];

  const steps = [
    { n: "1", title: "Configure Settings",    desc: "Add your Anthropic API key and GLPI connection",           color: T.accent,   page: "settings" },
    { n: "2", title: "Import from GLPI",       desc: "Pull dataflows, app structures and tickets",               color: T.success,  page: "sync"     },
    { n: "3", title: "Train ARIA",             desc: "Add context, business rules and historical knowledge",      color: T.warning,  page: "train"    },
    { n: "4", title: "Chat with ARIA",          desc: "Ask questions and verify ARIA understands your ecosystem",  color: T.purple,   page: "train"    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 6 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: T.accentGlowMd, border: `1px solid ${T.accent}40`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icon name="sparkle" size={22} color={T.accent} />
          </div>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 800, color: T.text, letterSpacing: "-0.03em", lineHeight: 1 }}>ARIA</h1>
            <p style={{ color: T.textMuted, fontSize: 12, marginTop: 2 }}>Architecture & Requirements Intelligence Assistant</p>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 24 }}>
        {statCards.map(s => (
          <Card key={s.label} style={{ padding: "20px 22px" }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: s.glow, border: `1px solid ${s.color}25`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
              <Icon name={s.icon} size={16} color={s.color} />
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, color: s.color, letterSpacing: "-0.03em", lineHeight: 1 }}>{s.value}</div>
            <div style={{ fontSize: 11, color: T.textMuted, marginTop: 5, fontWeight: 500 }}>{s.label}</div>
          </Card>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Card style={{ padding: 22 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
            <Icon name="memory" size={14} color={T.textMuted} />
            <span style={{ fontSize: 13, fontWeight: 600, color: T.text }}>Recent Memory</span>
          </div>
          {recent.length === 0 ? (
            <div style={{ fontSize: 13, color: T.textMuted, textAlign: "center", padding: "20px 0" }}>No memory yet — start training ARIA</div>
          ) : recent.map((m, i) => (
            <div key={i} style={{ padding: "10px 0", borderBottom: i < recent.length - 1 ? `1px solid ${T.border}` : "none" }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: T.text }}>{m.topic}</div>
              <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2, lineHeight: 1.5 }}>{(m.content || "").substring(0, 80)}...</div>
              <div style={{ fontSize: 10, color: T.textDim, marginTop: 4 }}>{m.category} · {m.createdAt?.substring(0, 10)}</div>
            </div>
          ))}
        </Card>

        <Card style={{ padding: 22 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
            <Icon name="info" size={14} color={T.textMuted} />
            <span style={{ fontSize: 13, fontWeight: 600, color: T.text }}>Getting Started</span>
          </div>
          {steps.map((s, i) => (
            <div key={s.n} onClick={() => setPage(s.page)}
              style={{ display: "flex", gap: 12, padding: "10px 0", borderBottom: i < steps.length - 1 ? `1px solid ${T.border}` : "none", cursor: "pointer" }}
              onMouseEnter={e => e.currentTarget.style.opacity = "0.8"}
              onMouseLeave={e => e.currentTarget.style.opacity = "1"}>
              <div style={{ width: 24, height: 24, borderRadius: "50%", background: `${s.color}18`, border: `1px solid ${s.color}40`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: s.color, flexShrink: 0 }}>
                {s.n}
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: T.text }}>{s.title}</div>
                <div style={{ fontSize: 11, color: T.textMuted, marginTop: 1 }}>{s.desc}</div>
              </div>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
};

// ── KNOWLEDGE BASE ───────────────────────────────────────
const REVIEW_STATUS = {
  pending:        { label: "Pending",        color: "#f59e0b" },
  to_be_reviewed: { label: "To Be Reviewed", color: "#6366f1" },
  approved:       { label: "Approved",       color: "#10b981" },
  ignore:         { label: "Ignore",         color: "#6b7280" },
};

// ── GLPI STATUS / PRIORITY MAPS ─────────────────────────
const GLPI_STATUS = {
  1: { label: "New",         color: T.accent  },
  2: { label: "In Progress", color: T.warning },
  3: { label: "Planned",     color: T.purple  },
  4: { label: "Pending",     color: "#6b7280" },
  5: { label: "Solved",      color: T.success },
  6: { label: "Closed",      color: T.textDim },
};
const GLPI_PRIORITY = {
  1: { label: "Very Low",  color: "#6b7280" },
  2: { label: "Low",       color: T.success },
  3: { label: "Medium",    color: T.warning },
  4: { label: "High",      color: T.danger  },
  5: { label: "Very High", color: "#dc2626" },
  6: { label: "Major",     color: "#7f1d1d" },
};

const KnowledgeDetailPanel = ({ entry, api, onClose, onEdit, onReviewChange, CAT_COLORS }) => {
  const [activeTab, setActiveTab] = useState("changes");
  const [glpiData, setGlpiData]   = useState(null);
  const [loadingGlpi, setLoadingGlpi] = useState(false);
  const [glpiError, setGlpiError] = useState(null);

  const cfg     = api.cfg();
  const glpiUrl = cfg.glpiUrl || "";
  const hasCreds = glpiUrl && cfg.glpiUserToken && cfg.glpiAppToken;

  const dfId = entry.dataflowId ||
    (entry.tags || []).find(t => t.startsWith("dataflow-"))?.replace("dataflow-", "") ||
    (entry.category === "dataflow" ? entry.glpiId : null);
  const appId = entry.category !== "dataflow" ? entry.glpiId : null;

  useEffect(() => {
    if (!hasCreds) return;
    setLoadingGlpi(true);
    setGlpiError(null);
    const params = new URLSearchParams({ glpiUrl, userToken: cfg.glpiUserToken, appToken: cfg.glpiAppToken });
    api.get(`/api/knowledge/${entry.id}/glpi-links?${params}`)
      .then(d => setGlpiData(d))
      .catch(e => setGlpiError(e.message))
      .finally(() => setLoadingGlpi(false));
  }, [entry.id]);

  const rs       = entry.reviewStatus || "pending";
  const rsInfo   = REVIEW_STATUS[rs] || REVIEW_STATUS.pending;
  const catColor = CAT_COLORS[entry.category] || T.accent;

  const GlpiRow = ({ item, type }) => {
    // Associated items (software components) have different fields
    if (type === "assoc") {
      const link = glpiUrl ? `${glpiUrl}/marketplace/archisw/front/swcomponent.form.php?id=${item.id}` : null;
      const appType = item.plugin_archisw_swcomponenttypes_id || item.swcomponenttypes_id || "";
      return (
        <div style={{ padding: "12px 16px", borderRadius: T.radiusSm, background: T.bgElevated, border: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 10, color: T.textDim, fontWeight: 600 }}>#{item.id}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{item.name || `App #${item.id}`}</span>
              {appType && <Badge label={appType} color={T.accent} />}
              {item.entities_id && <span style={{ fontSize: 10, color: T.textDim }}>{item.entities_id}</span>}
            </div>
            {(item.shortdescription || item.description) && (
              <div style={{ marginTop: 5, fontSize: 11, color: T.textMuted, lineHeight: 1.5 }}>
                {(item.shortdescription || item.description).substring(0, 180)}
              </div>
            )}
          </div>
          {link && (
            <a href={link} target="_blank" rel="noreferrer" style={{ color: T.accent, display: "flex", alignItems: "center", flexShrink: 0, padding: 4 }}>
              <Icon name="link2" size={14} color={T.accent} />
            </a>
          )}
        </div>
      );
    }

    // ITIL items (changes, tickets, problems)
    // status/priority may be numeric (from search API) or string (from direct fetch with expand_dropdowns)
    const statusKey = parseInt(item.status, 10);
    const status = GLPI_STATUS[statusKey] || (typeof item.status === "string" && !isNaN(statusKey) ? { label: item.status, color: T.textDim } : { label: String(item.status ?? ""), color: T.textDim });
    const priorityKey = parseInt(item.priority, 10);
    const priority = GLPI_PRIORITY[priorityKey];
    const link = glpiUrl && (
      type === "change"  ? `${glpiUrl}/front/change.form.php?id=${item.id}`  :
      type === "ticket"  ? `${glpiUrl}/front/ticket.form.php?id=${item.id}`  :
      type === "problem" ? `${glpiUrl}/front/problem.form.php?id=${item.id}` : null
    );
    return (
      <div style={{ padding: "12px 16px", borderRadius: T.radiusSm, background: T.bgElevated, border: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5, flexWrap: "wrap" }}>
            <span style={{ fontSize: 10, color: T.textDim, fontWeight: 600 }}>#{item.id}</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{item.name || `${type} #${item.id}`}</span>
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 10, background: `${status.color}20`, color: status.color, border: `1px solid ${status.color}40` }}>{status.label}</span>
            {priority && <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 10, background: `${priority.color}20`, color: priority.color }}>{priority.label}</span>}
            {item.itilcategories_id && <span style={{ fontSize: 10, color: T.textDim }}>{item.itilcategories_id}</span>}
            {(item.date || item.date_mod) && <span style={{ fontSize: 10, color: T.textDim }}>{(item.date || item.date_mod)?.substring(0, 10)}</span>}
          </div>
          {item.content && (
            <div style={{ marginTop: 6, fontSize: 11, color: T.textMuted, lineHeight: 1.5 }}>
              {item.content.replace(/<[^>]+>/g, " ").trim().substring(0, 180)}{item.content.length > 180 ? "…" : ""}
            </div>
          )}
        </div>
        {link && (
          <a href={link} target="_blank" rel="noreferrer" style={{ color: T.accent, display: "flex", alignItems: "center", flexShrink: 0, padding: 4 }}>
            <Icon name="link2" size={14} color={T.accent} />
          </a>
        )}
      </div>
    );
  };

  const TABS = [
    { id: "changes",  label: "Changes",          icon: "refresh",  type: "change",  data: glpiData?.changes        },
    { id: "tickets",  label: "Tickets",           icon: "ticket",   type: "ticket",  data: glpiData?.tickets        },
    { id: "problems", label: "Problems",          icon: "warning",  type: "problem", data: glpiData?.problems       },
    { id: "assoc",    label: "Associated Items",  icon: "monitor",  type: "assoc",   data: glpiData?.associatedItems },
  ];

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.78)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: T.card, borderRadius: T.radiusLg, border: `1px solid ${T.border}`, width: "100%", maxWidth: 920, maxHeight: "90vh", display: "flex", flexDirection: "column", boxShadow: T.shadowMd, overflow: "hidden" }}>

        {/* HEADER */}
        <div style={{ padding: "18px 24px", borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexShrink: 0 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", marginBottom: 7 }}>
              <Badge label={entry.category} color={catColor} />
              <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 10, background: `${rsInfo.color}20`, color: rsInfo.color, border: `1px solid ${rsInfo.color}40` }}>{rsInfo.label}</span>
              {entry.source && <Badge label={entry.source} color={T.textDim} />}
              {glpiUrl && dfId && (
                <a href={`${glpiUrl}/marketplace/dataflows/front/dataflow.form.php?id=${dfId}`} target="_blank" rel="noreferrer"
                  style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, fontWeight: 600, color: T.accent, textDecoration: "none", padding: "2px 8px", borderRadius: 10, background: T.accentGlow, border: `1px solid ${T.accent}30` }}>
                  <Icon name="link2" size={10} color={T.accent} /> GLPI Dataflow #{dfId}
                </a>
              )}
              {glpiUrl && appId && (
                <a href={`${glpiUrl}/marketplace/archisw/front/swcomponent.form.php?id=${appId}`} target="_blank" rel="noreferrer"
                  style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, fontWeight: 600, color: T.accent, textDecoration: "none", padding: "2px 8px", borderRadius: 10, background: T.accentGlow, border: `1px solid ${T.accent}30` }}>
                  <Icon name="link2" size={10} color={T.accent} /> GLPI App #{appId}
                </a>
              )}
            </div>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: T.text, lineHeight: 1.3, margin: 0 }}>{entry.topic}</h2>
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center", marginLeft: 16, flexShrink: 0 }}>
            <Btn size="sm" variant="secondary" icon="edit" onClick={() => { onClose(); onEdit(entry); }}>Edit</Btn>
            <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: T.textMuted, padding: 4, display: "flex", borderRadius: 6 }}>
              <Icon name="close" size={18} color={T.textMuted} />
            </button>
          </div>
        </div>

        {/* BODY */}
        <div style={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column" }}>

          {/* Full content */}
          <div style={{ padding: "20px 24px", borderBottom: `1px solid ${T.border}` }}>
            <FieldLabel>Content</FieldLabel>
            <pre style={{ fontFamily: "inherit", fontSize: 13, color: T.textSecondary, lineHeight: 1.7, whiteSpace: "pre-wrap", wordBreak: "break-word", margin: 0 }}>
              {entry.content}
            </pre>
            {entry.tags?.length > 0 && (
              <div style={{ marginTop: 12, display: "flex", gap: 5, flexWrap: "wrap" }}>
                {entry.tags.map(t => <span key={t} style={{ fontSize: 10, background: T.border, color: T.textMuted, borderRadius: 4, padding: "2px 7px" }}>{t}</span>)}
              </div>
            )}
            <div style={{ marginTop: 10, display: "flex", gap: 16 }}>
              {entry.createdAt && <span style={{ fontSize: 11, color: T.textDim }}>Created: {entry.createdAt.substring(0, 10)}</span>}
              {entry.updatedAt && <span style={{ fontSize: 11, color: T.textDim }}>Updated: {entry.updatedAt.substring(0, 10)}</span>}
            </div>
          </div>

          {/* Review status row */}
          <div style={{ padding: "10px 24px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            <span style={{ fontSize: 11, color: T.textDim, marginRight: 4 }}>Review:</span>
            {Object.entries(REVIEW_STATUS).map(([key, val]) => (
              <button key={key} onClick={() => onReviewChange(entry.id, key)}
                style={{ padding: "4px 12px", borderRadius: 8, cursor: "pointer", fontSize: 11, fontWeight: 600, background: rs === key ? `${val.color}25` : "transparent", color: rs === key ? val.color : T.textDim, border: `1px solid ${rs === key ? val.color + "50" : T.border}`, fontFamily: "inherit" }}>
                {val.label}
              </button>
            ))}
          </div>

          {/* GLPI Linked Items */}
          <div style={{ flex: 1, padding: "20px 24px", overflow: "auto", minHeight: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <FieldLabel>GLPI Linked Items</FieldLabel>
              {loadingGlpi && <span style={{ fontSize: 11, color: T.textDim }}>Loading from GLPI…</span>}
              {glpiError && <span style={{ fontSize: 11, color: T.danger }}>Error: {glpiError}</span>}
            </div>

            {!hasCreds ? (
              <div style={{ fontSize: 13, color: T.textDim, padding: "24px 0" }}>Configure GLPI connection in Settings to see linked items.</div>
            ) : (
              <>
                {/* Tab bar */}
                <div style={{ display: "flex", gap: 0, marginBottom: 16, borderBottom: `1px solid ${T.border}` }}>
                  {TABS.map(tab => {
                    const count  = tab.data?.length;
                    const active = activeTab === tab.id;
                    return (
                      <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
                        display: "flex", alignItems: "center", gap: 6, padding: "9px 16px",
                        background: "none", border: "none", borderBottom: `2px solid ${active ? T.accent : "transparent"}`,
                        marginBottom: -1, cursor: "pointer", fontFamily: "inherit",
                        fontSize: 13, fontWeight: active ? 700 : 500,
                        color: active ? T.accent : T.textMuted, transition: "color 0.15s",
                      }}>
                        <Icon name={tab.icon} size={13} color={active ? T.accent : T.textMuted} />
                        {tab.label}
                        {count !== undefined && (
                          <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 10, background: count > 0 ? `${T.accent}20` : T.border, color: count > 0 ? T.accent : T.textDim }}>{count}</span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Tab content */}
                {loadingGlpi ? (
                  <div style={{ padding: "40px 0", textAlign: "center", color: T.textDim, fontSize: 13 }}>Fetching from GLPI…</div>
                ) : (() => {
                  const tab   = TABS.find(t => t.id === activeTab);
                  const items = tab?.data;
                  if (!items) return <div style={{ padding: "40px 0", textAlign: "center", color: T.textDim, fontSize: 13 }}>No data loaded yet.</div>;
                  if (items.length === 0) return (
                    <div style={{ padding: "40px 0", textAlign: "center" }}>
                      <Icon name={tab.icon} size={28} color={T.textDim} style={{ marginBottom: 10 }} />
                      <div style={{ fontSize: 13, color: T.textDim }}>No linked {tab.label.toLowerCase()} found in GLPI.</div>
                    </div>
                  );
                  return (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {items.map(item => <GlpiRow key={item.id} item={item} type={tab.type} />)}
                    </div>
                  );
                })()}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const KnowledgeBase = ({ api }) => {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState(null);
  const [editEntry, setEditEntry] = useState(null);
  const [editDraft, setEditDraft] = useState({});
  const [saving, setSaving] = useState(false);
  const [reviewFilter, setReviewFilter] = useState("all");
  const [detailEntry, setDetailEntry] = useState(null);

  const load = async () => {
    setLoading(true);
    try { const d = await api.get(`/api/knowledge?category=${filter}&search=${search}`); setEntries(Array.isArray(d) ? d : []); }
    catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, [filter, search]);

  const importFromGlpi = async (type) => {
    setImporting(true);
    setImportMsg({ type: "info", text: `Importing ${type}...` });
    try {
      const cfg = api.cfg();
      const data = await api.post("/api/knowledge/import-glpi", { type, glpiUrl: cfg.glpiUrl, userToken: cfg.glpiUserToken, appToken: cfg.glpiAppToken });
      setImportMsg({ type: "success", text: `Imported ${data.imported || 0} ${type} entries` });
      load();
    } catch (e) {
      setImportMsg({ type: "error", text: `Error: ${e.message}` });
    }
    setImporting(false);
    setTimeout(() => setImportMsg(null), 4000);
  };

  const deleteEntry = async (id) => { await api.del(`/api/knowledge/${id}`); load(); };

  const openEdit = (entry) => {
    const existingDfId = (entry.tags || []).find(t => t.startsWith("dataflow-"))?.replace("dataflow-", "") || "";
    setEditEntry(entry);
    setEditDraft({ topic: entry.topic, content: entry.content, tags: (entry.tags || []).join(", "), reviewStatus: entry.reviewStatus || "pending", dataflowId: existingDfId });
  };
  const closeEdit = () => { setEditEntry(null); setEditDraft({}); };

  const saveEdit = async () => {
    setSaving(true);
    try {
      let tags = editDraft.tags.split(",").map(t => t.trim()).filter(Boolean);
      // If dataflowId was set/changed, ensure the tag is present and topic reflects it
      if (editDraft.dataflowId) {
        tags = tags.filter(t => !t.startsWith("dataflow-"));
        tags.push(`dataflow-${editDraft.dataflowId}`);
        if (!tags.includes("talend")) tags.push("talend");
      }
      await api.put(`/api/knowledge/${editEntry.id}`, {
        topic: editDraft.topic,
        content: editDraft.content,
        tags,
        reviewStatus: editDraft.reviewStatus,
        dataflowId: editDraft.dataflowId || null,
      });
      closeEdit();
      load();
    } catch (e) { console.error(e); }
    setSaving(false);
  };

  const setReviewStatus = async (id, status) => {
    await api.put(`/api/knowledge/${id}`, { reviewStatus: status });
    load();
  };

  const CATS = ["all","dataflow","talend-job","application","change","ticket","project","manual","document","ai-generated"];
  const CAT_COLORS = { dataflow: T.danger, "talend-job": "#6e40c9", application: T.accent, change: T.warning, ticket: T.success, project: T.purple, manual: T.pink, document: T.teal, "ai-generated": "#0ea5e9" };

  const IMPORT_TYPES = [
    { id: "dataflows",  label: "Dataflows",  icon: "flow"     },
    { id: "appstructs", label: "Apps",        icon: "monitor"  },
    { id: "changes",    label: "Changes",     icon: "refresh"  },
    { id: "tickets",    label: "Tickets",     icon: "ticket"   },
    { id: "projects",   label: "Projects",    icon: "folder"   },
  ];

  return (
    <div>
      <SectionHeader title="Knowledge Base" subtitle="Everything ARIA knows about the OMDS IT ecosystem."
        actions={
          <div style={{ display: "flex", gap: 6 }}>
            {IMPORT_TYPES.map(t => (
              <Btn key={t.id} size="sm" variant="secondary" icon={t.icon} onClick={() => importFromGlpi(t.id)} disabled={importing}>
                {t.label}
              </Btn>
            ))}
          </div>
        }
      />

      {importMsg && (
        <div style={{ marginBottom: 16, padding: "10px 16px", borderRadius: T.radius, fontSize: 13, fontWeight: 500,
          background: importMsg.type === "success" ? T.successGlow : importMsg.type === "error" ? T.dangerGlow : T.accentGlow,
          border: `1px solid ${importMsg.type === "success" ? T.success : importMsg.type === "error" ? T.danger : T.accent}30`,
          color: importMsg.type === "success" ? T.success : importMsg.type === "error" ? T.danger : T.accent,
        }}>
          {importMsg.text}
        </div>
      )}

      <div style={{ display: "flex", gap: 10, marginBottom: 12, alignItems: "center" }}>
        <div style={{ flex: 1 }}>
          <DarkInput value={search} onChange={e => setSearch(e.target.value)} placeholder="Search knowledge base..." />
        </div>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {CATS.map(cat => {
            const active = filter === cat;
            const color = CAT_COLORS[cat] || T.accent;
            return (
              <button key={cat} onClick={() => setFilter(cat)} style={{
                padding: "6px 12px", borderRadius: 20, cursor: "pointer", fontSize: 11, fontWeight: 600,
                background: active ? `${color}20` : "transparent",
                color: active ? color : T.textMuted,
                border: `1.5px solid ${active ? color + "50" : T.border}`,
                fontFamily: "inherit", transition: "all 0.15s",
              }}>{cat}</button>
            );
          })}
        </div>
      </div>

      {/* Review status filter */}
      <div style={{ display: "flex", gap: 6, marginBottom: 20, alignItems: "center" }}>
        <span style={{ fontSize: 11, color: T.textDim, marginRight: 4 }}>Review:</span>
        {["all", "pending", "to_be_reviewed", "approved", "ignore"].map(s => {
          const active = reviewFilter === s;
          const color = REVIEW_STATUS[s]?.color || T.accent;
          return (
            <button key={s} onClick={() => setReviewFilter(s)} style={{
              padding: "4px 10px", borderRadius: 20, cursor: "pointer", fontSize: 11, fontWeight: 600,
              background: active ? `${color}25` : "transparent",
              color: active ? color : T.textMuted,
              border: `1.5px solid ${active ? color + "60" : T.border}`,
              fontFamily: "inherit", transition: "all 0.15s",
            }}>{s}</button>
          );
        })}
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 48, color: T.textMuted, fontSize: 13 }}>Loading...</div>
      ) : entries.length === 0 ? (
        <Card><EmptyState icon="knowledge" title="Knowledge base is empty" description="Import from GLPI or add entries through training sessions." /></Card>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {entries
            .filter(e => reviewFilter === "all" || (e.reviewStatus || "pending") === reviewFilter)
            .map(entry => {
              const rs = entry.reviewStatus || "pending";
              const rsInfo = REVIEW_STATUS[rs] || REVIEW_STATUS.pending;
              const kbGlpiUrl = (() => { try { return JSON.parse(localStorage.getItem('aria_config') || '{}').glpiUrl || ''; } catch { return ''; } })();
              const dfId = entry.dataflowId ||
                (entry.tags || []).find(t => t.startsWith('dataflow-'))?.replace('dataflow-', '') ||
                (entry.category === 'dataflow' ? entry.glpiId : null);
              const appId = entry.category !== 'dataflow' ? entry.glpiId : null;
              const kbGlpiLink = kbGlpiUrl && dfId
                ? `${kbGlpiUrl}/marketplace/dataflows/front/dataflow.form.php?id=${dfId}`
                : kbGlpiUrl && appId
                ? `${kbGlpiUrl}/marketplace/archisw/front/swcomponent.form.php?id=${appId}`
                : null;
              const kbGlpiLabel = dfId ? `GLPI Dataflow #${dfId}` : appId ? `GLPI App #${appId}` : null;
              return (
                <Card key={entry.id} hoverable
                  style={{ padding: "14px 18px", borderLeft: `3px solid ${rsInfo.color}40` }}
                  onClick={() => setDetailEntry(entry)}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 6, flexWrap: "wrap" }}>
                        <Badge label={entry.category} color={CAT_COLORS[entry.category] || T.accent} />
                        <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 10, background: `${rsInfo.color}20`, color: rsInfo.color, border: `1px solid ${rsInfo.color}40` }}>{rsInfo.label}</span>
                        {entry.source && <Badge label={entry.source} color={T.textDim} />}
                        <span style={{ fontSize: 12, fontWeight: 600, color: T.text }}>{entry.topic}</span>
                        {kbGlpiLink && (
                          <a href={kbGlpiLink} target="_blank" rel="noreferrer"
                            onClick={e => e.stopPropagation()}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 600, color: T.accent, textDecoration: 'none', padding: '2px 8px', borderRadius: 10, background: T.accentGlow, border: `1px solid ${T.accent}30` }}>
                            <Icon name="link2" size={10} color={T.accent} />
                            {kbGlpiLabel}
                          </a>
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: T.textMuted, lineHeight: 1.6 }}>
                        {(entry.content || "").substring(0, 200)}{entry.content?.length > 200 ? "..." : ""}
                      </div>
                      {entry.tags?.length > 0 && (
                        <div style={{ marginTop: 8, display: "flex", gap: 5, flexWrap: "wrap" }}>
                          {entry.tags.map(t => (
                            <span key={t} style={{ fontSize: 10, background: T.border, color: T.textMuted, borderRadius: 4, padding: "2px 7px" }}>{t}</span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, marginLeft: 16, flexShrink: 0 }}>
                      <span style={{ fontSize: 10, color: T.textDim }}>{entry.createdAt?.substring(0, 10)}</span>
                      {/* Quick review status buttons */}
                      <div style={{ display: "flex", gap: 4 }}>
                        {Object.entries(REVIEW_STATUS).map(([key, val]) => (
                          <button key={key} onClick={e => { e.stopPropagation(); setReviewStatus(entry.id, key); }}
                            title={`Mark as ${val.label}`}
                            style={{
                              padding: "2px 8px", borderRadius: 8, cursor: "pointer", fontSize: 10, fontWeight: 600,
                              background: rs === key ? `${val.color}25` : "transparent",
                              color: rs === key ? val.color : T.textDim,
                              border: `1px solid ${rs === key ? val.color + "50" : T.border}`,
                              fontFamily: "inherit",
                            }}>{val.label}</button>
                        ))}
                      </div>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button onClick={e => { e.stopPropagation(); openEdit(entry); }} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: T.textDim, display: "flex" }}
                          onMouseEnter={e => e.currentTarget.style.color = T.accent}
                          onMouseLeave={e => e.currentTarget.style.color = T.textDim}
                          title="Edit">
                          <Icon name="edit" size={14} color="currentColor" />
                        </button>
                        <button onClick={e => { e.stopPropagation(); deleteEntry(entry.id); }} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: T.textDim, display: "flex" }}
                          onMouseEnter={e => e.currentTarget.style.color = T.danger}
                          onMouseLeave={e => e.currentTarget.style.color = T.textDim}
                          title="Delete">
                          <Icon name="trash" size={14} color="currentColor" />
                        </button>
                      </div>
                    </div>
                  </div>
                </Card>
              );
          })}
        </div>
      )}

      {/* Detail Panel */}
      {detailEntry && (
        <KnowledgeDetailPanel
          entry={detailEntry}
          api={api}
          CAT_COLORS={CAT_COLORS}
          onClose={() => setDetailEntry(null)}
          onEdit={(e) => { setDetailEntry(null); openEdit(e); }}
          onReviewChange={(id, status) => {
            setReviewStatus(id, status);
            setDetailEntry(prev => prev ? { ...prev, reviewStatus: status } : prev);
          }}
        />
      )}

      {/* Edit / View Modal */}
      {editEntry && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div style={{ background: T.surface, borderRadius: T.radiusLg, border: `1px solid ${T.border}`, width: "100%", maxWidth: 680, maxHeight: "85vh", display: "flex", flexDirection: "column", boxShadow: T.shadowMd }}>
            <div style={{ padding: "18px 24px", borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontWeight: 700, fontSize: 14, color: T.text }}>Edit Knowledge Entry</span>
              <button onClick={closeEdit} style={{ background: "none", border: "none", cursor: "pointer", color: T.textMuted, fontSize: 18, lineHeight: 1 }}>✕</button>
            </div>
            <div style={{ padding: "20px 24px", overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ fontSize: 11, color: T.textMuted, fontWeight: 600, display: "block", marginBottom: 6 }}>TOPIC</label>
                <DarkInput value={editDraft.topic || ""} onChange={e => setEditDraft(d => ({ ...d, topic: e.target.value }))} placeholder="Entry topic" />
              </div>
              <div>
                <label style={{ fontSize: 11, color: T.textMuted, fontWeight: 600, display: "block", marginBottom: 6 }}>CONTENT</label>
                <textarea value={editDraft.content || ""} onChange={e => setEditDraft(d => ({ ...d, content: e.target.value }))}
                  style={{ width: "100%", minHeight: 260, background: T.bg, border: `1px solid ${T.border}`, borderRadius: T.radiusSm, color: T.text, fontSize: 12, padding: "10px 12px", fontFamily: "inherit", resize: "vertical", lineHeight: 1.6, boxSizing: "border-box" }} />
              </div>
              {(editEntry?.category === "talend-job" || (editEntry?.tags || []).includes("talend")) && (
                <div>
                  <label style={{ fontSize: 11, color: "#6e40c9", fontWeight: 600, display: "block", marginBottom: 6 }}>GLPI DATAFLOW ID</label>
                  <DarkInput
                    value={editDraft.dataflowId || ""}
                    onChange={e => setEditDraft(d => ({ ...d, dataflowId: e.target.value.replace(/\D/g, "") }))}
                    placeholder="e.g. 262 — links this job to the GLPI dataflow"
                  />
                  <div style={{ fontSize: 11, color: T.textDim, marginTop: 4 }}>Leave blank if unknown — you can fill it in after reviewing in GLPI.</div>
                </div>
              )}
              <div>
                <label style={{ fontSize: 11, color: T.textMuted, fontWeight: 600, display: "block", marginBottom: 6 }}>TAGS (comma-separated)</label>
                <DarkInput value={editDraft.tags || ""} onChange={e => setEditDraft(d => ({ ...d, tags: e.target.value }))} placeholder="tag1, tag2, tag3" />
              </div>
              <div>
                <label style={{ fontSize: 11, color: T.textMuted, fontWeight: 600, display: "block", marginBottom: 6 }}>REVIEW STATUS</label>
                <div style={{ display: "flex", gap: 8 }}>
                  {Object.entries(REVIEW_STATUS).map(([key, val]) => (
                    <button key={key} onClick={() => setEditDraft(d => ({ ...d, reviewStatus: key }))}
                      style={{
                        padding: "6px 14px", borderRadius: T.radiusSm, cursor: "pointer", fontSize: 12, fontWeight: 600,
                        background: editDraft.reviewStatus === key ? `${val.color}25` : "transparent",
                        color: editDraft.reviewStatus === key ? val.color : T.textMuted,
                        border: `1.5px solid ${editDraft.reviewStatus === key ? val.color : T.border}`,
                        fontFamily: "inherit",
                      }}>{val.label}</button>
                  ))}
                </div>
              </div>
            </div>
            <div style={{ padding: "14px 24px", borderTop: `1px solid ${T.border}`, display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <Btn variant="secondary" onClick={closeEdit}>Cancel</Btn>
              <Btn onClick={saveEdit} disabled={saving}>{saving ? "Saving..." : "Save Changes"}</Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ── TRAIN ARIA ───────────────────────────────────────────
const TrainAria = ({ api }) => {
  const [mode, setMode] = useState("chat");
  const WELCOME = { role: "aria", text: "Hi! I'm ARIA — ask me anything about OMDS's IT architecture, dataflows, or systems. I'll answer from my knowledge base. You can also teach me something new and I'll remember it.\n\nTry: \"Quiz me on an application\" or \"What systems connect to SAP?\"" };
  const [messages, setMessages] = useState(() => {
    try {
      const saved = localStorage.getItem("aria_chat_history");
      const parsed = saved ? JSON.parse(saved) : null;
      return Array.isArray(parsed) && parsed.length > 0 ? parsed : [WELCOME];
    } catch { return [WELCOME]; }
  });
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [docText, setDocText] = useState("");
  const [docTitle, setDocTitle] = useState("");
  const [manualTopic, setManualTopic] = useState("");
  const [manualContent, setManualContent] = useState("");
  const [manualCategory, setManualCategory] = useState("manual");
  const [manualTags, setManualTags] = useState("");
  const [saved, setSaved] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  // Persist chat history across tab switches
  useEffect(() => {
    try { localStorage.setItem("aria_chat_history", JSON.stringify(messages.slice(-100))); } catch {}
  }, [messages]);

  const clearChat = () => {
    const fresh = [WELCOME];
    setMessages(fresh);
    localStorage.removeItem("aria_chat_history");
  };

  const sendTraining = async () => {
    if (!input.trim() || loading) return;
    const msg = input.trim();
    setInput("");
    setMessages(m => [...m, { role: "user", text: msg }]);
    setLoading(true);
    try {
      const data = await api.post("/api/train/chat", { message: msg, history: messages.slice(-10) });
      setMessages(m => [...m, { role: "aria", text: data.response || "I've noted that.", sources: data.sources || [] }]);
      if (data.learned) setMessages(m => [...m, { role: "system", text: `Saved to knowledge base: "${data.learned}"` }]);
      if (data.graphPushed > 0) setMessages(m => [...m, { role: "graph", text: `${data.graphPushed} node(s) pushed to FlowVault map — refresh the Architecture Map to see them.` }]);
    } catch (e) {
      setMessages(m => [...m, { role: "aria", text: "Error: " + e.message }]);
    }
    setLoading(false);
  };

  const saveDocument = async () => {
    if (!docTitle || !docText) return;
    setLoading(true);
    try {
      await api.post("/api/knowledge", { topic: docTitle, content: docText, category: "document", source: "manual-upload", tags: [docTitle.toLowerCase()] });
      setSaved(true); setDocTitle(""); setDocText(""); setTimeout(() => setSaved(false), 3000);
    } catch {}
    setLoading(false);
  };

  const saveManual = async () => {
    if (!manualTopic || !manualContent) return;
    setLoading(true);
    try {
      await api.post("/api/knowledge", { topic: manualTopic, content: manualContent, category: manualCategory, source: "manual", tags: manualTags.split(",").map(t => t.trim()).filter(Boolean) });
      setSaved(true); setManualTopic(""); setManualContent(""); setManualTags(""); setTimeout(() => setSaved(false), 3000);
    } catch {}
    setLoading(false);
  };

  const MODES = [
    { id: "chat",     label: "Chat",     icon: "query",    desc: "Ask questions, get answers, teach ARIA" },
    { id: "document", label: "Document", icon: "knowledge",desc: "Paste documents to learn from" },
    { id: "manual",   label: "Manual",   icon: "edit",     desc: "Add specific knowledge entries" },
  ];

  const PROMPTS = [
    "What systems connect to SAP?",
    "List all Magento dataflows",
    "Quiz me on an application",
    "Which dataflows have no docs?",
    "Explain the B2C shop architecture",
    "What is the most connected system?",
    "SAP is our main ERP system",
    "MuleSoft is our integration layer",
  ];

  return (
    <div style={{ display: mode === "chat" ? "flex" : "block", flexDirection: "column", height: mode === "chat" ? "calc(100vh - 64px)" : "auto" }}>
      <SectionHeader title="Chat with ARIA" subtitle="Ask questions, explore your architecture, and teach ARIA what it doesn't know yet."
        actions={mode === "chat" ? <Btn size="sm" variant="secondary" icon="trash" onClick={clearChat}>Clear chat</Btn> : null} />

      {/* Mode selector */}
      <div style={{ display: "flex", gap: 10, marginBottom: 24 }}>
        {MODES.map(m => (
          <div key={m.id} onClick={() => setMode(m.id)} style={{
            flex: 1, padding: "16px 18px", borderRadius: T.radius, cursor: "pointer",
            border: `2px solid ${mode === m.id ? T.accent : T.border}`,
            background: mode === m.id ? T.accentGlow : T.card,
            transition: "all 0.15s",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <Icon name={m.icon} size={15} color={mode === m.id ? T.accent : T.textMuted} />
              <span style={{ fontSize: 13, fontWeight: 600, color: mode === m.id ? T.accent : T.text }}>{m.label}</span>
            </div>
            <div style={{ fontSize: 11, color: T.textMuted }}>{m.desc}</div>
          </div>
        ))}
      </div>

      {/* CHAT MODE */}
      {mode === "chat" && (
        <>
          <Card style={{ flex: 1, padding: 0, overflow: "hidden", display: "flex", flexDirection: "column", minHeight: 0, marginBottom: 12 }}>
            {/* Messages */}
            <div style={{ flex: 1, overflowY: "auto", padding: "20px 20px 8px", display: "flex", flexDirection: "column", gap: 16 }}>
              {messages.map((msg, i) => (
                <div key={i} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start", gap: 10, alignItems: "flex-end" }}>
                  {msg.role === "system" ? (
                    <div style={{ width: "100%", display: "flex", justifyContent: "center" }}>
                      <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: T.successGlow, border: `1px solid ${T.success}30`, borderRadius: 20, padding: "4px 12px", fontSize: 11, color: T.success, fontWeight: 600 }}>
                        <Icon name="check" size={11} color={T.success} />
                        {msg.text}
                      </div>
                    </div>
                  ) : msg.role === "graph" ? (
                    <div style={{ width: "100%", display: "flex", justifyContent: "center" }}>
                      <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: T.purpleGlow, border: `1px solid ${T.purple}30`, borderRadius: 20, padding: "4px 14px", fontSize: 11, color: T.purple, fontWeight: 600 }}>
                        <Icon name="flow" size={11} color={T.purple} />
                        {msg.text}
                      </div>
                    </div>
                  ) : msg.role === "aria" ? (
                    <>
                      <div style={{ width: 30, height: 30, borderRadius: "50%", background: T.accentGlowMd, border: `1px solid ${T.accent}40`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <Icon name="sparkle" size={14} color={T.accent} />
                      </div>
                      <div style={{ maxWidth: "82%", background: T.border, borderRadius: "13px 13px 13px 4px", padding: "12px 16px", fontSize: 13, lineHeight: 1.75, color: T.text }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: T.accent, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.07em" }}>ARIA</div>
                        <div style={{ whiteSpace: "pre-wrap" }}>{msg.text}</div>
                        {msg.sources?.length > 0 && (
                          <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${T.borderLight}` }}>
                            <div style={{ fontSize: 10, color: T.textMuted, marginBottom: 5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Sources</div>
                            {msg.sources.map((src, j) => (
                              <div key={j} style={{ fontSize: 11, color: T.textDim, display: "flex", alignItems: "center", gap: 5, marginBottom: 2 }}>
                                <Icon name="chevronRight" size={10} color={T.textDim} />{src}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <div style={{ maxWidth: "82%", background: T.accent, borderRadius: "13px 13px 4px 13px", padding: "12px 16px", fontSize: 13, lineHeight: 1.65, color: "#fff" }}>
                      {msg.text}
                    </div>
                  )}
                </div>
              ))}
              {loading && (
                <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
                  <div style={{ width: 30, height: 30, borderRadius: "50%", background: T.accentGlowMd, border: `1px solid ${T.accent}40`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Icon name="sparkle" size={14} color={T.accent} />
                  </div>
                  <div style={{ background: T.border, borderRadius: "13px 13px 13px 4px", padding: "12px 18px" }}>
                    <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
                      {[0,1,2].map(i => <div key={i} style={{ width: 5, height: 5, borderRadius: "50%", background: T.accent, opacity: 0.5 }} />)}
                    </div>
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Input bar */}
            <div style={{ borderTop: `1px solid ${T.border}`, padding: "12px 16px", display: "flex", gap: 10, alignItems: "center" }}>
              <DarkInput value={input} onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendTraining()}
                placeholder="Ask anything or teach ARIA something new..." />
              <Btn icon="send" onClick={sendTraining} disabled={loading || !input.trim()} size="md">Send</Btn>
            </div>
          </Card>

          {/* Suggestion chips */}
          <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
            {PROMPTS.map(p => (
              <button key={p} onClick={() => setInput(p)} style={{
                background: T.accentGlow, color: T.accent, border: `1px solid ${T.accent}28`,
                borderRadius: 20, padding: "5px 13px", fontSize: 11, fontWeight: 600,
                cursor: "pointer", fontFamily: "inherit",
              }}>{p}</button>
            ))}
          </div>
        </>
      )}

      {/* DOCUMENT MODE */}
      {mode === "document" && (
        <Card style={{ padding: 24 }}>
          <FieldLabel>Document Title</FieldLabel>
          <DarkInput value={docTitle} onChange={e => setDocTitle(e.target.value)}
            placeholder="e.g. IT.WI.019 Dataflows Work Instruction"
            style={{ marginBottom: 16 }} />
          <FieldLabel>Document Content</FieldLabel>
          <DarkTextarea value={docText} onChange={e => setDocText(e.target.value)}
            placeholder="Paste the full document text here. ARIA will extract and store the knowledge."
            rows={12} style={{ marginBottom: 20 }} />
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Btn icon="check" onClick={saveDocument} disabled={loading || !docTitle || !docText}>Save to Knowledge Base</Btn>
            {saved && <span style={{ fontSize: 13, color: T.success, fontWeight: 600, display: "flex", alignItems: "center", gap: 5 }}><Icon name="check" size={13} color={T.success} />Saved</span>}
          </div>
        </Card>
      )}

      {/* MANUAL MODE */}
      {mode === "manual" && (
        <Card style={{ padding: 24 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
            <div>
              <FieldLabel>Topic *</FieldLabel>
              <DarkInput value={manualTopic} onChange={e => setManualTopic(e.target.value)} placeholder="e.g. SAP-Magento Order Integration" />
            </div>
            <div>
              <FieldLabel>Category</FieldLabel>
              <DarkSelect value={manualCategory} onChange={e => setManualCategory(e.target.value)} style={{ width: "100%" }}>
                {["manual","dataflow","application","change","ticket","project","document","business-rule","architecture","process"].map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </DarkSelect>
            </div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <FieldLabel>Content *</FieldLabel>
            <DarkTextarea value={manualContent} onChange={e => setManualContent(e.target.value)}
              placeholder="Describe this knowledge entry in detail. The more context, the better ARIA will understand it."
              rows={6} />
          </div>
          <div style={{ marginBottom: 20 }}>
            <FieldLabel>Tags (comma separated)</FieldLabel>
            <DarkInput value={manualTags} onChange={e => setManualTags(e.target.value)} placeholder="sap, magento, order, integration" />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Btn icon="check" onClick={saveManual} disabled={loading || !manualTopic || !manualContent}>Save Entry</Btn>
            {saved && <span style={{ fontSize: 13, color: T.success, fontWeight: 600, display: "flex", alignItems: "center", gap: 5 }}><Icon name="check" size={13} color={T.success} />Saved</span>}
          </div>
        </Card>
      )}
    </div>
  );
};


// ── MEMORY ───────────────────────────────────────────────
const MemoryView = ({ api }) => {
  const [memory, setMemory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [editId, setEditId] = useState(null);
  const [editContent, setEditContent] = useState("");
  const [search, setSearch] = useState("");

  const load = async () => {
    setLoading(true);
    setLoadError(null);
    try { const d = await api.get(`/api/memory?search=${search}`); setMemory(Array.isArray(d) ? d : []); }
    catch (e) { setLoadError(e.message); }
    setLoading(false);
  };

  useEffect(() => { load(); }, [search]);

  const saveEdit = async (id) => { await api.put(`/api/memory/${id}`, { content: editContent }); setEditId(null); load(); };
  const deleteMemory = async (id) => { await api.del(`/api/memory/${id}`); load(); };

  return (
    <div>
      <SectionHeader title="Memory" subtitle="View and correct what ARIA has learned. Edit wrong information directly."
        actions={<Btn size="sm" variant="secondary" icon="refresh" onClick={load}>Refresh</Btn>} />

      <div style={{ marginBottom: 20 }}>
        <DarkInput value={search} onChange={e => setSearch(e.target.value)} placeholder="Search memory..." />
      </div>

      {loadError && (
        <Card style={{ marginBottom: 16, borderColor: T.error || '#e53e3e' }}>
          <div style={{ color: T.error || '#e53e3e', fontSize: 13 }}>⚠ Failed to load memory: {loadError}</div>
        </Card>
      )}
      {loading ? (
        <div style={{ textAlign: "center", padding: 48, color: T.textMuted }}>Loading...</div>
      ) : memory.length === 0 ? (
        <Card><EmptyState icon="memory" title="No memory yet" description="Train ARIA through chat or knowledge base imports to start building memory." /></Card>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {memory.map(item => (
            <Card key={item.id} style={{ padding: "16px 20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center" }}>
                    <Badge label={item.category || "general"} color={T.accent} />
                    <span style={{ fontSize: 12, fontWeight: 600, color: T.text }}>{item.topic}</span>
                  </div>
                  {editId === item.id ? (
                    <div>
                      <DarkTextarea value={editContent} onChange={e => setEditContent(e.target.value)} rows={4} style={{ marginBottom: 10 }} />
                      <div style={{ display: "flex", gap: 8 }}>
                        <Btn size="sm" icon="check" onClick={() => saveEdit(item.id)}>Save</Btn>
                        <Btn size="sm" variant="secondary" onClick={() => setEditId(null)}>Cancel</Btn>
                      </div>
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, color: T.textMuted, lineHeight: 1.65 }}>
                      {(item.content || "").substring(0, 300)}{item.content?.length > 300 ? "..." : ""}
                    </div>
                  )}
                  <div style={{ fontSize: 10, color: T.textDim, marginTop: 8 }}>{item.createdAt?.substring(0, 16)}</div>
                </div>
                {editId !== item.id && (
                  <div style={{ display: "flex", gap: 6, marginLeft: 16, flexShrink: 0 }}>
                    <button onClick={() => { setEditId(item.id); setEditContent(item.content || ""); }} style={{ background: "none", border: "none", cursor: "pointer", padding: 5, color: T.textMuted }}
                      onMouseEnter={e => e.currentTarget.style.color = T.accent}
                      onMouseLeave={e => e.currentTarget.style.color = T.textMuted}>
                      <Icon name="edit" size={14} color="currentColor" />
                    </button>
                    <button onClick={() => deleteMemory(item.id)} style={{ background: "none", border: "none", cursor: "pointer", padding: 5, color: T.textMuted }}
                      onMouseEnter={e => e.currentTarget.style.color = T.danger}
                      onMouseLeave={e => e.currentTarget.style.color = T.textMuted}>
                      <Icon name="trash" size={14} color="currentColor" />
                    </button>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

// ── ARCHITECTURE MAP ─────────────────────────────────────
const ArchitectureMap = ({ api }) => {
  const canvasRef  = useRef(null);
  const simRef     = useRef({ nodes: [], edges: [], running: false, alpha: 1 });
  const viewRef    = useRef({ x: 0, y: 0, scale: 1 });
  const dragRef    = useRef({ active: false, nodeId: null, lastX: 0, lastY: 0, isPan: false });
  const rafRef     = useRef(null);
  const hoverRef   = useRef(null);
  const viewModeRef  = useRef('simple');
  const selectedRef  = useRef(null);
  const focusedRef   = useRef(null);

  const [loading,     setLoading]     = useState(false);
  const [nodeCount,   setNodeCount]   = useState(0);
  const [edgeCount,   setEdgeCount]   = useState(0);
  const [selected,    setSelected]    = useState(null);
  const [focused,     setFocused]     = useState(null); // node driving canvas filter
  const [search,      setSearch]      = useState('');
  const [view,        setView]        = useState('simple'); // 'simple' | 'detailed'
  const [editingGlpiId,  setEditingGlpiId]  = useState(false);
  const [glpiIdDraft,    setGlpiIdDraft]    = useState('');
  const [savingGlpiId,   setSavingGlpiId]   = useState(false);
  const [kbGlpiId,       setKbGlpiId]       = useState('');
  const [appFilters,     setAppFilters]     = useState([]);
  const [filterOpen,     setFilterOpen]     = useState(false);
  const [appSearch,      setAppSearch]      = useState('');
  const [appNames,       setAppNames]       = useState([]);
  const appFiltersRef = useRef([]);
  const [dfFilters,      setDfFilters]      = useState([]);
  const [dfSearch,       setDfSearch]       = useState('');
  const [dfFilterOpen,   setDfFilterOpen]   = useState(false);
  const [dfNames,        setDfNames]        = useState([]);
  const dfFiltersRef = useRef([]);
  const [pendingCanvasFilters, setPendingCanvasFilters] = useState([]); // Ctrl+click staging
  const pendingRef = useRef([]);
  const [mapTab,           setMapTab]           = useState('apps'); // 'apps' | 'dataflows'
  const [appStatuses,      setAppStatuses]      = useState([]);
  const [dfStatuses,       setDfStatuses]       = useState([]);
  const [appStatusFilter,  setAppStatusFilter]  = useState([]); // [] = show all
  const [dfStatusFilter,   setDfStatusFilter]   = useState([]); // [] = show all
  const [appStatusOpen,    setAppStatusOpen]    = useState(false);
  const [dfStatusOpen,     setDfStatusOpen]     = useState(false);
  const appStatusRef = useRef([]);
  const dfStatusRef  = useRef([]);

  // ── Load graph ──────────────────────────────────────────
  const load = async () => {
    setLoading(true);
    setSelected(null);
    setFocused(null);
    setAppFilters([]);
    setDfFilters([]);
    try {
      const data = await api.get('/api/graph');
      const W = canvasRef.current?.width  || 900;
      const H = canvasRef.current?.height || 600;
      const cx = W / 2, cy = H / 2, r = Math.min(W, H) * 0.35;
      const n = data.nodes.length;
      const simNodes = data.nodes.map((node, i) => ({
        ...node,
        x: cx + r * Math.cos((2 * Math.PI * i) / n),
        y: cy + r * Math.sin((2 * Math.PI * i) / n),
        vx: 0, vy: 0, fixed: false,
      }));
      simRef.current = { nodes: simNodes, edges: data.edges, running: true, alpha: 1 };
      setNodeCount(n);
      setEdgeCount(data.edges.length);
      viewRef.current = { x: 0, y: 0, scale: 1 };
      const stripPfx = s => s.replace(/^(\[[^\]]*\]\s*-?\s*)+/, '').replace(/^-\s+/, '').trim() || s;
      const appNodes = data.nodes.filter(nd => nd.label === 'Application');
      const dfNodes  = data.nodes.filter(nd => nd.label === 'Dataflow');
      setAppNames(appNodes.map(nd => nd.properties?.name || nd.name).filter(Boolean).sort((a,b) => a.localeCompare(b)));
      const rawDfNames = [...new Set(dfNodes.map(nd => stripPfx(nd.properties?.desc || nd.properties?.name || nd.name || '')).filter(Boolean))].sort((a,b) => a.localeCompare(b));
      setDfNames(rawDfNames);
      // Filter out empty, "0", "false" — GLPI returns 0 when state is unassigned
      const validStatus = v => v && v !== '0' && v !== 'false' && v.trim().length > 0;
      setAppStatuses([...new Set(appNodes.map(nd => (nd.properties?.status || '').trim()).filter(validStatus))].sort());
      setDfStatuses([...new Set(dfNodes.map(nd => (nd.properties?.status || '').trim()).filter(validStatus))].sort());
    } catch {}
    setLoading(false);
  };

  // ── Force simulation tick ───────────────────────────────
  const tick = () => {
    const { nodes, edges, alpha } = simRef.current;
    if (!nodes.length) return;
    const W = canvasRef.current?.width  || 900;
    const H = canvasRef.current?.height || 600;
    const cx = W / 2, cy = H / 2;

    // Repulsion (Barnes-Hut approximation — just all pairs for simplicity)
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[j].x - nodes[i].x || 0.01;
        const dy = nodes[j].y - nodes[i].y || 0.01;
        const dist2 = dx * dx + dy * dy;
        const dist  = Math.sqrt(dist2);
        const force = (6000 / dist2) * alpha;
        const fx = force * dx / dist, fy = force * dy / dist;
        nodes[i].vx -= fx; nodes[i].vy -= fy;
        nodes[j].vx += fx; nodes[j].vy += fy;
      }
    }

    // Spring attraction along edges
    const nodeMap = {};
    nodes.forEach(n => { nodeMap[n.id] = n; });
    for (const e of edges) {
      const s = nodeMap[e.source], t = nodeMap[e.target];
      if (!s || !t) continue;
      const dx = t.x - s.x, dy = t.y - s.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const target = s.label === 'Dataflow' || t.label === 'Dataflow' ? 100 : 160;
      const force = (dist - target) * 0.04 * alpha;
      const fx = force * dx / dist, fy = force * dy / dist;
      if (!s.fixed) { s.vx += fx; s.vy += fy; }
      if (!t.fixed) { t.vx -= fx; t.vy -= fy; }
    }

    // Gravity toward center + damping + integrate
    for (const n of nodes) {
      if (n.fixed) { n.vx = 0; n.vy = 0; continue; }
      n.vx += (cx - n.x) * 0.002 * alpha;
      n.vy += (cy - n.y) * 0.002 * alpha;
      n.vx *= 0.82; n.vy *= 0.82;
      n.x += n.vx; n.y += n.vy;
    }

    simRef.current.alpha = Math.max(0.001, alpha * 0.994);
  };

  // ── Canvas render ───────────────────────────────────────
  const render = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const { x: ox, y: oy, scale } = viewRef.current;
    const { nodes, edges } = simRef.current;
    const W = canvas.width, H = canvas.height;

    ctx.clearRect(0, 0, W, H);
    ctx.save();
    ctx.translate(ox, oy);
    ctx.scale(scale, scale);

    const sq = search.toLowerCase().trim();
    const isSimple = viewModeRef.current !== 'detailed';

    // ── Helpers ────────────────────────────────────────────
    const stripPrefix = name => name
      .replace(/^(\[[^\]]*\]\s*-?\s*)+/, '') // strip [X]-, [X] -, [X] - [Y] - … prefixes
      .replace(/^-\s+/, '')                   // strip any orphan leading "- "
      .trim() || name;
    const decodeHTML  = s => s.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n)).replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"');
    const cleanName   = name => decodeHTML(name);

    // Status → color mapping
    const statusColor = (status, defaultColor) => {
      const s = (status || '').toLowerCase().trim();
      if (!s || s === '0' || s === 'false') return defaultColor;
      // Removed / retired / end-of-life (EN + PT)
      if (s.includes('remov') || s.includes('retir') || s.includes('delet') || s.includes('stop') ||
          s.includes('removid') || s.includes('descontinuad') || s.includes('descom') ||
          s.includes('end of life') || s.includes('eol') || s.includes('decommission')) return T.danger;
      // Deprecated / obsolete (EN + PT)
      if (s.includes('deprecat') || s.includes('obsolet') || s.includes('legad') || s.includes('obsoleto')) return T.warning;
      // Dev / test / staging (EN + PT)
      if (s.includes('dev') || s.includes('test') || s.includes('staging') || s.includes('pilot') ||
          s.includes('homolog') || s.includes('qualidade') || s.includes('qa') || s.includes('validaç')) return '#F59E0B';
      // Active / in production (EN + PT)
      if (s.includes('active') || s.includes('in use') || s.includes('product') || s.includes('live') ||
          s.includes('operacion') || s.includes('produção') || s.includes('producao') || s.includes('produc') ||
          s.includes('ativo') || s.includes('activo') || s.includes('em uso') || s.includes('em prod') ||
          s.includes('em operação') || s.includes('operational')) return T.success;
      // Inactive / disabled (EN + PT)
      if (s.includes('inactive') || s.includes('disabl') || s.includes('suspend') ||
          s.includes('inativo') || s.includes('inactivo') || s.includes('desativ') ||
          s.includes('pausad') || s.includes('suspenso')) return T.textMuted;
      // Fallback: deterministic color from palette for any unrecognized non-empty status
      // This ensures nodes with ANY status are visually distinct from nodes with no status
      const PALETTE = ['#8B5CF6', '#06B6D4', '#EC4899', '#14B8A6', '#F97316', '#6366F1'];
      let hash = 0;
      for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) & 0xFFFFFFFF;
      return PALETTE[Math.abs(hash) % PALETTE.length];
    };

    // ── Shared filter computation ───────────────────────────
    const fullNodeMap = {};
    nodes.forEach(n => { fullNodeMap[n.id] = n; });

    // Status filters
    const activeAppStatus = appStatusRef.current.length > 0 ? new Set(appStatusRef.current) : null;
    const activeDfStatus  = dfStatusRef.current.length  > 0 ? new Set(dfStatusRef.current)  : null;

    const dropFilters  = appFiltersRef.current;
    const focName      = focusedRef.current?.name;
    const activeDfSet  = dfFiltersRef.current.length > 0 ? new Set(dfFiltersRef.current) : null;
    const activeAppNames = dropFilters.length > 0 ? new Set(dropFilters) : (focName ? new Set([focName]) : null);

    // Build ALL app→app dfGroups (shared by both views)
    const allDfGroups = {};
    for (const df of nodes.filter(n => n.label === 'Dataflow')) {
      const inEdge  = edges.find(e => e.target === df.id);
      const outEdge = edges.find(e => e.source === df.id);
      if (!inEdge || !outEdge) continue;
      const src = fullNodeMap[inEdge.source];
      const dst = fullNodeMap[outEdge.target];
      if (!src || !dst || src.label !== 'Application' || dst.label !== 'Application') continue;
      const rawLabel = stripPrefix(df.properties?.desc || df.name || '');
      if (!rawLabel) continue; // skip dataflows with no label after stripping
      if (activeDfSet && !activeDfSet.has(rawLabel)) continue; // df name filter
      if (activeDfStatus && !activeDfStatus.has(df.properties?.status || '')) continue; // df status filter
      if (activeAppStatus && (!activeAppStatus.has(src.properties?.status || '') || !activeAppStatus.has(dst.properties?.status || ''))) continue; // app status filter
      const key = `${src.id}→${dst.id}`;
      if (!allDfGroups[key]) allDfGroups[key] = { src, dst, names: [], dfIds: [] };
      allDfGroups[key].names.push({ label: rawLabel, isHighlit: sq && rawLabel.toLowerCase().includes(sq) });
      allDfGroups[key].dfIds.push(df.id);
    }

    // Bridge expansion for multi-app filter
    // Track which DISTINCT selected apps each neighbor connects to (not raw edge count)
    // so bidirectional edges to the same selected app don't double-count
    let visibleAppNames = activeAppNames;
    if (activeAppNames && activeAppNames.size > 1) {
      const neighborToSelectedApps = {}; // neighborName → Set of selected app names it connects to
      for (const { src, dst } of Object.values(allDfGroups)) {
        const srcSel = activeAppNames.has(src.name), dstSel = activeAppNames.has(dst.name);
        if (srcSel && !dstSel) {
          if (!neighborToSelectedApps[dst.name]) neighborToSelectedApps[dst.name] = new Set();
          neighborToSelectedApps[dst.name].add(src.name);
        }
        if (dstSel && !srcSel) {
          if (!neighborToSelectedApps[src.name]) neighborToSelectedApps[src.name] = new Set();
          neighborToSelectedApps[src.name].add(dst.name);
        }
      }
      visibleAppNames = new Set(activeAppNames);
      for (const [name, connectedTo] of Object.entries(neighborToSelectedApps)) {
        if (connectedTo.size >= 2) visibleAppNames.add(name); // only true bridges
      }
    }

    // Filter dfGroups by visible app names
    const hasAnyFilter = visibleAppNames || activeDfSet || activeAppStatus || activeDfStatus;
    const dfGroups = {};
    for (const [key, grp] of Object.entries(allDfGroups)) {
      if (!visibleAppNames) { dfGroups[key] = grp; continue; }
      if (visibleAppNames.has(grp.src.name) && visibleAppNames.has(grp.dst.name)) dfGroups[key] = grp;
    }

    // Compute visible app IDs (shared)
    const visAppIds = new Set();
    for (const { src, dst } of Object.values(dfGroups)) { visAppIds.add(src.id); visAppIds.add(dst.id); }

    // ── Draw: Simple view ───────────────────────────────────
    let drawNodes;
    if (isSimple) {
      drawNodes = hasAnyFilter
        ? nodes.filter(n => n.label === 'Application' && visAppIds.has(n.id))
        : nodes.filter(n => n.label === 'Application');
      const simpleVisMap = {};
      drawNodes.forEach(n => { simpleVisMap[n.id] = n; });

      for (const { src, dst, names } of Object.values(dfGroups)) {
        if (!simpleVisMap[src.id] || !simpleVisMap[dst.id]) continue;
        const ang = Math.atan2(dst.y - src.y, dst.x - src.x);
        const sx = src.x + 22 * Math.cos(ang), sy = src.y + 22 * Math.sin(ang);
        const tx = dst.x - 22 * Math.cos(ang), ty = dst.y - 22 * Math.sin(ang);
        const isHighlit = sq && names.some(n => n.isHighlit);

        ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(tx, ty);
        ctx.strokeStyle = isHighlit ? T.accent + 'ee' : T.accent + '66';
        ctx.lineWidth = isHighlit ? 2 : 1.5; ctx.stroke();

        ctx.beginPath(); ctx.moveTo(tx, ty);
        ctx.lineTo(tx - 12 * Math.cos(ang - 0.35), ty - 12 * Math.sin(ang - 0.35));
        ctx.lineTo(tx - 12 * Math.cos(ang + 0.35), ty - 12 * Math.sin(ang + 0.35));
        ctx.closePath(); ctx.fillStyle = isHighlit ? T.accent : T.accent + 'aa'; ctx.fill();

        if (hasAnyFilter) {
          const midX = (sx + tx) / 2, midY = (sy + ty) / 2;
          const perpX = -Math.sin(ang), perpY = Math.cos(ang);
          const lineH = 13, totalH = names.length * lineH;
          ctx.font = '9px system-ui, sans-serif'; ctx.textAlign = 'center';
          names.forEach(({ label, isHighlit: hl }, i) => {
            const offset = -(totalH / 2) + i * lineH + 6;
            const lx = midX + perpX * (offset + 18), ly = midY + perpY * (offset + 18);
            const tw = ctx.measureText(label).width;
            ctx.fillStyle = T.bg + 'dd';
            ctx.fillRect(lx - tw / 2 - 2, ly - 9, tw + 4, 12);
            ctx.fillStyle = hl ? T.success : T.textSecondary;
            ctx.fillText(label, lx, ly);
          });
        }
      }
    } else {
      // ── Draw: Detailed view ─────────────────────────────────
      // Compute visible node IDs (apps + their connected dataflows)
      const visDfIds = new Set();
      if (hasAnyFilter) {
        for (const { dfIds } of Object.values(dfGroups)) dfIds.forEach(id => visDfIds.add(id));
        drawNodes = nodes.filter(n => visAppIds.has(n.id) || visDfIds.has(n.id));
      } else {
        drawNodes = nodes;
      }
      const detailMap = {}; drawNodes.forEach(n => { detailMap[n.id] = n; });

      for (const e of edges) {
        const s = detailMap[e.source], t = detailMap[e.target];
        if (!s || !t) continue;
        // Only draw edges that involve at least one Dataflow node — skip direct app-to-app edges
        if (s.label === 'Application' && t.label === 'Application') continue;
        const isHighlit = sq && (s.name.toLowerCase().includes(sq) || t.name.toLowerCase().includes(sq));
        ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(t.x, t.y);
        ctx.strokeStyle = isHighlit ? T.accent + 'cc' : T.accent + '66';
        ctx.lineWidth = isHighlit ? 2 : 1.5; ctx.stroke();
        const ang = Math.atan2(t.y - s.y, t.x - s.x);
        const nr = t.label === 'Dataflow' ? 10 : 18;
        const ax = t.x - nr * Math.cos(ang), ay = t.y - nr * Math.sin(ang);
        ctx.beginPath(); ctx.moveTo(ax, ay);
        ctx.lineTo(ax - 12 * Math.cos(ang - 0.35), ay - 12 * Math.sin(ang - 0.35));
        ctx.lineTo(ax - 12 * Math.cos(ang + 0.35), ay - 12 * Math.sin(ang + 0.35));
        ctx.closePath(); ctx.fillStyle = isHighlit ? T.accent : T.accent + 'aa'; ctx.fill();
      }
    }
    for (const n of drawNodes) {
      const isSelected = selectedRef.current?.id === n.id || selectedRef.current?.name === n.name;
      const isHover    = hoverRef.current === n.id;
      const isHighlit  = sq && n.name.toLowerCase().includes(sq);
      const isPending  = n.label === 'Application' && pendingRef.current.includes(n.properties?.name || n.name);
      const isApp      = n.label === 'Application';
      const r          = isApp ? 20 : 11;
      const baseColor  = isApp ? T.accent : T.purple;
      const color      = statusColor(n.properties?.status, baseColor);

      // Glow for selected/highlighted/pending
      if (isSelected || isHighlit || isPending) {
        ctx.beginPath();
        ctx.arc(n.x, n.y, r + 6, 0, Math.PI * 2);
        ctx.fillStyle = (isPending ? T.teal : isSelected ? T.warning : T.success) + '33';
        ctx.fill();
      }

      // Pending dashed ring
      if (isPending) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(n.x, n.y, r + 4, 0, Math.PI * 2);
        ctx.strokeStyle = T.teal;
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 3]);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }

      // Circle
      ctx.beginPath();
      ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
      ctx.fillStyle = isPending ? T.teal + 'cc' : isSelected ? T.warning : isHighlit ? T.success : isHover ? color + 'dd' : color + (isApp ? 'cc' : '99');
      ctx.fill();
      ctx.strokeStyle = isPending ? T.teal : isSelected ? T.warning : color;
      ctx.lineWidth = (isPending || isSelected) ? 2.5 : 1.5;
      ctx.stroke();

      // Label
      const rawName = cleanName(n.label === 'Dataflow' ? stripPrefix(n.properties?.desc || n.name) : n.name);
      const label = rawName.length > 22 ? rawName.substring(0, 20) + '…' : rawName;
      ctx.font = `${isApp ? 600 : 400} ${isApp ? 11 : 9}px system-ui, sans-serif`;
      ctx.textAlign = 'center';

      // Label background
      const tw = ctx.measureText(label).width;
      ctx.fillStyle = T.bg + 'cc';
      ctx.fillRect(n.x - tw / 2 - 3, n.y + r + 2, tw + 6, 14);
      ctx.fillStyle = isPending ? T.teal : isSelected ? T.warning : isHighlit ? T.success : T.textSecondary;
      ctx.fillText(label, n.x, n.y + r + 13);
    }

    ctx.restore();
  };

  // ── Animation loop ──────────────────────────────────────
  const loop = () => {
    tick();
    render();
    rafRef.current = requestAnimationFrame(loop);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      canvas.width  = canvas.parentElement.clientWidth;
      canvas.height = canvas.parentElement.clientHeight;
    };
    resize();
    window.addEventListener('resize', resize);
    rafRef.current = requestAnimationFrame(loop);
    load();
    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
    };
  }, []);

  useEffect(() => { viewModeRef.current = view; selectedRef.current = selected; focusedRef.current = focused; appFiltersRef.current = appFilters; dfFiltersRef.current = dfFilters; pendingRef.current = pendingCanvasFilters; appStatusRef.current = appStatusFilter; dfStatusRef.current = dfStatusFilter; render(); }, [search, view, selected, focused, appFilters, dfFilters, pendingCanvasFilters, appStatusFilter, dfStatusFilter]);

  // ── Tab drives view mode ────────────────────────────────
  useEffect(() => { setView(mapTab === 'dataflows' ? 'detailed' : 'simple'); }, [mapTab]);

  // ── App filter dropdown → focus ─────────────────────────
  useEffect(() => {
    if (appFilters.length === 0) return;
    // Center on first selected app
    const node = simRef.current.nodes.find(n => (n.properties?.name || n.name) === appFilters[0]);
    if (!node) return;
    setFocused(null); // dropdown filter overrides double-click focus
    const v = viewRef.current;
    const canvas = canvasRef.current;
    if (canvas) { v.x = canvas.width / 2 - node.x * v.scale; v.y = canvas.height / 2 - node.y * v.scale; }
  }, [appFilters]);
  useEffect(() => {
    selectedRef.current = selected;
    setKbGlpiId('');
    if (!selected) return;
    setGlpiIdDraft(selected.properties?.glpiId || '');
    setEditingGlpiId(false);
    // Auto-lookup GLPI ID from knowledge base if not on the node
    if (!selected.properties?.glpiId) {
      const nodeIsApp = selected.label === 'Application';
      api.get(`/api/knowledge?search=${encodeURIComponent(selected.name)}`).then(entries => {
        if (!Array.isArray(entries)) return;
        // Filter to entries whose topic closely matches the node name
        const name = selected.name.toLowerCase();
        const matched = entries.filter(e => (e.topic || '').toLowerCase().includes(name));
        for (const e of matched) {
          if (nodeIsApp) {
            // For Application nodes: only use glpiId from application-category entries
            if (e.glpiId && (e.category === 'application' || e.category === 'appstructs')) {
              setKbGlpiId(e.glpiId); break;
            }
          } else {
            // For Dataflow nodes: use dataflowId from dataflow/talend entries
            const dfId = e.dataflowId || (e.tags || []).find(t => t.startsWith('dataflow-'))?.replace('dataflow-', '');
            if (dfId && (e.category === 'dataflow' || e.category === 'talend-job' || e.category === 'dataflows')) {
              setKbGlpiId(dfId); break;
            }
            if (e.glpiId && !nodeIsApp) { setKbGlpiId(e.glpiId); break; }
          }
        }
      }).catch(() => {});
    }
  }, [selected]);

  // ── Mouse interactions ──────────────────────────────────
  const canvasXY = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const { x: ox, y: oy, scale } = viewRef.current;
    return { x: (e.clientX - rect.left - ox) / scale, y: (e.clientY - rect.top - oy) / scale };
  };

  const hitTest = (wx, wy) => {
    const { nodes, edges } = simRef.current;
    const foc = focusedRef.current;
    // In focus mode skip the simple-view dataflow filter — focused view renders all connected nodes
    let vis = (viewModeRef.current === 'detailed' || foc) ? nodes : nodes.filter(n => n.label !== 'Dataflow');
    // In focus mode, only hit-test visible (focused) nodes
    if (foc) {
      const focNode = nodes.find(n => n.id === foc.id || n.name === foc.name);
      if (focNode) {
        const focEdges = edges.filter(e => e.source === focNode.id || e.target === focNode.id);
        const focIds = new Set([focNode.id, ...focEdges.map(e => e.source === focNode.id ? e.target : e.source)]);
        vis = vis.filter(n => focIds.has(n.id));
      }
    }
    for (let i = vis.length - 1; i >= 0; i--) {
      const n = vis[i];
      const r = n.label === 'Application' ? 20 : 11;
      const dx = wx - n.x, dy = wy - n.y;
      if (dx * dx + dy * dy <= r * r) return n;
    }
    return null;
  };

  const onMouseDown = (e) => {
    const { x, y } = canvasXY(e);
    const hit = hitTest(x, y);
    if (hit) {
      hit.fixed = true;
      dragRef.current = { active: true, nodeId: hit.id, lastX: e.clientX, lastY: e.clientY, isPan: false, startX: e.clientX, startY: e.clientY };
    } else {
      dragRef.current = { active: true, nodeId: null, lastX: e.clientX, lastY: e.clientY, isPan: true, startX: e.clientX, startY: e.clientY };
    }
  };

  const onMouseMove = (e) => {
    const { active, nodeId, lastX, lastY, isPan } = dragRef.current;
    const { x, y } = canvasXY(e);
    hoverRef.current = hitTest(x, y)?.id || null;

    if (!active) return;
    const dx = e.clientX - lastX, dy = e.clientY - lastY;
    dragRef.current.lastX = e.clientX;
    dragRef.current.lastY = e.clientY;

    if (isPan) {
      viewRef.current.x += dx;
      viewRef.current.y += dy;
    } else if (nodeId) {
      const n = simRef.current.nodes.find(n => n.id === nodeId);
      if (n) { n.x += dx / viewRef.current.scale; n.y += dy / viewRef.current.scale; }
    }
  };

  const onMouseUp = (e) => {
    const { nodeId } = dragRef.current;
    dragRef.current.active = false;
    if (nodeId) {
      const n = simRef.current.nodes.find(n => n.id === nodeId);
      if (n) { n.fixed = true; } // keep pinned after drag
    }
  };

  const onClick = (e) => {
    // Suppress click if user dragged more than 5px
    const { startX = e.clientX, startY = e.clientY } = dragRef.current;
    const moved = Math.abs(e.clientX - startX) + Math.abs(e.clientY - startY);
    if (moved > 5) return;
    const { x, y } = canvasXY(e);
    const hit = hitTest(x, y);

    // Ctrl+click (or Cmd+click) on an Application → stage it for filter
    if ((e.ctrlKey || e.metaKey) && hit && hit.label === 'Application') {
      const name = hit.properties?.name || hit.name;
      setPendingCanvasFilters(prev =>
        prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]
      );
      return;
    }

    setSelected(hit || null); // single click = open/close panel only
  };

  const onDoubleClick = (e) => {
    const { x, y } = canvasXY(e);
    const hit = hitTest(x, y);
    if (hit) {
      // Double click node = focus canvas on it + center view
      setFocused(hit);
      setSelected(hit);
      setAppFilters([]); // clear dropdown filter
      const v = viewRef.current;
      const canvas = canvasRef.current;
      if (canvas) {
        v.x = canvas.width  / 2 - hit.x * v.scale;
        v.y = canvas.height / 2 - hit.y * v.scale;
      }
    } else {
      // Double click empty = reset focus, show all
      setFocused(null);
      setSelected(null);
      setAppFilters([]);
    }
  };

  const onWheel = (e) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.1 : 0.91;
    const rect = canvasRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    const v = viewRef.current;
    v.x = mx - factor * (mx - v.x);
    v.y = my - factor * (my - v.y);
    v.scale = Math.max(0.15, Math.min(4, v.scale * factor));
  };

  const zoom = (factor) => {
    const v = viewRef.current;
    const W = canvasRef.current?.width || 900, H = canvasRef.current?.height || 600;
    v.x = W / 2 - factor * (W / 2 - v.x);
    v.y = H / 2 - factor * (H / 2 - v.y);
    v.scale = Math.max(0.15, Math.min(4, v.scale * factor));
  };

  const resetView = () => { viewRef.current = { x: 0, y: 0, scale: 1 }; };
  const reheat    = () => { simRef.current.alpha = 1; simRef.current.nodes.forEach(n => { n.fixed = false; n.vx = 0; n.vy = 0; }); };

  // ── Node detail panel ───────────────────────────────────
  const NodePanel = ({ node }) => {
    if (!node) return null;
    const p = node.properties || {};
    const isApp = node.label === 'Application';
    const color = isApp ? T.accent : T.purple;
    const fields = [
      p.status      && ['Status',      p.status],
      p.type        && ['Type',        p.type],
      p.supplier    && ['Supplier',    p.supplier],
      !isApp && (p.priority && ['Priority', p.priority]),
      !isApp && (p.gdpr || p.gdprLevel) && ['GDPR Level', p.gdpr || p.gdprLevel],
      p.urlProd     && ['URL Prod',    p.urlProd],
      isApp  && (p.targets || p.target) && ['Targets', p.targets || p.target],
      p.protocol    && ['Protocol',    p.protocol],
      p.sourceApp   && ['From',        p.sourceApp],
      p.destApp     && ['To',          p.destApp],
    ].filter(Boolean);

    const glpiUrl = (() => { try { return JSON.parse(localStorage.getItem('aria_config') || '{}').glpiUrl || ''; } catch { return ''; } })();
    const glpiFormPath = isApp
      ? 'marketplace/archisw/front/swcomponent.form.php'
      : 'marketplace/dataflows/front/dataflow.form.php';

    // Resolve GLPI ID: node property first, then fall back to knowledge base lookup
    // kbGlpiId is set by the useEffect below when selected changes
    const resolvedGlpiId = p.glpiId || kbGlpiId;
    const glpiLink = glpiUrl && resolvedGlpiId
      ? `${glpiUrl}/${glpiFormPath}?id=${resolvedGlpiId}`
      : null;
    const glpiLinkLabel = resolvedGlpiId
      ? `GLPI #${resolvedGlpiId} — ${node.name}`
      : null;

    const saveGlpiId = async () => {
      if (!glpiIdDraft.trim()) return;
      setSavingGlpiId(true);
      try {
        await api.patch('/api/graph/node', { name: node.name, label: node.label, props: { glpiId: glpiIdDraft.trim() } });
        node.properties = { ...p, glpiId: glpiIdDraft.trim() };
        setEditingGlpiId(false);
        load();
      } catch (e) { console.error(e); }
      setSavingGlpiId(false);
    };

    return (
      <div style={{ width: 260, flexShrink: 0, background: T.bgElevated, borderLeft: `1px solid ${T.border}`, overflowY: 'auto', padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: color + '22', border: `2px solid ${color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Icon name={isApp ? 'monitor' : 'flow'} size={14} color={color} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: T.text, lineHeight: 1.3 }}>{node.name}</div>
            <div style={{ fontSize: 11, color: color, fontWeight: 600 }}>{node.label}</div>
          </div>
          <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: T.textDim, cursor: 'pointer', fontSize: 18, lineHeight: 1, flexShrink: 0 }}>×</button>
        </div>

        {/* GLPI link — auto-resolved from node property or knowledge base */}
        {glpiUrl && (
          <div style={{ marginBottom: 14 }}>
            {glpiLink && !editingGlpiId ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <a href={glpiLink} target="_blank" rel="noreferrer"
                  style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6, padding: '7px 11px', borderRadius: 7, background: T.accentGlow, border: `1px solid ${T.accent}30`, textDecoration: 'none' }}>
                  <Icon name="link2" size={13} color={T.accent} />
                  <span style={{ fontSize: 12, fontWeight: 600, color: T.accent }}>{glpiLinkLabel}</span>
                </a>
                <button onClick={() => { setGlpiIdDraft(resolvedGlpiId); setEditingGlpiId(true); }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.textDim, padding: 4, display: 'flex' }} title="Edit GLPI ID">
                  <Icon name="edit" size={13} color="currentColor" />
                </button>
              </div>
            ) : editingGlpiId ? (
              <div>
                <div style={{ fontSize: 10, fontWeight: 600, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>GLPI ID</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input value={glpiIdDraft} onChange={e => setGlpiIdDraft(e.target.value.replace(/\D/g, ''))}
                    placeholder="e.g. 866"
                    style={{ flex: 1, background: T.bg, border: `1px solid ${T.accent}60`, borderRadius: 6, color: T.text, fontSize: 12, padding: '5px 9px', fontFamily: 'inherit' }} />
                  <button onClick={saveGlpiId} disabled={savingGlpiId}
                    style={{ background: T.accent, border: 'none', borderRadius: 6, color: '#fff', fontSize: 11, fontWeight: 700, padding: '5px 10px', cursor: 'pointer', fontFamily: 'inherit' }}>
                    {savingGlpiId ? '…' : 'Save'}
                  </button>
                  <button onClick={() => setEditingGlpiId(false)}
                    style={{ background: 'none', border: `1px solid ${T.border}`, borderRadius: 6, color: T.textMuted, fontSize: 11, padding: '5px 8px', cursor: 'pointer' }}>✕</button>
                </div>
              </div>
            ) : (
              <button onClick={() => { setGlpiIdDraft(''); setEditingGlpiId(true); }}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 6, padding: '7px 11px', borderRadius: 7, background: 'transparent', border: `1px dashed ${T.border}`, color: T.textDim, cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' }}>
                <Icon name="link2" size={13} color={T.textDim} />
                <span>Set GLPI ID</span>
              </button>
            )}
          </div>
        )}

        {fields.map(([k, v]) => (
          <div key={k} style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>{k}</div>
            <div style={{ fontSize: 12, color: T.textSecondary, wordBreak: 'break-all' }}>{String(v)}</div>
          </div>
        ))}
        {p.source && (
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${T.border}`, fontSize: 11, color: T.textDim }}>
            Source: <strong style={{ color: T.textMuted }}>{p.source}</strong>
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Toolbar — single unified bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', background: T.bgElevated, borderBottom: `1px solid ${T.border}`, flexShrink: 0, flexWrap: 'wrap' }}>
        {/* Title + stats */}
        <span style={{ fontSize: 13, fontWeight: 700, color: T.text }}>Architecture Map</span>
        <span style={{ fontSize: 11, color: T.textMuted, marginRight: 4 }}>{nodeCount} nodes · {edgeCount} edges</span>
        {/* Tab bar — Applications = apps-only view, Dataflows = detailed view */}
        <span style={{ display: 'flex', background: T.bg, border: `1px solid ${T.border}`, borderRadius: 8, padding: 3, gap: 2 }}>
          {[['apps', 'Applications', T.accent], ['dataflows', 'Dataflows', T.purple]].map(([v, lbl, col]) => (
            <button key={v} onClick={() => setMapTab(v)}
              style={{ background: mapTab === v ? col + '22' : 'transparent', color: mapTab === v ? col : T.textMuted, border: mapTab === v ? `1px solid ${col}44` : '1px solid transparent', borderRadius: 6, padding: '4px 14px', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              {lbl}
            </button>
          ))}
        </span>
        {/* Divider */}
        <div style={{ width: 1, height: 20, background: T.border }} />
        {/* Tab-specific filters */}
        {mapTab === 'apps' ? (
          <>
            {/* App name filter */}
            <div style={{ position: 'relative' }}>
              <button onClick={() => setFilterOpen(o => !o)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, background: T.bgElevated, border: `1px solid ${appFilters.length ? T.accent : T.border}`, borderRadius: 7, color: appFilters.length ? T.accent : T.textMuted, fontSize: 12, padding: '5px 10px', cursor: 'pointer', fontFamily: 'inherit', minWidth: 160 }}>
                <Icon name="monitor" size={12} color="currentColor" />
                <span style={{ flex: 1, textAlign: 'left' }}>{appFilters.length ? `${appFilters.length} app${appFilters.length > 1 ? 's' : ''} selected` : 'Filter by app…'}</span>
                <span style={{ fontSize: 10 }}>▾</span>
              </button>
              {filterOpen && (
                <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 200, background: T.bgElevated, border: `1px solid ${T.border}`, borderRadius: 8, width: 280, boxShadow: '0 8px 24px #0009' }}
                  onMouseLeave={() => setFilterOpen(false)}>
                  <div style={{ padding: '8px 10px', borderBottom: `1px solid ${T.border}` }}>
                    <DarkInput value={appSearch} onChange={e => setAppSearch(e.target.value)} placeholder="Search apps…" style={{ width: '100%', padding: '5px 8px', fontSize: 12 }} />
                  </div>
                  {appFilters.length > 0 && (
                    <button onClick={() => { setAppFilters([]); setFocused(null); }}
                      style={{ width: '100%', padding: '6px 12px', textAlign: 'left', background: 'none', border: 'none', borderBottom: `1px solid ${T.border}`, color: T.danger, cursor: 'pointer', fontSize: 11, fontFamily: 'inherit' }}>
                      Clear all
                    </button>
                  )}
                  <div style={{ maxHeight: 220, overflowY: 'auto' }}>
                    {appNames.filter(n => !appSearch || n.toLowerCase().includes(appSearch.toLowerCase())).map(name => (
                      <label key={name} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', cursor: 'pointer', borderBottom: `1px solid ${T.border}20` }}>
                        <input type="checkbox" checked={appFilters.includes(name)}
                          onChange={() => setAppFilters(prev => prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name])}
                          style={{ accentColor: T.accent, cursor: 'pointer' }} />
                        <span style={{ fontSize: 12, color: T.textSecondary }}>{name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
            {/* App status filter — only shown when GLPI has states configured */}
            {appStatuses.length > 0 ? (
              <div style={{ position: 'relative' }}>
                <button onClick={() => setAppStatusOpen(o => !o)}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, background: T.bgElevated, border: `1px solid ${appStatusFilter.length ? T.accent : T.border}`, borderRadius: 7, color: appStatusFilter.length ? T.accent : T.textMuted, fontSize: 12, padding: '5px 10px', cursor: 'pointer', fontFamily: 'inherit', minWidth: 140 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: appStatusFilter.length ? T.accent : T.textDim, flexShrink: 0 }} />
                  <span style={{ flex: 1, textAlign: 'left' }}>{appStatusFilter.length ? `${appStatusFilter.length} status${appStatusFilter.length > 1 ? 'es' : ''}` : 'Filter by status…'}</span>
                  <span style={{ fontSize: 10 }}>▾</span>
                </button>
                {appStatusOpen && (
                  <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 200, background: T.bgElevated, border: `1px solid ${T.border}`, borderRadius: 8, width: 240, boxShadow: '0 8px 24px #0009' }}
                    onMouseLeave={() => setAppStatusOpen(false)}>
                    {appStatusFilter.length > 0 && (
                      <button onClick={() => setAppStatusFilter([])}
                        style={{ width: '100%', padding: '6px 12px', textAlign: 'left', background: 'none', border: 'none', borderBottom: `1px solid ${T.border}`, color: T.danger, cursor: 'pointer', fontSize: 11, fontFamily: 'inherit' }}>
                        Clear all
                      </button>
                    )}
                    <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                      {appStatuses.map(st => {
                        const sLow = st.toLowerCase();
                        const dot = sLow.includes('remov') || sLow.includes('retir') ? T.danger : sLow.includes('deprecat') ? T.warning : sLow.includes('active') || sLow.includes('in use') || sLow.includes('product') ? T.success : sLow.includes('dev') || sLow.includes('test') ? '#F59E0B' : T.textMuted;
                        return (
                          <label key={st} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', cursor: 'pointer', borderBottom: `1px solid ${T.border}20` }}>
                            <input type="checkbox" checked={appStatusFilter.includes(st)}
                              onChange={() => setAppStatusFilter(prev => prev.includes(st) ? prev.filter(s => s !== st) : [...prev, st])}
                              style={{ accentColor: T.accent, cursor: 'pointer' }} />
                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: dot, flexShrink: 0 }} />
                            <span style={{ fontSize: 12, color: T.textSecondary }}>{st}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <span style={{ fontSize: 11, color: T.textDim, fontStyle: 'italic' }}>No states configured in GLPI for apps</span>
            )}
            {/* Global clear button */}
            {(focused || appFilters.length > 0 || appStatusFilter.length > 0) && (
              <button onClick={() => { setFocused(null); setSelected(null); setAppFilters([]); setAppStatusFilter([]); setPendingCanvasFilters([]); }}
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 7, background: T.danger + '18', border: `1px solid ${T.danger}40`, color: T.danger, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                <span>×</span> Clear filters
              </button>
            )}
          </>
        ) : (
          <>
            {/* Dataflow name filter */}
            <div style={{ position: 'relative' }}>
              <button onClick={() => setDfFilterOpen(o => !o)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, background: T.bgElevated, border: `1px solid ${dfFilters.length ? T.purple : T.border}`, borderRadius: 7, color: dfFilters.length ? T.purple : T.textMuted, fontSize: 12, padding: '5px 10px', cursor: 'pointer', fontFamily: 'inherit', minWidth: 170 }}>
                <Icon name="flow" size={12} color="currentColor" />
                <span style={{ flex: 1, textAlign: 'left' }}>{dfFilters.length ? `${dfFilters.length} dataflow${dfFilters.length > 1 ? 's' : ''}` : 'Filter by dataflow…'}</span>
                <span style={{ fontSize: 10 }}>▾</span>
              </button>
              {dfFilterOpen && (
                <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 200, background: T.bgElevated, border: `1px solid ${T.border}`, borderRadius: 8, width: 280, boxShadow: '0 8px 24px #0009' }}
                  onMouseLeave={() => setDfFilterOpen(false)}>
                  <div style={{ padding: '8px 10px', borderBottom: `1px solid ${T.border}` }}>
                    <DarkInput value={dfSearch} onChange={e => setDfSearch(e.target.value)} placeholder="Search dataflows…" style={{ width: '100%', padding: '5px 8px', fontSize: 12 }} />
                  </div>
                  {dfFilters.length > 0 && (
                    <button onClick={() => setDfFilters([])}
                      style={{ width: '100%', padding: '6px 12px', textAlign: 'left', background: 'none', border: 'none', borderBottom: `1px solid ${T.border}`, color: T.danger, cursor: 'pointer', fontSize: 11, fontFamily: 'inherit' }}>
                      Clear all
                    </button>
                  )}
                  <div style={{ maxHeight: 220, overflowY: 'auto' }}>
                    {dfNames.filter(n => !dfSearch || n.toLowerCase().includes(dfSearch.toLowerCase())).map(name => (
                      <label key={name} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 12px', cursor: 'pointer', borderBottom: `1px solid ${T.border}20` }}>
                        <input type="checkbox" checked={dfFilters.includes(name)}
                          onChange={() => setDfFilters(prev => prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name])}
                          style={{ accentColor: T.purple, cursor: 'pointer' }} />
                        <span style={{ fontSize: 11, color: T.textSecondary }}>{name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
            {/* Dataflow status filter — only shown when GLPI has states configured */}
            {dfStatuses.length > 0 && <div style={{ position: 'relative' }}>
              <button onClick={() => setDfStatusOpen(o => !o)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, background: T.bgElevated, border: `1px solid ${dfStatusFilter.length ? T.purple : T.border}`, borderRadius: 7, color: dfStatusFilter.length ? T.purple : T.textMuted, fontSize: 12, padding: '5px 10px', cursor: 'pointer', fontFamily: 'inherit', minWidth: 140 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: dfStatusFilter.length ? T.purple : T.textDim, flexShrink: 0 }} />
                <span style={{ flex: 1, textAlign: 'left' }}>{dfStatusFilter.length ? `${dfStatusFilter.length} status${dfStatusFilter.length > 1 ? 'es' : ''}` : 'Filter by status…'}</span>
                <span style={{ fontSize: 10 }}>▾</span>
              </button>
              {dfStatusOpen && (
                <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 200, background: T.bgElevated, border: `1px solid ${T.border}`, borderRadius: 8, width: 240, boxShadow: '0 8px 24px #0009' }}
                  onMouseLeave={() => setDfStatusOpen(false)}>
                  {dfStatusFilter.length > 0 && (
                    <button onClick={() => setDfStatusFilter([])}
                      style={{ width: '100%', padding: '6px 12px', textAlign: 'left', background: 'none', border: 'none', borderBottom: `1px solid ${T.border}`, color: T.danger, cursor: 'pointer', fontSize: 11, fontFamily: 'inherit' }}>
                      Clear all
                    </button>
                  )}
                  <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                    {dfStatuses.map(st => {
                      const sLow = st.toLowerCase();
                      const dot = sLow.includes('remov') || sLow.includes('stop') ? T.danger : sLow.includes('deprecat') ? T.warning : sLow.includes('active') || sLow.includes('in use') ? T.success : sLow.includes('dev') || sLow.includes('test') ? '#F59E0B' : T.textMuted;
                      return (
                        <label key={st} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', cursor: 'pointer', borderBottom: `1px solid ${T.border}20` }}>
                          <input type="checkbox" checked={dfStatusFilter.includes(st)}
                            onChange={() => setDfStatusFilter(prev => prev.includes(st) ? prev.filter(s => s !== st) : [...prev, st])}
                            style={{ accentColor: T.purple, cursor: 'pointer' }} />
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: dot, flexShrink: 0 }} />
                          <span style={{ fontSize: 12, color: T.textSecondary }}>{st}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>}
            {(dfFilters.length > 0 || dfStatusFilter.length > 0) && (
              <button onClick={() => { setDfFilters([]); setDfStatusFilter([]); }}
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 7, background: T.danger + '18', border: `1px solid ${T.danger}40`, color: T.danger, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                <span>×</span> Clear filters
              </button>
            )}
          </>
        )}
        {/* Right-side controls — always visible */}
        <div style={{ flex: 1 }} />
        {/* Clear all filters — shown whenever any filter is active */}
        {(appFilters.length > 0 || dfFilters.length > 0 || appStatusFilter.length > 0 || dfStatusFilter.length > 0 || focused || pendingCanvasFilters.length > 0) && (
          <button onClick={() => { setAppFilters([]); setDfFilters([]); setAppStatusFilter([]); setDfStatusFilter([]); setFocused(null); setSelected(null); setPendingCanvasFilters([]); }}
            style={{ display: 'flex', alignItems: 'center', gap: 5, background: T.danger + '18', border: `1px solid ${T.danger}44`, borderRadius: 7, color: T.danger, fontSize: 11, fontWeight: 600, padding: '5px 10px', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
            <span>✕</span> Clear filters
          </button>
        )}
        <DarkInput value={search} onChange={e => setSearch(e.target.value)} placeholder="Search nodes…" style={{ width: 150, padding: '5px 10px', fontSize: 12 }} />
        <button onClick={() => zoom(1.2)}  style={{ background: T.bg, border: `1px solid ${T.border}`, color: T.textMuted, borderRadius: 6, padding: '5px 9px', cursor: 'pointer', fontSize: 14 }}>+</button>
        <button onClick={() => zoom(0.83)} style={{ background: T.bg, border: `1px solid ${T.border}`, color: T.textMuted, borderRadius: 6, padding: '5px 9px', cursor: 'pointer', fontSize: 14 }}>−</button>
        <button onClick={resetView}        style={{ background: T.bg, border: `1px solid ${T.border}`, color: T.textMuted, borderRadius: 6, padding: '5px 9px', cursor: 'pointer', fontSize: 11 }}>Reset</button>
        <button onClick={reheat}           style={{ background: T.bg, border: `1px solid ${T.border}`, color: T.textMuted, borderRadius: 6, padding: '5px 9px', cursor: 'pointer', fontSize: 11 }}>Relayout</button>
        <Btn size="sm" icon="refresh" onClick={load} disabled={loading}>{loading ? '…' : 'Refresh'}</Btn>
      </div>

      {/* Canvas + panel */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0, position: 'relative' }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <canvas ref={canvasRef}
            style={{ display: 'block', width: '100%', height: '100%', cursor: 'grab', background: T.bg }}
            onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp}
            onClick={onClick} onDoubleClick={onDoubleClick} onWheel={onWheel} />
          {loading && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: T.bg + 'cc' }}>
              <span style={{ color: T.textMuted, fontSize: 13 }}>Loading graph…</span>
            </div>
          )}
          {!loading && nodeCount === 0 && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
              <Icon name="flow" size={32} color={T.textDim} />
              <span style={{ color: T.textMuted, fontSize: 13 }}>No nodes yet — sync GLPI or chat with ARIA to build the map</span>
            </div>
          )}
          {/* Ctrl+click staging banner */}
          {pendingCanvasFilters.length > 0 && (
            <div style={{ position: 'absolute', bottom: 52, left: '50%', transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', gap: 10, background: T.bgElevated, border: `1px solid ${T.teal}`, borderRadius: 10, padding: '8px 14px', boxShadow: '0 4px 20px #0008', zIndex: 50 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: T.teal, flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: T.teal, fontWeight: 600 }}>
                {pendingCanvasFilters.length} app{pendingCanvasFilters.length > 1 ? 's' : ''} selected
              </span>
              <span style={{ fontSize: 11, color: T.textMuted }}>
                ({pendingCanvasFilters.join(', ')})
              </span>
              <button
                onClick={() => { setAppFilters(pendingCanvasFilters); setPendingCanvasFilters([]); setFocused(null); }}
                style={{ background: T.teal, border: 'none', borderRadius: 6, color: '#0A0E1A', fontSize: 12, fontWeight: 700, padding: '5px 12px', cursor: 'pointer', fontFamily: 'inherit' }}>
                Apply Filter
              </button>
              <button
                onClick={() => setPendingCanvasFilters([])}
                style={{ background: 'none', border: `1px solid ${T.border}`, borderRadius: 6, color: T.textMuted, fontSize: 11, padding: '5px 10px', cursor: 'pointer', fontFamily: 'inherit' }}>
                Cancel
              </button>
            </div>
          )}
          {/* Legend */}
          <div style={{ position: 'absolute', bottom: 12, left: 12, display: 'flex', gap: 10, background: T.bgElevated + 'ee', borderRadius: 8, padding: '6px 12px', border: `1px solid ${T.border}`, flexWrap: 'wrap', maxWidth: 520 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 11, height: 11, borderRadius: '50%', background: T.accent }} />
              <span style={{ fontSize: 10, color: T.textMuted }}>Application</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: T.purple }} />
              <span style={{ fontSize: 10, color: T.textMuted }}>Dataflow</span>
            </div>
            <div style={{ width: 1, background: T.border, alignSelf: 'stretch' }} />
            {[
              [T.success, 'Active / In use'],
              ['#F59E0B', 'Dev / Test'],
              [T.warning, 'Deprecated'],
              [T.danger,  'Removed'],
              [T.textMuted, 'Inactive'],
            ].map(([col, lbl]) => (
              <div key={lbl} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: col }} />
                <span style={{ fontSize: 10, color: T.textDim }}>{lbl}</span>
              </div>
            ))}
            <div style={{ width: 1, background: T.border, alignSelf: 'stretch' }} />
            <span style={{ fontSize: 10, color: T.textDim }}>Ctrl+click to stage filter</span>
          </div>
        </div>
        {selected && <div style={{ position: 'relative' }}><NodePanel node={selected} /></div>}
      </div>
    </div>
  );
};

// ── GLPI SYNC ────────────────────────────────────────────
const GLPISync = ({ api }) => {
  const [status, setStatus]     = useState(null);
  const [running, setRunning]   = useState(false);
  const [activeRun, setActiveRun] = useState(null);
  const [force, setForce]       = useState(false);
  const [runError, setRunError] = useState(null);

  const cfg          = api.cfg();
  const isConfigured = !!(cfg.glpiUrl && cfg.glpiUserToken && cfg.glpiAppToken);

  const loadStatus = async () => {
    try {
      const d = await api.get("/api/pipeline/status");
      setStatus(d);
    } catch {}
  };

  useEffect(() => { loadStatus(); }, []);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(loadStatus, 3000);
    return () => clearInterval(id);
  }, [running]);

  const runPipeline = async (tier, stageOverride) => {
    if (!isConfigured) { setRunError("GLPI not configured — go to Settings first"); return; }
    setRunning(true);
    setRunError(null);
    setActiveRun(stageOverride ? stageOverride[0] : tier);
    try {
      const body = { glpiUrl: cfg.glpiUrl, userToken: cfg.glpiUserToken, appToken: cfg.glpiAppToken, force };
      if (stageOverride) body.stages = stageOverride;
      else body.tier = tier;
      await api.post("/api/pipeline/run", body);
    } catch (e) {
      setRunError(e.message);
    }
    await loadStatus();
    setRunning(false);
    setActiveRun(null);
  };

  const TIER_COLORS  = { live: T.success, hourly: T.warning, nightly: T.purple };
  const STATUS_DOT   = { never_run: T.textDim, ok: T.success, error: T.danger, running: T.warning };
  const STATUS_LABEL = { never_run: "Never run", ok: "Done", error: "Failed", running: "Running…" };

  const TIERS = [
    { id: "live",    label: "Run Live",    color: T.success, desc: "Session auth · incremental tickets · followups · tasks · rescore" },
    { id: "hourly",  label: "Run Hourly",  color: T.warning, desc: "Live + change records" },
    { id: "nightly", label: "Run Nightly", color: T.purple,  desc: "Hourly + groups/categories · full reconcile · users · reopens · escalations" },
  ];

  const STORE = [
    { k: "tickets",   label: "Tickets",   color: T.success },
    { k: "changes",   label: "Changes",   color: T.warning },
    { k: "followups", label: "Followups", color: T.accent  },
    { k: "tasks",     label: "Tasks",     color: T.pink    },
    { k: "users",     label: "Users",     color: T.teal    },
    { k: "groups",    label: "Groups",    color: T.purple  },
  ];

  const stages = status?.stages || [];
  const store  = status?.store  || {};

  return (
    <div>
      <SectionHeader title="GLPI Sync" subtitle="Pull data from GLPI into ARIA's knowledge graph."
        actions={
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: T.textMuted, cursor: "pointer", userSelect: "none" }}>
              <input type="checkbox" checked={force} onChange={e => setForce(e.target.checked)} style={{ cursor: "pointer" }} />
              Force full re-sync
            </label>
            <Btn size="sm" variant="secondary" icon="refresh" onClick={loadStatus} disabled={running}>Refresh</Btn>
          </div>
        }
      />

      {/* Connection banner */}
      {!isConfigured ? (
        <div style={{ marginBottom: 20, padding: "13px 18px", borderRadius: T.radius, background: T.dangerGlow, border: `1px solid ${T.danger}30`, display: "flex", alignItems: "center", gap: 10, fontSize: 13 }}>
          <Icon name="warning" size={15} color={T.danger} />
          <span style={{ color: T.danger }}>GLPI not configured — go to <strong>Settings</strong> and add your GLPI credentials first.</span>
        </div>
      ) : (
        <div style={{ marginBottom: 20, padding: "13px 18px", borderRadius: T.radius, background: T.successGlow, border: `1px solid ${T.success}30`, display: "flex", alignItems: "center", gap: 12 }}>
          <Icon name="check" size={15} color={T.success} />
          <span style={{ fontSize: 13, fontWeight: 600, color: T.success }}>GLPI Connected</span>
          <span style={{ fontSize: 12, color: T.textMuted }}>{cfg.glpiUrl}</span>
        </div>
      )}

      {runError && (
        <div style={{ marginBottom: 16, padding: "10px 16px", borderRadius: T.radius, background: T.dangerGlow, border: `1px solid ${T.danger}30`, fontSize: 13, color: T.danger }}>
          {runError}
        </div>
      )}

      {/* Tier run buttons */}
      <Card style={{ marginBottom: 16, padding: "14px 18px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: T.textMuted }}>Pipeline tier:</span>
        {TIERS.map(t => (
          <Btn key={t.id} size="sm" color={t.color} onClick={() => runPipeline(t.id)} disabled={running || !isConfigured} title={t.desc}>
            {running && activeRun === t.id ? "Running…" : t.label}
          </Btn>
        ))}
        <span style={{ fontSize: 11, color: T.textDim, marginLeft: "auto" }}>Nightly ⊃ Hourly ⊃ Live</span>
      </Card>

      {/* Store counts */}
      {status && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 10, marginBottom: 20 }}>
          {STORE.map(c => (
            <Card key={c.k} style={{ padding: "14px 16px", textAlign: "center" }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: c.color, letterSpacing: "-0.03em" }}>
                {(store[c.k] || 0).toLocaleString()}
              </div>
              <div style={{ fontSize: 11, color: T.textMuted, marginTop: 4 }}>{c.label}</div>
            </Card>
          ))}
        </div>
      )}

      {/* Stage cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {stages.length === 0 ? (
          <Card><EmptyState icon="sync" title="Loading pipeline…" description="Fetching stage metadata from Neo4j." /></Card>
        ) : stages.map(stage => {
          const tierColor    = TIER_COLORS[stage.tier] || T.textDim;
          const dotColor     = STATUS_DOT[stage.status] || T.textDim;
          const stageRunning = running && activeRun !== null;
          const lastRun      = stage.lastRun ? new Date(stage.lastRun).toLocaleString() : null;

          return (
            <Card key={stage.id} style={{
              padding: 0,
              border: `1.5px solid ${stage.status === "error" ? T.danger + "40" : stage.status === "ok" ? T.success + "20" : T.border}`,
            }}>
              <div style={{ display: "flex", alignItems: "center", padding: "12px 18px", gap: 14 }}>
                {/* Status dot */}
                <div style={{
                  width: 9, height: 9, borderRadius: "50%", flexShrink: 0,
                  background: stageRunning ? T.warning : dotColor,
                  boxShadow: (stage.status === "ok" && !stageRunning) ? `0 0 7px ${T.success}70` : "none",
                }} />

                {/* Label + desc */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{stage.label}</span>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 8px", borderRadius: 20, background: `${tierColor}15`, color: tierColor, border: `1px solid ${tierColor}28` }}>{stage.tier}</span>
                    {stage.count > 0 && (
                      <span style={{ fontSize: 11, fontWeight: 600, padding: "1px 9px", borderRadius: 20, background: T.accentGlow, color: T.accent, border: `1px solid ${T.accent}28` }}>
                        {stage.count.toLocaleString()}
                      </span>
                    )}
                    {stage.status === "error" && stage.errorMessage && (
                      <span style={{ fontSize: 11, color: T.danger }}>— {stage.errorMessage}</span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: T.textMuted, lineHeight: 1.5 }}>{stage.desc}</div>
                  {lastRun && <div style={{ fontSize: 10, color: T.textDim, marginTop: 3 }}>Last: {lastRun}</div>}
                </div>

                {/* Status label + run button */}
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: stageRunning ? T.warning : dotColor, minWidth: 60, textAlign: "right" }}>
                    {stageRunning ? "Running…" : (STATUS_LABEL[stage.status] || stage.status)}
                  </span>
                  <Btn size="sm" variant="secondary"
                    onClick={() => runPipeline("live", [stage.id])}
                    disabled={running || !isConfigured || stage.id === "session_auth"}>
                    Run
                  </Btn>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Info box */}
      <div style={{ marginTop: 18, padding: "14px 18px", borderRadius: T.radius, background: T.accentGlow, border: `1px solid ${T.accent}28`, fontSize: 12, color: T.textMuted, lineHeight: 1.75 }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
          <Icon name="info" size={14} color={T.accent} />
          <span style={{ fontWeight: 600, color: T.accent }}>How it works</span>
        </div>
        <strong style={{ color: T.text }}>Live</strong> stages run every execution (auth, incremental tickets, followups, tasks, rescore).
        <strong style={{ color: T.text }}> Hourly</strong> adds change records.
        <strong style={{ color: T.text }}> Nightly</strong> adds full reconciliation, user directory, reopens, and escalation history.
        Use <strong style={{ color: T.text }}>Force full re-sync</strong> to bypass incremental filters on the next run.
      </div>
    </div>
  );
};

// ── SETTINGS ─────────────────────────────────────────────
const Settings = ({ api }) => {
  const [cfg, setCfg] = useState(() => { try { return JSON.parse(localStorage.getItem("aria_config") || "{}"); } catch { return {}; } });
  const [saved, setSaved] = useState(false);
  const [tested, setTested] = useState(null);
  const [githubSync, setGithubSync] = useState(null); // null | 'syncing' | { synced, skipped, dataflowIds, errors }
  const [githubTest, setGithubTest] = useState(null); // null | 'testing' | { root } | { error }

  const save = () => {
    localStorage.setItem("aria_config", JSON.stringify(cfg));
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const testGlpi = async () => {
    setTested("testing");
    try {
      const res = await fetch(`${cfg.glpiUrl}/apirest.php/initSession`, {
        headers: { "Authorization": `user_token ${cfg.glpiUserToken}`, "App-Token": cfg.glpiAppToken }
      });
      const data = await res.json();
      setTested(data.session_token ? "ok" : "fail");
    } catch { setTested("fail"); }
    setTimeout(() => setTested(null), 4000);
  };

  const Field = ({ label, k, type = "text", hint }) => (
    <div style={{ marginBottom: 18 }}>
      <FieldLabel>{label}</FieldLabel>
      <DarkInput type={type} value={cfg[k] || ""} onChange={e => setCfg(c => ({ ...c, [k]: e.target.value }))} placeholder="" />
      {hint && <FieldHint>{hint}</FieldHint>}
    </div>
  );

  const SectionCard = ({ icon, title, color = T.accent, children }) => (
    <Card style={{ marginBottom: 16, padding: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: `${color}18`, border: `1px solid ${color}28`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon name={icon} size={15} color={color} />
        </div>
        <span style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{title}</span>
      </div>
      {children}
    </Card>
  );

  return (
    <div style={{ maxWidth: 680 }}>
      <SectionHeader title="Settings" subtitle="Configure ARIA connections, GLPI credentials, and integrations."
        actions={<div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {saved && <span style={{ fontSize: 13, color: T.success, fontWeight: 600 }}>✓ Saved</span>}
          <Btn onClick={save}>Save Settings</Btn>
        </div>}
      />

      <SectionCard icon="settings" title="GLPI Connection" color={T.accent}>
        <Field label="GLPI URL" k="glpiUrl" hint="e.g. https://glpi.company.com" />
        <Field label="User Token" k="glpiUserToken" />
        <Field label="App Token" k="glpiAppToken" />
        <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
          <Btn variant="secondary" onClick={testGlpi} disabled={tested === "testing"}>
            {tested === "testing" ? "Testing…" : "Test Connection"}
          </Btn>
          {tested === "ok"   && <span style={{ fontSize: 13, color: T.success, alignSelf: "center" }}>✓ Connected</span>}
          {tested === "fail" && <span style={{ fontSize: 13, color: T.danger,  alignSelf: "center" }}>✗ Failed</span>}
        </div>
      </SectionCard>

      <SectionCard icon="knowledge" title="AWS Bedrock (AI)" color={T.purple}>
        <Field label="AWS Region" k="awsRegion" hint="e.g. eu-central-1" />
        <Field label="AWS Access Key ID" k="awsAccessKeyId" />
        <Field label="AWS Secret Access Key" k="awsSecretAccessKey" type="password" hint="Stored locally only. Never sent to third parties." />
        <FieldHint>AWS credentials are passed to the ARIA backend via environment variables on server start. Saving here stores them for reference only — update your .env file and restart the container to apply.</FieldHint>
      </SectionCard>

      <SectionCard icon="flow" title="FlowVault" color={T.success}>
        <Field label="FlowVault URL" k="flowvaultUrl" hint="e.g. http://localhost:3000" />
        <FieldHint>FlowVault reads all architecture data directly from ARIA's /api/graph endpoint. No separate connection needed.</FieldHint>
      </SectionCard>

      <SectionCard icon="sync" title="ARIA API" color={T.warning}>
        <Field label="ARIA API Key" k="ariaKey" hint="Used by FlowVault and other clients to authenticate with ARIA." />
        <FieldHint>Set the same key in FlowVault Settings → ARIA Connection. Default dev key is: aria-dev</FieldHint>
      </SectionCard>

      <SectionCard icon="query" title="GitHub Integration" color={T.textMuted}>
        <Field label="GitHub Token" k="githubToken" type="password" hint="Personal access token with repo read scope." />
        <Field label="Repo Owner" k="githubOwner" hint="e.g. om-digitalsolutions" />
        <Field label="Repo Name" k="githubRepo" hint="e.g. architecture-docs" />
        <Btn variant="secondary" onClick={async () => {
          setGithubTest("testing");
          try {
            const res = await fetch(`https://api.github.com/repos/${cfg.githubOwner}/${cfg.githubRepo}`, { headers: { Authorization: `token ${cfg.githubToken}` } });
            const d = await res.json();
            setGithubTest(d.full_name ? { root: d.full_name } : { error: d.message || "Not found" });
          } catch(e) { setGithubTest({ error: e.message }); }
        }} disabled={githubTest === "testing"}>{githubTest === "testing" ? "Testing…" : "Test GitHub"}</Btn>
        {githubTest && githubTest !== "testing" && (
          <span style={{ fontSize: 13, color: githubTest.error ? T.danger : T.success, marginLeft: 10 }}>
            {githubTest.error ? `✗ ${githubTest.error}` : `✓ ${githubTest.root}`}
          </span>
        )}
      </SectionCard>
    </div>
  );
};

// ── MAIN APP ─────────────────────────────────────────────
export default function App() {
  const [page, setPage] = useState("dashboard");

  const api = {
    cfg: () => { try { return JSON.parse(localStorage.getItem("aria_config") || "{}"); } catch { return {}; } },
    get: async (url) => {
      const cfg = JSON.parse(localStorage.getItem("aria_config") || "{}");
      const r = await fetch(`http://localhost:4001${url}`, { headers: { "x-aria-key": cfg.ariaKey || "aria-dev" } });
      if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error || r.statusText); }
      return r.json();
    },
    post: async (url, body) => {
      const cfg = JSON.parse(localStorage.getItem("aria_config") || "{}");
      const r = await fetch(`http://localhost:4001${url}`, {
        method: "POST", headers: { "Content-Type": "application/json", "x-aria-key": cfg.ariaKey || "aria-dev" },
        body: JSON.stringify(body),
      });
      if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error || r.statusText); }
      return r.json();
    },
    put: async (url, body) => {
      const cfg = JSON.parse(localStorage.getItem("aria_config") || "{}");
      const r = await fetch(`http://localhost:4001${url}`, {
        method: "PUT", headers: { "Content-Type": "application/json", "x-aria-key": cfg.ariaKey || "aria-dev" },
        body: JSON.stringify(body),
      });
      if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error || r.statusText); }
      return r.json();
    },
    del: async (url) => {
      const cfg = JSON.parse(localStorage.getItem("aria_config") || "{}");
      const r = await fetch(`http://localhost:4001${url}`, { method: "DELETE", headers: { "x-aria-key": cfg.ariaKey || "aria-dev" } });
      if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error || r.statusText); }
      return r.status === 204 ? null : r.json().catch(() => null);
    },
    patch: async (url, body) => {
      const cfg = JSON.parse(localStorage.getItem("aria_config") || "{}");
      const r = await fetch(`http://localhost:4001${url}`, {
        method: "PATCH", headers: { "Content-Type": "application/json", "x-aria-key": cfg.ariaKey || "aria-dev" },
        body: JSON.stringify(body),
      });
      if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error || r.statusText); }
      return r.json();
    },
  };

  return (
    <div style={{ display: "flex", height: "100vh", background: T.bg, color: T.text, fontFamily: T.font, overflow: "hidden" }}>
      {/* Sidebar */}
      <div style={{ width: 220, background: T.sidebar, borderRight: `1px solid ${T.border}`, display: "flex", flexDirection: "column", flexShrink: 0 }}>
        <div style={{ padding: "18px 20px 12px", borderBottom: `1px solid ${T.border}` }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: T.text, letterSpacing: "-0.02em" }}>ARIA</div>
          <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>Architecture Intelligence</div>
        </div>
        <nav style={{ flex: 1, overflowY: "auto", padding: "10px 0" }}>
          {NAV.map(item => {
            const active = page === item.id;
            return (
              <button key={item.id} onClick={() => setPage(item.id)} style={{
                width: "100%", display: "flex", alignItems: "center", gap: 10,
                padding: "9px 20px", background: active ? T.accentGlow : "transparent",
                border: "none", borderLeft: `3px solid ${active ? T.accent : "transparent"}`,
                color: active ? T.accent : T.textMuted, cursor: "pointer",
                fontSize: 13, fontWeight: active ? 600 : 400, fontFamily: "inherit",
                transition: "all 0.15s", textAlign: "left",
              }}>
                <Icon name={item.icon} size={15} color="currentColor" />
                {item.label}
              </button>
            );
          })}
        </nav>
        <div style={{ padding: "12px 20px", borderTop: `1px solid ${T.border}`, fontSize: 11, color: T.textDim }}>
          OMDS IT Architecture v1.0
        </div>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ flex: 1, overflowY: page === "map" ? "hidden" : "auto", padding: page === "map" ? 0 : 24, display: page === "map" ? "flex" : "block", flexDirection: "column" }}>
          {(()=>{switch(page){case"dashboard":return<Dashboard api={api}/>;case"knowledge":return<KnowledgeBase api={api}/>;case"sync":return<GLPISync api={api}/>;case"map":return<ArchitectureMap api={api}/>;case"train":return<TrainAria api={api}/>;case"memory":return<MemoryView api={api}/>;case"settings":return<Settings api={api}/>;default:return<Dashboard api={api}/>;}})()}
        </div>
      </div>
    </div>
  );
}
