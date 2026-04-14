import { useState, useRef } from "react";

// ── Mock saved sessions ───────────────────────────────────────
const INITIAL_SESSIONS = [
  {
    id: "s1", name: "llmsrv",
    group: "AI Infra",
    host: "192.168.10.42", port: 22,
    user: "ruslan", authType: "key",
    keyPath: "~/.ssh/oes_ed25519",
    password: "",
    tags: ["gpu","llm","claude-code"],
    lastConn: "сегодня 14:22",
    status: "connected",
    note: "RTX 5070 Ti · qwen2.5-coder:14b · Ollama + LiteLLM",
  },
  {
    id: "s2", name: "clickhouse-01",
    group: "Databases",
    host: "10.0.1.15", port: 22,
    user: "admin", authType: "key",
    keyPath: "~/.ssh/oes_ed25519",
    password: "",
    tags: ["clickhouse","oes-mas"],
    lastConn: "вчера 21:05",
    status: "idle",
    note: "ClickHouse 23.8 · oes_mas DB",
  },
  {
    id: "s3", name: "fms-gateway",
    group: "FMS",
    host: "10.0.2.80", port: 22,
    user: "fmsuser", authType: "password",
    keyPath: "",
    password: "••••••••",
    tags: ["galileosky","wialon","fms"],
    lastConn: "3 дня назад",
    status: "idle",
    note: "Galileosky / Wialon интеграция · 800+ ед.",
  },
  {
    id: "s4", name: "gitlab-ce",
    group: "DevOps",
    host: "gitlab.oes.internal", port: 22,
    user: "git", authType: "key",
    keyPath: "~/.ssh/gitlab_rsa",
    password: "",
    tags: ["gitlab","ci","devops"],
    lastConn: "неделю назад",
    status: "idle",
    note: "GitLab CE · self-hosted",
  },
  {
    id: "s5", name: "langfuse-srv",
    group: "AI Infra",
    host: "10.0.1.30", port: 2222,
    user: "ubuntu", authType: "key",
    keyPath: "~/.ssh/oes_ed25519",
    password: "",
    tags: ["langfuse","observability"],
    lastConn: "2 дня назад",
    status: "error",
    note: "Langfuse · LiteLLM Proxy · Grafana",
  },
  {
    id: "s6", name: "prod-api-01",
    group: "Production",
    host: "185.x.x.x", port: 22,
    user: "deploy", authType: "key",
    keyPath: "~/.ssh/prod_deploy",
    password: "",
    tags: ["prod","api","vgk"],
    lastConn: "5 дней назад",
    status: "idle",
    note: "VGK Production API · осторожно!",
  },
];

const GROUPS = ["Все", "AI Infra", "Databases", "FMS", "DevOps", "Production"];

const AUTH_TYPES = [
  { id: "key",      label: "SSH Key",      icon: "🔑" },
  { id: "password", label: "Password",     icon: "🔒" },
  { id: "keychain", label: "macOS Keychain", icon: "⬡" },
];

const EMPTY_SESSION = {
  id: "", name: "", group: "AI Infra", host: "", port: 22,
  user: "", authType: "key", keyPath: "~/.ssh/id_ed25519",
  password: "", tags: [], lastConn: "—", status: "idle", note: "",
};

export default function SSHManager() {
  const [sessions, setSessions]     = useState(INITIAL_SESSIONS);
  const [activeGroup, setActiveGroup] = useState("Все");
  const [search, setSearch]         = useState("");
  const [selected, setSelected]     = useState(null); // session id for detail view
  const [editing, setEditing]       = useState(null); // session being edited
  const [isNew, setIsNew]           = useState(false);
  const [connectedId, setConnectedId] = useState("s1");
  const [showCopied, setShowCopied] = useState(null);
  const [showPass, setShowPass]     = useState({});
  const [termLog, setTermLog]       = useState([
    { type: "info", text: "SSH Manager готов. Выбери сессию для подключения." },
    { type: "conn", text: "→ Connected: llmsrv (ruslan@192.168.10.42)" },
    { type: "out",  text: "Last login: Mon Apr 14 14:22:31 2026 from 192.168.1.5\nruslan@llmsrv:~$" },
  ]);
  const termRef = useRef(null);

  const filtered = sessions.filter(s => {
    const matchGroup = activeGroup === "Все" || s.group === activeGroup;
    const q = search.toLowerCase();
    const matchSearch = !q || s.name.includes(q) || s.host.includes(q) ||
      s.tags.some(t => t.includes(q)) || s.note.toLowerCase().includes(q);
    return matchGroup && matchSearch;
  });

  const grouped = filtered.reduce((acc, s) => {
    (acc[s.group] = acc[s.group] || []).push(s);
    return acc;
  }, {});

  const connect = (s) => {
    setConnectedId(s.id);
    setSelected(s.id);
    setSessions(prev => prev.map(x => x.id === s.id ? { ...x, status: "connected", lastConn: "только что" } : x));
    setTermLog(prev => [
      ...prev,
      { type: "cmd",  text: `ssh -p ${s.port} ${s.user}@${s.host}` + (s.authType === "key" ? ` -i ${s.keyPath}` : "") },
      { type: "conn", text: `→ Connecting to ${s.name} (${s.user}@${s.host}:${s.port})...` },
      { type: "out",  text: `✓ Connected · ${s.note || s.host}\n${s.user}@${s.name}:~$` },
    ]);
  };

  const copyCmd = (s) => {
    const cmd = `ssh -p ${s.port} ${s.user}@${s.host}` + (s.authType === "key" ? ` -i ${s.keyPath}` : "");
    navigator.clipboard?.writeText(cmd).catch(() => {});
    setShowCopied(s.id);
    setTimeout(() => setShowCopied(null), 1500);
  };

  const startEdit = (s) => {
    setEditing({ ...s, tags: [...s.tags] });
    setIsNew(false);
  };

  const startNew = () => {
    setEditing({ ...EMPTY_SESSION, id: "new_" + Date.now() });
    setIsNew(true);
  };

  const saveEdit = () => {
    if (!editing.name || !editing.host) return;
    setSessions(prev =>
      isNew ? [...prev, { ...editing }]
            : prev.map(s => s.id === editing.id ? { ...editing } : s)
    );
    setEditing(null);
  };

  const deleteSession = (id) => {
    setSessions(prev => prev.filter(s => s.id !== id));
    if (selected === id) setSelected(null);
  };

  const selSession = sessions.find(s => s.id === selected);
  const connSession = sessions.find(s => s.id === connectedId);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600&family=Rajdhani:wght@500;600;700&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin:0; padding:0; }
        :root {
          --bg:#08080b; --p1:#0f0f15; --p2:#13131c; --p3:#181824;
          --b1:#1e1e2e; --b2:#28283c; --b3:#363650;
          --t1:#eeeef5; --t2:#9898b0; --t3:#55556a;
          --amber:#f59e0b; --al:rgba(245,158,11,.08); --am:rgba(245,158,11,.15);
          --green:#22c55e; --gl:rgba(34,197,94,.1);
          --red:#ef4444; --rl:rgba(239,68,68,.1);
          --blue:#60a5fa; --purple:#a78bfa; --teal:#34d399;
          --mono:'JetBrains Mono',monospace; --ui:'Rajdhani',sans-serif;
        }
        body { background:var(--bg); color:var(--t2); font-family:var(--mono); }
        .app { display:flex; flex-direction:column; height:100vh; overflow:hidden; }

        /* Titlebar */
        .titlebar {
          height:40px; min-height:40px; display:flex; align-items:center;
          background:var(--p1); border-bottom:1px solid var(--b1);
          padding:0 16px; gap:12px; user-select:none; flex-shrink:0;
        }
        .tlights { display:flex; gap:7px; }
        .tl { width:12px; height:12px; border-radius:50%; }
        .tl-r{background:#ff5f57} .tl-y{background:#febc2e} .tl-g{background:#28c840}
        .t-center { flex:1; display:flex; justify-content:center; align-items:center; gap:10px; }
        .t-name { font-family:var(--ui); font-weight:700; font-size:13px; letter-spacing:3px; color:var(--amber); text-transform:uppercase; }
        .t-sep { color:var(--b3); }
        .t-meta { font-size:11px; color:var(--t3); }
        .t-badge {
          font-family:var(--ui); font-weight:700; font-size:10px; letter-spacing:1.5px;
          padding:2px 9px; border-radius:3px; text-transform:uppercase;
          background:rgba(34,197,94,.1); border:1px solid rgba(34,197,94,.25); color:var(--green);
        }

        /* Main layout */
        .main { display:flex; flex:1; overflow:hidden; }

        /* ── Session list panel ── */
        .sess-panel {
          width:280px; min-width:240px; display:flex; flex-direction:column;
          background:var(--p1); border-right:1px solid var(--b1); flex-shrink:0;
        }
        .sess-top { padding:10px 12px; border-bottom:1px solid var(--b1); flex-shrink:0; }
        .sess-search-row { display:flex; gap:6px; align-items:center; margin-bottom:8px; }
        .sess-search {
          flex:1; background:var(--p2); border:1px solid var(--b2); border-radius:5px;
          padding:5px 10px; color:var(--t1); font-family:var(--mono); font-size:12px;
          outline:none; caret-color:var(--amber);
        }
        .sess-search::placeholder { color:var(--t3); }
        .sess-search:focus { border-color:var(--b3); }
        .btn-add {
          background:var(--amber); border:none; border-radius:5px;
          color:#000; font-family:var(--ui); font-weight:700; font-size:12px;
          letter-spacing:.5px; padding:5px 12px; cursor:pointer; transition:opacity .15s;
          white-space:nowrap; flex-shrink:0;
        }
        .btn-add:hover { opacity:.85; }

        .group-tabs { display:flex; gap:4px; flex-wrap:wrap; }
        .gtab {
          background:transparent; border:1px solid var(--b1); border-radius:3px;
          color:var(--t3); font-family:var(--mono); font-size:10px;
          padding:2px 8px; cursor:pointer; transition:all .1s;
        }
        .gtab:hover { color:var(--t2); border-color:var(--b2); }
        .gtab.active { color:var(--amber); border-color:var(--amber); background:var(--al); }

        .sess-list { flex:1; overflow-y:auto; }
        .sess-list::-webkit-scrollbar { width:3px; }
        .sess-list::-webkit-scrollbar-thumb { background:var(--b2); border-radius:2px; }

        .group-header {
          padding:8px 12px 4px; font-family:var(--ui); font-weight:700; font-size:9px;
          letter-spacing:2px; text-transform:uppercase; color:var(--t3);
        }
        .sess-item {
          display:flex; align-items:center; gap:9px;
          padding:9px 12px; cursor:pointer; transition:all .1s;
          border-bottom:1px solid var(--b1); position:relative;
        }
        .sess-item:hover { background:var(--p2); }
        .sess-item.selected { background:var(--p2); }
        .sess-item.selected::before {
          content:''; position:absolute; left:0; top:0; bottom:0; width:2px;
          background:var(--amber);
        }
        .sess-item.connected::before { background:var(--green); }

        .sdot { width:8px; height:8px; border-radius:50%; flex-shrink:0; }
        .sdot-connected { background:var(--green); box-shadow:0 0 6px var(--green); animation:pulse 2s infinite; }
        .sdot-idle       { background:var(--b3); }
        .sdot-error      { background:var(--red); }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.5} }

        .sinfo { flex:1; min-width:0; }
        .sname { font-size:13px; color:var(--t1); font-weight:500; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .shost { font-size:10px; color:var(--t3); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-top:2px; }
        .sauth {
          width:22px; height:22px; display:flex; align-items:center; justify-content:center;
          font-size:11px; border-radius:4px; background:var(--p3); flex-shrink:0;
          border:1px solid var(--b2);
        }

        .btn-connect {
          background:transparent; border:1px solid var(--b2); border-radius:4px;
          color:var(--t2); font-family:var(--mono); font-size:10px;
          padding:3px 8px; cursor:pointer; transition:all .12s; flex-shrink:0;
          opacity:0;
        }
        .sess-item:hover .btn-connect { opacity:1; }
        .btn-connect:hover { border-color:var(--green); color:var(--green); background:var(--gl); }
        .btn-connect.active { background:var(--green); border-color:var(--green); color:#000; font-weight:700; opacity:1; }

        /* ── Detail / Edit panel ── */
        .detail-panel {
          width:320px; min-width:280px; display:flex; flex-direction:column;
          background:var(--p1); border-right:1px solid var(--b1); flex-shrink:0; overflow:hidden;
        }
        .detail-hdr {
          padding:12px 16px; border-bottom:1px solid var(--b1); flex-shrink:0;
          display:flex; align-items:center; gap:10px;
        }
        .detail-dot { width:10px; height:10px; border-radius:50%; flex-shrink:0; }
        .detail-title { font-family:var(--ui); font-weight:700; font-size:15px; color:var(--t1); flex:1; }
        .detail-group-badge {
          font-size:9px; font-family:var(--ui); font-weight:700; letter-spacing:1px;
          padding:2px 7px; border-radius:3px; text-transform:uppercase;
        }

        .detail-body { flex:1; overflow-y:auto; padding:14px 16px; }
        .detail-body::-webkit-scrollbar { width:3px; }
        .detail-body::-webkit-scrollbar-thumb { background:var(--b2); border-radius:2px; }

        .field-row { margin-bottom:14px; }
        .field-label {
          font-size:9px; letter-spacing:2px; text-transform:uppercase; color:var(--t3);
          font-family:var(--ui); font-weight:600; margin-bottom:5px; display:block;
        }
        .field-input {
          width:100%; background:var(--p2); border:1px solid var(--b2); border-radius:5px;
          padding:7px 10px; color:var(--t1); font-family:var(--mono); font-size:12px;
          outline:none; caret-color:var(--amber); transition:border .15s;
        }
        .field-input:focus { border-color:var(--b3); }
        .field-row-2 { display:flex; gap:8px; }
        .field-row-2 .field-row { flex:1; }
        .field-row-2 .field-row:last-child { flex:0 0 80px; }

        .auth-tabs { display:flex; gap:6px; }
        .auth-tab {
          flex:1; background:var(--p2); border:1px solid var(--b2); border-radius:5px;
          color:var(--t2); font-family:var(--mono); font-size:11px;
          padding:7px 6px; cursor:pointer; transition:all .12s;
          display:flex; align-items:center; justify-content:center; gap:5px;
        }
        .auth-tab:hover { border-color:var(--b3); color:var(--t1); }
        .auth-tab.active { border-color:var(--amber); background:var(--al); color:var(--amber); }

        .field-note {
          background:var(--p2); border:1px solid var(--b2); border-radius:5px;
          padding:7px 10px; color:var(--t2); font-family:var(--mono); font-size:11px;
          line-height:1.5; width:100%; resize:none; outline:none; caret-color:var(--amber);
        }

        .ssh-cmd-box {
          background:var(--bg); border:1px solid var(--b2); border-radius:5px;
          padding:8px 10px; font-size:11px; color:var(--amber);
          display:flex; align-items:center; justify-content:space-between; gap:8px;
          margin-top:4px;
        }
        .ssh-cmd-text { flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .btn-copy {
          background:transparent; border:1px solid var(--b2); border-radius:3px;
          color:var(--t3); font-family:var(--mono); font-size:10px;
          padding:2px 7px; cursor:pointer; transition:all .1s; flex-shrink:0;
        }
        .btn-copy:hover { color:var(--amber); border-color:var(--amber); }
        .btn-copy.copied { color:var(--green); border-color:var(--green); }

        .tag-list { display:flex; gap:5px; flex-wrap:wrap; margin-top:4px; }
        .tag {
          font-size:10px; padding:2px 7px; border-radius:3px;
          background:var(--al); border:1px solid rgba(245,158,11,.2); color:var(--amber);
        }

        .detail-actions { padding:12px 16px; border-top:1px solid var(--b1); flex-shrink:0; }
        .btn-primary {
          width:100%; background:var(--green); border:none; border-radius:6px;
          color:#000; font-family:var(--ui); font-weight:700; font-size:13px;
          letter-spacing:1px; padding:10px; cursor:pointer; transition:opacity .15s;
          display:flex; align-items:center; justify-content:center; gap:8px;
          margin-bottom:8px;
        }
        .btn-primary:hover { opacity:.87; }
        .btn-primary.danger { background:var(--red); color:#fff; }
        .btn-row { display:flex; gap:6px; }
        .btn-sec {
          flex:1; background:transparent; border:1px solid var(--b2); border-radius:5px;
          color:var(--t2); font-family:var(--mono); font-size:11px;
          padding:7px; cursor:pointer; transition:all .12s;
        }
        .btn-sec:hover { border-color:var(--b3); color:var(--t1); }
        .btn-sec.red:hover { border-color:var(--red); color:var(--red); }
        .btn-sec.amber:hover { border-color:var(--amber); color:var(--amber); }

        /* ── Terminal panel ── */
        .term-panel { flex:1; display:flex; flex-direction:column; overflow:hidden; background:var(--bg); }
        .term-hdr {
          padding:8px 16px; border-bottom:1px solid var(--b1); background:var(--p1);
          display:flex; align-items:center; gap:10px; flex-shrink:0;
        }
        .term-hdr-name { font-size:12px; color:var(--t1); font-weight:500; }
        .term-hdr-host { font-size:10px; color:var(--t3); }
        .term-hdr-spacer { flex:1; }
        .term-hdr-badge {
          font-size:9px; font-family:var(--ui); font-weight:700; letter-spacing:1px;
          padding:2px 7px; border-radius:3px; text-transform:uppercase;
          background:var(--gl); border:1px solid rgba(34,197,94,.2); color:var(--green);
        }
        .term-out { flex:1; overflow-y:auto; padding:14px 18px; font-size:12.5px; line-height:1.65; }
        .term-out::-webkit-scrollbar { width:4px; }
        .term-out::-webkit-scrollbar-thumb { background:var(--b2); border-radius:2px; }
        .tline-cmd  { color:var(--amber); display:flex; gap:8px; margin-bottom:6px; }
        .tline-conn { color:var(--green); font-size:11px; margin-bottom:4px; }
        .tline-out  { color:var(--t2); white-space:pre; font-size:12px; margin-bottom:8px; border-left:2px solid var(--b2); padding-left:10px; }
        .tline-info { color:var(--t3); font-size:11px; margin-bottom:4px; }
        .tprompt { color:var(--green); flex-shrink:0; }

        /* No selection state */
        .empty-state {
          flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center;
          gap:12px; color:var(--t3); padding:40px;
        }
        .empty-icon { font-size:48px; opacity:.3; }
        .empty-title { font-family:var(--ui); font-size:16px; font-weight:600; color:var(--t2); }
        .empty-sub { font-size:11px; text-align:center; line-height:1.8; }

        /* Form overlay for new/edit */
        .form-panel {
          flex:1; overflow-y:auto; padding:16px; display:flex; flex-direction:column; gap:0;
        }
        .form-section-label {
          font-family:var(--ui); font-weight:700; font-size:9px; letter-spacing:2px;
          text-transform:uppercase; color:var(--amber); margin:14px 0 8px; padding-bottom:5px;
          border-bottom:1px solid var(--b1);
        }
        .form-section-label:first-child { margin-top:0; }

        /* Status bar */
        .statusbar {
          height:22px; min-height:22px; display:flex; align-items:center;
          background:var(--p1); border-top:1px solid var(--b1);
          padding:0 14px; gap:18px; flex-shrink:0;
        }
        .si { display:flex; align-items:center; gap:5px; font-size:10px; color:var(--t3); }
        .si-dot { width:5px; height:5px; border-radius:50%; }
        .si-dot-g { background:var(--green); box-shadow:0 0 4px var(--green); }
        .si-spacer { flex:1; }
        kbd-s kbd {
          background:var(--p2); border:1px solid var(--b2); border-radius:2px;
          padding:0 4px; font-family:var(--mono); font-size:9px; color:var(--t2);
        }

        .group-color-AI { color:var(--purple); }
        .group-color-DB { color:var(--blue); }
        .group-color-FMS { color:var(--teal); }
        .group-color-Dev { color:var(--amber); }
        .group-color-Prod { color:var(--red); }
      `}</style>

      <div className="app">
        {/* Titlebar */}
        <div className="titlebar">
          <div className="tlights">
            <div className="tl tl-r"/><div className="tl tl-y"/><div className="tl tl-g"/>
          </div>
          <div className="t-center">
            <span className="t-name">SSH Sessions</span>
            <span className="t-sep">·</span>
            <span className="t-meta">{sessions.length} серверов</span>
            <span className="t-sep">·</span>
            <span className="t-meta">{sessions.filter(s=>s.status==="connected").length} active</span>
          </div>
          {connSession && (
            <div className="t-badge">⚡ {connSession.name}</div>
          )}
        </div>

        <div className="main">
          {/* ── Session list ── */}
          <div className="sess-panel">
            <div className="sess-top">
              <div className="sess-search-row">
                <input
                  className="sess-search"
                  placeholder="🔍  Поиск: имя, хост, тег..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
                <button className="btn-add" onClick={startNew}>+ New</button>
              </div>
              <div className="group-tabs">
                {GROUPS.map(g => (
                  <button key={g}
                    className={`gtab ${activeGroup === g ? "active" : ""}`}
                    onClick={() => setActiveGroup(g)}
                  >{g === "Все" ? "Все" : g.split(" ")[0]}</button>
                ))}
              </div>
            </div>

            <div className="sess-list">
              {Object.entries(grouped).map(([grp, list]) => (
                <div key={grp}>
                  {activeGroup === "Все" && (
                    <div className="group-header">{grp}</div>
                  )}
                  {list.map(s => {
                    const authIcon = s.authType === "key" ? "🔑" : s.authType === "keychain" ? "⬡" : "🔒";
                    const isConn = s.id === connectedId;
                    return (
                      <div key={s.id}
                        className={`sess-item ${selected === s.id ? "selected" : ""} ${isConn ? "connected" : ""}`}
                        onClick={() => { setSelected(s.id); setEditing(null); }}
                      >
                        <div className={`sdot sdot-${s.status}`}/>
                        <div className="sinfo">
                          <div className="sname">{s.name}</div>
                          <div className="shost">{s.user}@{s.host}:{s.port}</div>
                        </div>
                        <div className="sauth" title={s.authType}>{authIcon}</div>
                        <button
                          className={`btn-connect ${isConn ? "active" : ""}`}
                          onClick={e => { e.stopPropagation(); connect(s); }}
                        >{isConn ? "●" : "→"}</button>
                      </div>
                    );
                  })}
                </div>
              ))}
              {filtered.length === 0 && (
                <div style={{ padding:"24px 16px", color:"var(--t3)", fontSize:12, textAlign:"center" }}>
                  Нет серверов по фильтру
                </div>
              )}
            </div>
          </div>

          {/* ── Detail / Edit panel ── */}
          <div className="detail-panel">
            {/* EDIT FORM */}
            {editing ? (
              <>
                <div className="detail-hdr">
                  <div className="detail-dot" style={{ background: isNew ? "var(--amber)" : "var(--blue)" }}/>
                  <span className="detail-title">{isNew ? "Новый сервер" : `Редактировать: ${editing.name}`}</span>
                </div>
                <div className="form-panel">
                  <div className="form-section-label">Основное</div>
                  <div className="field-row">
                    <label className="field-label">Название</label>
                    <input className="field-input" placeholder="llmsrv" value={editing.name}
                      onChange={e => setEditing(p => ({...p, name: e.target.value}))}/>
                  </div>
                  <div className="field-row-2">
                    <div className="field-row" style={{ flex:2 }}>
                      <label className="field-label">Хост / IP</label>
                      <input className="field-input" placeholder="192.168.1.42"
                        value={editing.host} onChange={e => setEditing(p => ({...p, host: e.target.value}))}/>
                    </div>
                    <div className="field-row" style={{ flex:"0 0 70px" }}>
                      <label className="field-label">Порт</label>
                      <input className="field-input" placeholder="22" type="number"
                        value={editing.port} onChange={e => setEditing(p => ({...p, port: parseInt(e.target.value)||22}))}/>
                    </div>
                  </div>
                  <div className="field-row">
                    <label className="field-label">Пользователь</label>
                    <input className="field-input" placeholder="ruslan"
                      value={editing.user} onChange={e => setEditing(p => ({...p, user: e.target.value}))}/>
                  </div>
                  <div className="field-row">
                    <label className="field-label">Группа</label>
                    <select className="field-input" value={editing.group}
                      onChange={e => setEditing(p => ({...p, group: e.target.value}))}>
                      {["AI Infra","Databases","FMS","DevOps","Production","Other"].map(g =>
                        <option key={g}>{g}</option>)}
                    </select>
                  </div>

                  <div className="form-section-label">Аутентификация</div>
                  <div className="field-row">
                    <label className="field-label">Способ</label>
                    <div className="auth-tabs">
                      {AUTH_TYPES.map(a => (
                        <button key={a.id}
                          className={`auth-tab ${editing.authType === a.id ? "active" : ""}`}
                          onClick={() => setEditing(p => ({...p, authType: a.id}))}>
                          <span>{a.icon}</span>
                          <span>{a.label.split(" ")[0]}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  {editing.authType === "key" && (
                    <div className="field-row">
                      <label className="field-label">Путь к ключу</label>
                      <input className="field-input" placeholder="~/.ssh/id_ed25519"
                        value={editing.keyPath} onChange={e => setEditing(p => ({...p, keyPath: e.target.value}))}/>
                    </div>
                  )}
                  {editing.authType === "password" && (
                    <div className="field-row">
                      <label className="field-label">Пароль</label>
                      <div style={{ position:"relative" }}>
                        <input className="field-input"
                          type={showPass[editing.id] ? "text" : "password"}
                          placeholder="••••••••" value={editing.password}
                          onChange={e => setEditing(p => ({...p, password: e.target.value}))}
                          style={{ paddingRight:60 }}/>
                        <button onClick={() => setShowPass(p => ({...p, [editing.id]: !p[editing.id]}))}
                          style={{
                            position:"absolute", right:8, top:"50%", transform:"translateY(-50%)",
                            background:"transparent", border:"none", color:"var(--t3)", cursor:"pointer", fontSize:11
                          }}>{showPass[editing.id] ? "скрыть" : "показать"}</button>
                      </div>
                    </div>
                  )}
                  {editing.authType === "keychain" && (
                    <div style={{ padding:"8px 10px", background:"var(--p2)", borderRadius:5, border:"1px solid var(--b2)", fontSize:11, color:"var(--t3)", lineHeight:1.6 }}>
                      ⬡ Пароль хранится в macOS Keychain.<br/>
                      Запустите: <span style={{color:"var(--amber)"}}>security add-internet-password -a {editing.user || "user"} -s {editing.host || "host"} -w</span>
                    </div>
                  )}

                  <div className="form-section-label">Дополнительно</div>
                  <div className="field-row">
                    <label className="field-label">Заметка</label>
                    <textarea className="field-note" rows={2}
                      placeholder="RTX 5070 Ti · Ollama · LiteLLM Proxy"
                      value={editing.note} onChange={e => setEditing(p => ({...p, note: e.target.value}))}/>
                  </div>
                  <div className="field-row">
                    <label className="field-label">Теги (через запятую)</label>
                    <input className="field-input" placeholder="gpu, llm, prod"
                      value={editing.tags.join(", ")}
                      onChange={e => setEditing(p => ({...p, tags: e.target.value.split(",").map(t=>t.trim()).filter(Boolean)}))}/>
                  </div>
                </div>
                <div className="detail-actions">
                  <div className="btn-row" style={{ marginBottom:8 }}>
                    <button className="btn-sec amber" style={{ flex:2 }} onClick={saveEdit}>
                      {isNew ? "Сохранить" : "Обновить"}
                    </button>
                    <button className="btn-sec" onClick={() => setEditing(null)}>Отмена</button>
                  </div>
                  {!isNew && (
                    <button className="btn-sec red" style={{ width:"100%" }}
                      onClick={() => { deleteSession(editing.id); setEditing(null); }}>
                      Удалить сессию
                    </button>
                  )}
                </div>
              </>
            ) : selSession ? (
              <>
                {/* DETAIL VIEW */}
                <div className="detail-hdr">
                  <div className="detail-dot" style={{
                    background: selSession.status === "connected" ? "var(--green)"
                               : selSession.status === "error" ? "var(--red)" : "var(--b3)",
                    boxShadow: selSession.status === "connected" ? "0 0 8px var(--green)" : "none"
                  }}/>
                  <span className="detail-title">{selSession.name}</span>
                  <span className="detail-group-badge" style={{
                    background: "rgba(167,139,250,.1)", border:"1px solid rgba(167,139,250,.2)", color:"var(--purple)"
                  }}>{selSession.group}</span>
                </div>

                <div className="detail-body">
                  {/* SSH command */}
                  <div className="field-row">
                    <label className="field-label">SSH Command</label>
                    <div className="ssh-cmd-box">
                      <span className="ssh-cmd-text">
                        ssh -p {selSession.port} {selSession.user}@{selSession.host}
                        {selSession.authType === "key" ? ` -i ${selSession.keyPath}` : ""}
                      </span>
                      <button
                        className={`btn-copy ${showCopied === selSession.id ? "copied" : ""}`}
                        onClick={() => copyCmd(selSession)}
                      >{showCopied === selSession.id ? "✓" : "copy"}</button>
                    </div>
                  </div>

                  {/* Fields */}
                  {[
                    ["Хост", selSession.host],
                    ["Порт", selSession.port],
                    ["Пользователь", selSession.user],
                    ["Аутентификация", selSession.authType === "key" ? `🔑 Key: ${selSession.keyPath}` : selSession.authType === "keychain" ? "⬡ macOS Keychain" : "🔒 Password"],
                    ["Последнее подключение", selSession.lastConn],
                    ["Статус", selSession.status],
                  ].map(([label, val]) => (
                    <div key={label} className="field-row">
                      <label className="field-label">{label}</label>
                      <div style={{
                        fontSize:12, color: label === "Статус"
                          ? selSession.status === "connected" ? "var(--green)"
                          : selSession.status === "error" ? "var(--red)" : "var(--t2)"
                          : "var(--t1)",
                        padding:"4px 0"
                      }}>{String(val)}</div>
                    </div>
                  ))}

                  {selSession.note && (
                    <div className="field-row">
                      <label className="field-label">Заметка</label>
                      <div style={{ fontSize:11, color:"var(--t2)", lineHeight:1.6, padding:"4px 0" }}>{selSession.note}</div>
                    </div>
                  )}

                  {selSession.tags.length > 0 && (
                    <div className="field-row">
                      <label className="field-label">Теги</label>
                      <div className="tag-list">{selSession.tags.map(t => <span key={t} className="tag">#{t}</span>)}</div>
                    </div>
                  )}

                  {/* Claude Code hint */}
                  <div style={{ marginTop:8, padding:"10px 12px", background:"var(--al)", borderRadius:6, border:"1px solid rgba(245,158,11,.15)" }}>
                    <div style={{ fontSize:9, letterSpacing:1.5, textTransform:"uppercase", color:"var(--amber)", fontFamily:"var(--ui)", fontWeight:700, marginBottom:6 }}>Claude Code на этом сервере</div>
                    <div style={{ fontSize:11, color:"var(--t2)", lineHeight:1.8 }}>
                      <div style={{ color:"var(--t3)" }}>После подключения:</div>
                      <div style={{ color:"var(--amber)" }}>cd ~/oes-mas && claude</div>
                      <div style={{ color:"var(--t3)", marginTop:2 }}>или с LiteLLM Proxy:</div>
                      <div style={{ color:"var(--amber)" }}>ANTHROPIC_BASE_URL=http://localhost:4000 claude</div>
                    </div>
                  </div>
                </div>

                <div className="detail-actions">
                  <button className="btn-primary" onClick={() => connect(selSession)}>
                    {selSession.id === connectedId ? "● Уже подключён" : "⚡ Подключиться"}
                  </button>
                  <div className="btn-row">
                    <button className="btn-sec amber" onClick={() => startEdit(selSession)}>✎ Редактировать</button>
                    <button className="btn-sec" onClick={() => copyCmd(selSession)}>
                      {showCopied === selSession.id ? "✓ Скопировано" : "⎘ Copy cmd"}
                    </button>
                    <button className="btn-sec red" onClick={() => deleteSession(selSession.id)}>✕</button>
                  </div>
                </div>
              </>
            ) : (
              <div className="empty-state">
                <div className="empty-icon">⊞</div>
                <div className="empty-title">Выбери сервер</div>
                <div className="empty-sub">
                  Нажми на сервер в списке<br/>
                  чтобы увидеть детали и подключиться<br/><br/>
                  <span style={{ color:"var(--amber)" }}>+ New</span> — добавить новый сервер
                </div>
              </div>
            )}
          </div>

          {/* ── Terminal output ── */}
          <div className="term-panel">
            <div className="term-hdr">
              {connSession ? (
                <>
                  <div className="sdot sdot-connected" style={{ width:8, height:8 }}/>
                  <span className="term-hdr-name">{connSession.name}</span>
                  <span className="term-hdr-host">{connSession.user}@{connSession.host}:{connSession.port}</span>
                  <div className="term-hdr-spacer"/>
                  <span className="term-hdr-badge">SSH LIVE</span>
                </>
              ) : (
                <span style={{ color:"var(--t3)", fontSize:12 }}>Нет активного соединения</span>
              )}
            </div>
            <div className="term-out" ref={termRef}>
              {termLog.map((l, i) => (
                <div key={i}>
                  {l.type === "cmd"  && <div className="tline-cmd"><span className="tprompt">❯</span><span>{l.text}</span></div>}
                  {l.type === "conn" && <div className="tline-conn">{l.text}</div>}
                  {l.type === "out"  && <div className="tline-out">{l.text}</div>}
                  {l.type === "info" && <div className="tline-info">{l.text}</div>}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Status bar */}
        <div className="statusbar">
          <div className="si">
            <div className="si-dot si-dot-g"/>
            {sessions.filter(s=>s.status==="connected").length} connected
          </div>
          <div className="si">{sessions.length} серверов всего</div>
          {connSession && (
            <div className="si" style={{ color:"var(--amber)" }}>
              Active: {connSession.user}@{connSession.host}
            </div>
          )}
          <div className="si-spacer"/>
          <div className="si">🔑 SSH keys: ~/.ssh/</div>
          <div className="si">⬡ Keychain support</div>
        </div>
      </div>
    </>
  );
}
