import { useState, useRef, useEffect, useCallback } from "react";

// ── Mode presets ──────────────────────────────────────────────
const MODES = {
  coding: {
    label: "Coding",
    icon: "{ }",
    color: "#60a5fa",
    model: "sonnet",
    thinking: false,
    thinkingBudget: 0,
    tools: { Bash:true, Edit:true, Write:true, Glob:true, Grep:true, WebSearch:false, WebFetch:false, Notebook:false },
    flags: ["--continue"],
    desc: "Полный доступ к инструментам. Sonnet — баланс скорости и качества.",
    permMode: "auto",
  },
  reasoning: {
    label: "Reasoning",
    icon: "◈",
    color: "#a78bfa",
    model: "opus",
    thinking: true,
    thinkingBudget: 10000,
    tools: { Bash:false, Edit:false, Write:false, Glob:true, Grep:true, WebSearch:true, WebFetch:true, Notebook:false },
    flags: ["--thinking"],
    desc: "Read-only + extended thinking. Opus для архитектурных решений.",
    permMode: "manual",
  },
  design: {
    label: "Design",
    icon: "◇",
    color: "#f472b6",
    model: "sonnet",
    thinking: false,
    thinkingBudget: 0,
    tools: { Bash:false, Edit:false, Write:true, Glob:true, Grep:false, WebSearch:true, WebFetch:true, Notebook:false },
    flags: [],
    desc: "UI, документация, веб-исследования. Запись файлов разрешена.",
    permMode: "auto",
  },
  research: {
    label: "Research",
    icon: "◎",
    color: "#34d399",
    model: "haiku",
    thinking: false,
    thinkingBudget: 0,
    tools: { Bash:false, Edit:false, Write:false, Glob:false, Grep:true, WebSearch:true, WebFetch:true, Notebook:false },
    flags: ["--dangerously-skip-permissions"],
    desc: "Только чтение + веб. Haiku — самый дешёвый режим.",
    permMode: "skip",
  },
};

// ── Model pricing (per 1M tokens, $) ─────────────────────────
const MODELS = {
  haiku:  { label: "Haiku 4.5",   in: 0.25,  out: 1.25,  speed: "●●●○", quality: "●●○○", color: "#34d399" },
  sonnet: { label: "Sonnet 4.6",  in: 3.00,  out: 15.00, speed: "●●●○", quality: "●●●○", color: "#60a5fa" },
  opus:   { label: "Opus 4.6",    in: 15.00, out: 75.00, speed: "●●○○", quality: "●●●●", color: "#a78bfa" },
};

const TOOL_INFO = {
  Bash:      { icon: ">_", risk: "high",  desc: "Выполнение shell команд" },
  Edit:      { icon: "✎",  risk: "med",   desc: "Редактирование файлов" },
  Write:     { icon: "+",  risk: "med",   desc: "Создание новых файлов" },
  Glob:      { icon: "**", risk: "none",  desc: "Поиск файлов по паттерну" },
  Grep:      { icon: "🔍", risk: "none",  desc: "Поиск в содержимом файлов" },
  WebSearch: { icon: "🌐", risk: "none",  desc: "Поиск в интернете" },
  WebFetch:  { icon: "↓",  risk: "low",   desc: "Загрузка URL-страниц" },
  Notebook:  { icon: "📓", risk: "med",   desc: "Редактирование Jupyter" },
};

const MEMORY_FILES = [
  { name: "~/.claude/CLAUDE.md", scope: "global", size: "2.1k", desc: "Глобальные предпочтения" },
  { name: "./CLAUDE.md",         scope: "project", size: "4.7k", desc: "Архитектура OES.MAS" },
  { name: "./.claude/settings.local.json", scope: "local", size: "0.8k", desc: "Локальные overrides (git-ignored)" },
];

const OBS_NOTES = [
  { name: "OES.MAS Architecture.md", modified: "сегодня 14:22", tags: ["architecture","agents"] },
  { name: "LangGraph Decision.md",   modified: "вчера 21:05",   tags: ["decision"] },
  { name: "CEO Twin v3 spec.md",     modified: "вчера 18:30",   tags: ["ceo","llm"] },
  { name: "VGK Production Chain.md", modified: "3 дня назад",   tags: ["production"] },
];

const QUICK_CMDS = {
  session: [
    { label: "Start",     cmd: "claude",                icon: "⚡" },
    { label: "Continue",  cmd: "claude --continue",     icon: "▶" },
    { label: "Resume",    cmd: "claude --resume",       icon: "⏮" },
    { label: "Cost",      cmd: "/cost",                 icon: "$" },
    { label: "Compact",   cmd: "/compact",              icon: "⎜⎜" },
    { label: "Memory",    cmd: "/memory",               icon: "🧠" },
  ],
  code: [
    { label: "Review",    cmd: 'claude "Review this code for bugs and security issues"', icon: "🔍" },
    { label: "Fix",       cmd: 'claude "Find and fix all bugs"',                         icon: "🐛" },
    { label: "Tests",     cmd: 'claude "Write unit tests with 80% coverage"',            icon: "✓" },
    { label: "Refactor",  cmd: 'claude "Refactor for readability and performance"',      icon: "♻" },
    { label: "Explain",   cmd: 'claude "Explain this codebase architecture"',            icon: "💡" },
    { label: "PR",        cmd: 'claude "Draft PR description for staged changes"',       icon: "🔀" },
  ],
  arch: [
    { label: "Design",    cmd: 'claude "Design the architecture for: "',                 icon: "◈" },
    { label: "Tradeoffs", cmd: 'claude "Analyse tradeoffs: A vs B approach for "',      icon: "⚖" },
    { label: "Plan",      cmd: 'claude "Create implementation plan for "',               icon: "📋" },
    { label: "ADR",       cmd: 'claude "Write Architecture Decision Record for "',       icon: "📄" },
  ],
};

const MOCK_HISTORY = [
  { type: "cmd",  text: "claude --version" },
  { type: "out",  text: "Claude Code 2.1.92  /  claude-sonnet-4-6" },
  { type: "cmd",  text: "claude" },
  { type: "banner", text:
`  ██████╗██╗      █████╗ ██╗   ██╗██████╗ ███████╗
 ██╔════╝██║     ██╔══██╗██║   ██║██╔══██╗██╔════╝
 ██║     ██║     ███████║██║   ██║██║  ██║█████╗
 ██║     ██║     ██╔══██║██║   ██║██║  ██║██╔══╝
 ╚██████╗███████╗██║  ██║╚██████╔╝██████╔╝███████╗
  ╚═════╝╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚═════╝ ╚══════╝` },
  { type: "out",  text: " Project  : oes-mas              Mode    : Coding\n Files    : 7 indexed             Model   : Sonnet 4.6\n Context  : 18.4k / 200k tokens   Memory  : 3 files loaded\n Obsidian : ✓ vault connected     MCP     : 4 servers active\n\n❯ Готов к работе. Что строим сегодня?" },
  { type: "cmd",  text: '/cost' },
  { type: "cost", text: null },
];

// ── Helpers ───────────────────────────────────────────────────
function calcCost(inputTok, outputTok, model) {
  const m = MODELS[model];
  return ((inputTok * m.in + outputTok * m.out) / 1_000_000).toFixed(4);
}

export default function App() {
  const [mode, setMode]           = useState("coding");
  const [tools, setTools]         = useState({ ...MODES.coding.tools });
  const [model, setModel]         = useState("sonnet");
  const [thinking, setThinking]   = useState(false);
  const [thinkBudget, setThinkBudget] = useState(0);
  const [input, setInput]         = useState("");
  const [history, setHistory]     = useState(MOCK_HISTORY);
  const [cmdHist, setCmdHist]     = useState([]);
  const [cmdIdx, setCmdIdx]       = useState(-1);
  const [panel, setPanel]         = useState("files");      // files | tools | obsidian | memory
  const [isTyping, setIsTyping]   = useState(false);
  const [inputTok]                = useState(18400);
  const [outputTok]               = useState(4200);
  const [sessionCost]             = useState(0.0821);
  const [obsStatus]               = useState("connected");
  const [permMode, setPermMode]   = useState("auto");

  const inputRef    = useRef(null);
  const termRef     = useRef(null);

  useEffect(() => {
    if (termRef.current) termRef.current.scrollTop = termRef.current.scrollHeight;
  }, [history]);

  const applyMode = (key) => {
    const m = MODES[key];
    setMode(key);
    setTools({ ...m.tools });
    setModel(m.model);
    setThinking(m.thinking);
    setThinkBudget(m.thinkingBudget);
    setPermMode(m.permMode);
  };

  const toggleTool = (name) => {
    setTools(prev => ({ ...prev, [name]: !prev[name] }));
  };

  const run = useCallback(() => {
    if (!input.trim()) return;
    setHistory(prev => [...prev, { type: "cmd", text: input }]);
    setCmdHist(prev => [input, ...prev.slice(0, 49)]);
    setCmdIdx(-1);
    setInput("");
    setIsTyping(true);
    setTimeout(() => {
      setIsTyping(false);
      setHistory(prev => [...prev, { type: "out", text: `→ Executing in ${MODES[mode].label} mode...\n[Response appears here]` }]);
    }, 900);
  }, [input, mode]);

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); run(); }
    else if (e.key === "ArrowUp") {
      e.preventDefault();
      const i = Math.min(cmdIdx + 1, cmdHist.length - 1);
      setCmdIdx(i); if (cmdHist[i]) setInput(cmdHist[i]);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      const i = cmdIdx - 1;
      setCmdIdx(Math.max(i, -1));
      setInput(i < 0 ? "" : cmdHist[i]);
    }
  };

  const insertCmd = (cmd) => { setInput(cmd); inputRef.current?.focus(); };

  const activeModel = MODELS[model];
  const costNow = parseFloat(calcCost(inputTok, outputTok, model));
  const activeMode = MODES[mode];
  const enabledTools = Object.entries(tools).filter(([,v]) => v).map(([k]) => k);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600&family=Rajdhani:wght@400;500;600;700&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        :root {
          --bg: #08080a; --p1: #0e0e12; --p2: #12121a; --p3: #16161f;
          --b1: #1c1c28; --b2: #26263a; --b3: #32324a;
          --t1: #e8e8f0; --t2: #a0a0b8; --t3: #60607a;
          --amber: #f59e0b; --al: rgba(245,158,11,.08); --am: rgba(245,158,11,.16);
          --green: #22c55e; --gl: rgba(34,197,94,.1);
          --red: #ef4444; --blue: #60a5fa; --purple: #a78bfa; --pink: #f472b6; --teal: #34d399;
          --mono: 'JetBrains Mono', monospace; --ui: 'Rajdhani', sans-serif;
        }
        body { background: var(--bg); color: var(--t2); font-family: var(--mono); }
        .app { display:flex; flex-direction:column; height:100vh; overflow:hidden; background:var(--bg); }

        /* ── Titlebar ── */
        .titlebar {
          height:38px; min-height:38px; display:flex; align-items:center;
          background:var(--p1); border-bottom:1px solid var(--b1);
          padding:0 16px; gap:12px; user-select:none; flex-shrink:0;
        }
        .tlights { display:flex; gap:7px; }
        .tl { width:12px; height:12px; border-radius:50%; cursor:pointer; }
        .tl-r{background:#ff5f57} .tl-y{background:#febc2e} .tl-g{background:#28c840}
        .tc { flex:1; display:flex; justify-content:center; align-items:center; gap:10px; }
        .tc-name { font-family:var(--ui); font-weight:700; font-size:13px; letter-spacing:3px; color:var(--amber); text-transform:uppercase; }
        .tc-sep  { color:var(--b3); }
        .tc-meta { font-size:10px; color:var(--t3); letter-spacing:.5px; }
        .tc-badge {
          font-family:var(--ui); font-size:10px; font-weight:700; letter-spacing:1.5px;
          padding:2px 8px; border-radius:3px; text-transform:uppercase;
          border:1px solid; transition:all .2s;
        }

        /* ── Mode bar ── */
        .modebar {
          height:40px; min-height:40px; display:flex; align-items:stretch;
          background:var(--p2); border-bottom:1px solid var(--b1); flex-shrink:0;
        }
        .mode-btn {
          flex:1; display:flex; align-items:center; justify-content:center; gap:6px;
          background:transparent; border:none; border-right:1px solid var(--b1);
          color:var(--t3); cursor:pointer; font-family:var(--ui);
          font-weight:600; font-size:12px; letter-spacing:1px; text-transform:uppercase;
          transition:all .15s; position:relative;
        }
        .mode-btn:last-child { border-right:none; }
        .mode-btn:hover { color:var(--t1); background:var(--p3); }
        .mode-btn.active { color:var(--t1); background:var(--p3); }
        .mode-btn.active::after {
          content:''; position:absolute; bottom:0; left:0; right:0; height:2px;
          background:var(--mc, var(--amber));
        }
        .mode-icon { font-size:11px; font-family:var(--mono); }
        .mode-desc {
          position:absolute; bottom:calc(100% + 8px); left:50%; transform:translateX(-50%);
          background:var(--p1); border:1px solid var(--b2); border-radius:6px;
          padding:8px 12px; font-size:11px; color:var(--t2); white-space:nowrap;
          pointer-events:none; opacity:0; transition:opacity .15s; z-index:99;
          font-family:var(--mono); line-height:1.5;
        }
        .mode-btn:hover .mode-desc { opacity:1; }

        /* ── Main ── */
        .main { display:flex; flex:1; overflow:hidden; }

        /* ── Sidebar ── */
        .sidebar {
          width:240px; min-width:200px; display:flex; flex-direction:column;
          background:var(--p1); border-right:1px solid var(--b1); overflow:hidden; flex-shrink:0;
        }
        .sidebar-tabs {
          display:flex; border-bottom:1px solid var(--b1); flex-shrink:0;
        }
        .stab {
          flex:1; padding:7px 4px; background:transparent; border:none;
          font-family:var(--ui); font-weight:600; font-size:9px; letter-spacing:1.5px;
          text-transform:uppercase; color:var(--t3); cursor:pointer; transition:all .12s;
          border-bottom:2px solid transparent;
        }
        .stab:hover { color:var(--t1); }
        .stab.active { color:var(--amber); border-bottom-color:var(--amber); }
        .sidebar-body { flex:1; overflow-y:auto; padding:6px 0; }
        .sidebar-body::-webkit-scrollbar { width:3px; }
        .sidebar-body::-webkit-scrollbar-thumb { background:var(--b2); border-radius:2px; }

        /* Tools panel */
        .tool-group { padding:4px 10px 2px; }
        .tool-group-label {
          font-size:9px; letter-spacing:2px; text-transform:uppercase; color:var(--t3);
          font-family:var(--ui); font-weight:600; padding:4px 0 6px;
        }
        .tool-item {
          display:flex; align-items:center; gap:8px; padding:5px 8px;
          border-radius:5px; cursor:pointer; transition:all .1s; margin-bottom:2px;
        }
        .tool-item:hover { background:var(--p3); }
        .tool-icon {
          width:24px; height:24px; display:flex; align-items:center; justify-content:center;
          border-radius:4px; font-size:9px; font-family:var(--mono); flex-shrink:0;
          border:1px solid var(--b2); background:var(--p2);
        }
        .tool-item.enabled .tool-icon { background:var(--al); border-color:var(--amber); color:var(--amber); }
        .tool-item.enabled .tool-name { color:var(--t1); }
        .tool-name { font-size:12px; flex:1; color:var(--t2); }
        .tool-desc { font-size:10px; color:var(--t3); display:none; }
        .tool-item:hover .tool-desc { display:block; }
        .risk-dot { width:5px; height:5px; border-radius:50%; flex-shrink:0; }
        .risk-none { background:var(--green); }
        .risk-low  { background:var(--amber); }
        .risk-med  { background:#fb923c; }
        .risk-high { background:var(--red); }
        .toggle-switch {
          width:28px; height:16px; border-radius:8px; border:1px solid var(--b3);
          background:var(--p3); cursor:pointer; position:relative; transition:all .15s;
          flex-shrink:0;
        }
        .toggle-switch.on { background:var(--amber); border-color:var(--amber); }
        .toggle-switch::after {
          content:''; position:absolute; width:10px; height:10px; border-radius:50%;
          background:var(--t3); top:2px; left:2px; transition:all .15s;
        }
        .toggle-switch.on::after { left:14px; background:#000; }

        /* Memory panel */
        .mem-item {
          padding:8px 14px; border-bottom:1px solid var(--b1); cursor:pointer; transition:background .1s;
        }
        .mem-item:hover { background:var(--p3); }
        .mem-name { font-size:11px; color:var(--t1); margin-bottom:2px; }
        .mem-row { display:flex; gap:8px; align-items:center; }
        .mem-scope {
          font-size:9px; font-family:var(--ui); font-weight:600; letter-spacing:1px;
          text-transform:uppercase; padding:1px 5px; border-radius:3px;
        }
        .mem-scope.global  { background:rgba(96,165,250,.12);  color:var(--blue); }
        .mem-scope.project { background:rgba(245,158,11,.12);  color:var(--amber); }
        .mem-scope.local   { background:rgba(34,197,94,.12);   color:var(--green); }
        .mem-size { font-size:10px; color:var(--t3); margin-left:auto; }
        .mem-desc { font-size:10px; color:var(--t3); margin-top:2px; }
        .mem-actions { padding:10px 14px; display:flex; gap:6px; flex-shrink:0; border-top:1px solid var(--b1); }

        /* Obsidian panel */
        .obs-status {
          display:flex; align-items:center; gap:8px; padding:10px 14px;
          border-bottom:1px solid var(--b1); font-size:11px;
        }
        .obs-dot { width:8px; height:8px; border-radius:50%; }
        .obs-connected    { background:var(--green); box-shadow:0 0 6px var(--green); }
        .obs-disconnected { background:var(--red); }
        .obs-info { font-size:10px; color:var(--t3); margin-top:1px; }
        .obs-note {
          display:flex; flex-direction:column; gap:3px;
          padding:8px 14px; border-bottom:1px solid var(--b1); cursor:pointer; transition:all .1s;
        }
        .obs-note:hover { background:var(--p3); }
        .obs-note-name { font-size:11px; color:var(--t1); }
        .obs-note-meta { display:flex; gap:6px; align-items:center; }
        .obs-note-time { font-size:10px; color:var(--t3); }
        .obs-tag {
          font-size:9px; padding:1px 5px; border-radius:3px;
          background:rgba(167,139,250,.1); color:var(--purple); border:1px solid rgba(167,139,250,.2);
        }
        .obs-actions { padding:10px 14px; display:flex; flex-direction:column; gap:6px; flex-shrink:0; border-top:1px solid var(--b1); }
        .obs-btn {
          background:transparent; border:1px solid var(--b2); border-radius:4px;
          color:var(--t2); font-family:var(--mono); font-size:11px;
          padding:5px 10px; cursor:pointer; transition:all .12s; text-align:left;
          display:flex; align-items:center; gap:6px;
        }
        .obs-btn:hover { border-color:var(--purple); color:var(--purple); }
        .obs-code { font-size:10px; color:var(--t3); padding:8px 14px; }

        /* ── Terminal ── */
        .term-wrap { flex:1; display:flex; flex-direction:column; overflow:hidden; }
        .term-out {
          flex:1; overflow-y:auto; padding:14px 20px 4px;
          font-size:12.5px; line-height:1.65;
        }
        .term-out::-webkit-scrollbar { width:4px; }
        .term-out::-webkit-scrollbar-thumb { background:var(--b2); border-radius:2px; }
        .tentry { margin-bottom:8px; }
        .tcmd { display:flex; gap:8px; }
        .tprompt { color:var(--green); flex-shrink:0; }
        .tcmd-text { color:var(--t1); }
        .tout {
          white-space:pre; overflow-x:auto; color:var(--t2);
          padding:6px 10px; border-left:2px solid var(--b2);
          font-size:12px; line-height:1.6; margin-top:2px;
        }
        .tbanner {
          white-space:pre; font-size:9px; line-height:1.35;
          color:var(--amber); opacity:.5; padding:3px 0;
        }
        .tcost {
          background:var(--p2); border:1px solid var(--b2); border-radius:8px;
          padding:12px 14px; margin-top:4px; font-size:11px;
        }
        .cost-row { display:flex; justify-content:space-between; margin-bottom:5px; }
        .cost-label { color:var(--t3); }
        .cost-val   { color:var(--t1); font-weight:500; }
        .cost-hi    { color:var(--amber); }
        .cost-sep   { border:none; border-top:1px solid var(--b2); margin:6px 0; }
        .cost-bar-wrap { margin-top:8px; }
        .cost-bar-label { display:flex; justify-content:space-between; font-size:10px; color:var(--t3); margin-bottom:4px; }
        .cost-bar-track { height:4px; background:var(--b1); border-radius:2px; overflow:hidden; }
        .cost-bar-fill  { height:100%; border-radius:2px; transition:width .3s; }
        .ttyping {
          display:flex; align-items:center; gap:6px;
          color:var(--t3); font-size:11px; padding:4px 0;
        }
        .dots span {
          display:inline-block; width:4px; height:4px; border-radius:50%;
          background:var(--amber); margin:0 1px;
          animation:bounce 1.2s infinite;
        }
        .dots span:nth-child(2){animation-delay:.2s}
        .dots span:nth-child(3){animation-delay:.4s}
        @keyframes bounce {
          0%,60%,100%{transform:translateY(0);opacity:.4}
          30%{transform:translateY(-4px);opacity:1}
        }

        /* ── Input ── */
        .input-zone { border-top:1px solid var(--b1); background:var(--p1); flex-shrink:0; }
        .irow { display:flex; align-items:center; gap:8px; padding:9px 14px; }
        .iprompt { color:var(--green); font-size:14px; flex-shrink:0; }
        .ifield {
          flex:1; background:transparent; border:none; outline:none;
          color:var(--t1); font-family:var(--mono); font-size:13px;
          caret-color:var(--amber);
        }
        .ifield::placeholder { color:var(--t3); }
        .ibtn {
          background:var(--amber); border:none; border-radius:5px;
          color:#000; font-family:var(--ui); font-weight:700; font-size:12px;
          letter-spacing:1px; padding:5px 14px; cursor:pointer; transition:opacity .15s;
          flex-shrink:0;
        }
        .ibtn:hover { opacity:.85; }
        .ibtn-ghost {
          background:transparent; border:1px solid var(--b2); border-radius:5px;
          color:var(--t3); font-family:var(--mono); font-size:11px;
          padding:5px 10px; cursor:pointer; transition:all .12s; flex-shrink:0;
        }
        .ibtn-ghost:hover { border-color:var(--red); color:var(--red); }

        /* ── Quick cmds ── */
        .qzone { border-top:1px solid var(--b1); background:var(--p2); padding:8px 14px 10px; flex-shrink:0; }
        .qtop { display:flex; align-items:center; gap:10px; margin-bottom:7px; }
        .qlabel { font-family:var(--ui); font-weight:700; font-size:9px; letter-spacing:2px; text-transform:uppercase; color:var(--t3); }
        .qtabs { display:flex; gap:4px; }
        .qtab {
          background:transparent; border:1px solid var(--b1); border-radius:3px;
          color:var(--t3); font-family:var(--mono); font-size:10px;
          padding:2px 8px; cursor:pointer; transition:all .1s;
        }
        .qtab:hover, .qtab.active { border-color:var(--amber); color:var(--amber); background:var(--al); }
        .qgrid { display:flex; gap:5px; flex-wrap:wrap; }
        .qbtn {
          background:transparent; border:1px solid var(--b1); border-radius:4px;
          color:var(--t2); font-family:var(--mono); font-size:11px;
          padding:4px 10px; cursor:pointer; transition:all .12s;
          display:flex; align-items:center; gap:5px; white-space:nowrap;
        }
        .qbtn:hover { border-color:var(--amber); color:var(--amber); background:var(--al); transform:translateY(-1px); }

        /* ── Status bar ── */
        .statusbar {
          height:22px; min-height:22px; display:flex; align-items:center;
          background:var(--p1); border-top:1px solid var(--b1);
          padding:0 12px; gap:0; flex-shrink:0; overflow:hidden;
        }
        .sitem {
          display:flex; align-items:center; gap:5px; font-size:10px; color:var(--t3);
          padding:0 12px; border-right:1px solid var(--b1); white-space:nowrap;
        }
        .sitem:last-child { border-right:none; }
        .sdot { width:5px; height:5px; border-radius:50%; }
        .sdot-g { background:var(--green); box-shadow:0 0 4px var(--green); }
        .sdot-a { background:var(--amber); }
        .sdot-r { background:var(--red); }
        .sspacer { flex:1; }
        .skbd kbd {
          background:var(--p2); border:1px solid var(--b2); border-radius:2px;
          padding:0 4px; font-family:var(--mono); font-size:9px; color:var(--t2);
        }
        .spill {
          display:flex; align-items:center; gap:3px; font-size:10px;
          color:var(--t3); padding:0 8px; border-right:1px solid var(--b1); cursor:pointer;
          transition:color .1s;
        }
        .spill:hover { color:var(--t1); }

        /* perm mode badge */
        .perm-badge {
          font-size:9px; padding:1px 6px; border-radius:3px; font-family:var(--ui);
          font-weight:700; letter-spacing:1px; text-transform:uppercase;
        }
        .perm-auto   { background:rgba(34,197,94,.12);   color:var(--green); border:1px solid rgba(34,197,94,.2); }
        .perm-manual { background:rgba(245,158,11,.12);  color:var(--amber); border:1px solid rgba(245,158,11,.2); }
        .perm-skip   { background:rgba(239,68,68,.12);   color:var(--red);   border:1px solid rgba(239,68,68,.2); }

        /* token bar */
        .tbar-wrap { flex:1; max-width:180px; }
        .tbar-label { display:flex; justify-content:space-between; font-size:9px; color:var(--t3); margin-bottom:2px; }
        .tbar-track { height:3px; background:var(--b1); border-radius:2px; overflow:hidden; }
        .tbar-fill  { height:100%; border-radius:2px; transition:width .3s; }
      `}</style>

      <div className="app">
        {/* Titlebar */}
        <div className="titlebar">
          <div className="tlights">
            <div className="tl tl-r"/><div className="tl tl-y"/><div className="tl tl-g"/>
          </div>
          <div className="tc">
            <span className="tc-name">Claude Terminal</span>
            <span className="tc-sep">·</span>
            <span className="tc-meta">oes-mas</span>
            <span className="tc-sep">·</span>
            <span className="tc-meta">llmsrv</span>
          </div>
          <div className="tc-badge" style={{
            color: activeModel.color,
            borderColor: activeModel.color + "55",
            background: activeModel.color + "11",
          }}>{activeModel.label}</div>
        </div>

        {/* Mode bar */}
        <div className="modebar">
          {Object.entries(MODES).map(([key, m]) => (
            <button
              key={key}
              className={`mode-btn ${mode === key ? "active" : ""}`}
              style={{ "--mc": m.color }}
              onClick={() => applyMode(key)}
            >
              <span className="mode-icon" style={{ color: mode === key ? m.color : undefined }}>{m.icon}</span>
              {m.label}
              <div className="mode-desc">
                <strong style={{ color: m.color }}>{m.label}</strong> · {MODELS[m.model].label}<br/>
                {m.desc}<br/>
                <span style={{ color: "#666" }}>Tools: {Object.entries(m.tools).filter(([,v])=>v).map(([k])=>k).join(", ")}</span>
              </div>
            </button>
          ))}
        </div>

        <div className="main">
          {/* Sidebar */}
          <div className="sidebar">
            <div className="sidebar-tabs">
              {[
                { id:"tools",   label:"Tools" },
                { id:"memory",  label:"Memory" },
                { id:"obsidian",label:"Obsidian" },
              ].map(t => (
                <button key={t.id}
                  className={`stab ${panel === t.id ? "active" : ""}`}
                  onClick={() => setPanel(t.id)}
                >{t.label}</button>
              ))}
            </div>

            {/* ── Tools panel ── */}
            {panel === "tools" && (
              <>
                <div className="sidebar-body">
                  <div className="tool-group">
                    <div className="tool-group-label">Read-only (safe)</div>
                    {["Glob","Grep","WebSearch","WebFetch"].map(name => {
                      const info = TOOL_INFO[name];
                      return (
                        <div key={name} className={`tool-item ${tools[name] ? "enabled" : ""}`}
                          onClick={() => toggleTool(name)}>
                          <div className="tool-icon">{info.icon}</div>
                          <span className="tool-name">{name}</span>
                          <div className={`risk-dot risk-${info.risk}`} title={info.desc}/>
                          <div className={`toggle-switch ${tools[name] ? "on" : ""}`}/>
                        </div>
                      );
                    })}
                  </div>
                  <div className="tool-group">
                    <div className="tool-group-label">Write (modify)</div>
                    {["Edit","Write","Notebook"].map(name => {
                      const info = TOOL_INFO[name];
                      return (
                        <div key={name} className={`tool-item ${tools[name] ? "enabled" : ""}`}
                          onClick={() => toggleTool(name)}>
                          <div className="tool-icon">{info.icon}</div>
                          <span className="tool-name">{name}</span>
                          <div className={`risk-dot risk-${info.risk}`} title={info.desc}/>
                          <div className={`toggle-switch ${tools[name] ? "on" : ""}`}/>
                        </div>
                      );
                    })}
                  </div>
                  <div className="tool-group">
                    <div className="tool-group-label">Execute (high risk)</div>
                    {["Bash"].map(name => {
                      const info = TOOL_INFO[name];
                      return (
                        <div key={name} className={`tool-item ${tools[name] ? "enabled" : ""}`}
                          onClick={() => toggleTool(name)}>
                          <div className="tool-icon">{info.icon}</div>
                          <span className="tool-name">{name}</span>
                          <div className={`risk-dot risk-${info.risk}`} title={info.desc}/>
                          <div className={`toggle-switch ${tools[name] ? "on" : ""}`}/>
                        </div>
                      );
                    })}
                  </div>
                  <div className="tool-group" style={{borderTop:"1px solid var(--b1)", paddingTop:10}}>
                    <div className="tool-group-label">Permissions mode</div>
                    {[
                      { id:"auto",   label:"Auto",   sub:"Classifier approves",  cls:"perm-auto" },
                      { id:"manual", label:"Manual",  sub:"Ask every time",       cls:"perm-manual" },
                      { id:"skip",   label:"YOLO",    sub:"Skip all checks",      cls:"perm-skip" },
                    ].map(pm => (
                      <div key={pm.id}
                        className="tool-item" style={{ cursor:"pointer" }}
                        onClick={() => setPermMode(pm.id)}>
                        <div style={{
                          width:8, height:8, borderRadius:"50%", flexShrink:0,
                          background: permMode===pm.id
                            ? pm.cls.includes("auto") ? "var(--green)" : pm.cls.includes("manual") ? "var(--amber)" : "var(--red)"
                            : "var(--b3)"
                        }}/>
                        <span className="tool-name" style={{ fontSize:11 }}>{pm.label}</span>
                        <span style={{ fontSize:10, color:"var(--t3)" }}>{pm.sub}</span>
                      </div>
                    ))}
                  </div>
                  <div className="tool-group" style={{borderTop:"1px solid var(--b1)", paddingTop:10}}>
                    <div className="tool-group-label">Extended Thinking</div>
                    <div className="tool-item" onClick={() => setThinking(v => !v)}>
                      <div className="tool-icon" style={{ color:"var(--purple)" }}>◈</div>
                      <span className="tool-name" style={{ fontSize:11 }}>Thinking mode</span>
                      <div className={`toggle-switch ${thinking ? "on" : ""}`} style={thinking ? {background:"var(--purple)", borderColor:"var(--purple)"} : {}}/>
                    </div>
                    {thinking && (
                      <div style={{ padding:"4px 8px 6px", fontSize:10, color:"var(--t3)" }}>
                        Budget: {thinkBudget.toLocaleString()} tokens
                        <br/>≈ ${((thinkBudget * MODELS[model].in) / 1_000_000).toFixed(4)} extra/call
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ padding:"8px 14px", borderTop:"1px solid var(--b1)", flexShrink:0 }}>
                  <div style={{ fontSize:10, color:"var(--t3)", lineHeight:1.6 }}>
                    Active: <span style={{ color:"var(--amber)" }}>{enabledTools.join(", ")}</span>
                  </div>
                  <div style={{ fontSize:10, color:"var(--t3)", marginTop:4 }}>
                    CLI: <span style={{ color:"var(--t2)" }}>
                      claude {permMode==="skip" ? "--dangerously-skip-permissions" : ""}{" "}
                      {`--allowedTools "${enabledTools.join(",")}"`}
                    </span>
                  </div>
                </div>
              </>
            )}

            {/* ── Memory panel ── */}
            {panel === "memory" && (
              <>
                <div className="sidebar-body">
                  <div style={{ padding:"8px 14px 4px", fontSize:10, color:"var(--t3)", lineHeight:1.6 }}>
                    CLAUDE.md автоматически загружается при старте сессии. Правила сохраняются между сессиями.
                  </div>
                  {MEMORY_FILES.map(f => (
                    <div key={f.name} className="mem-item">
                      <div className="mem-name">{f.name.split("/").pop()}</div>
                      <div className="mem-row">
                        <span className={`mem-scope ${f.scope}`}>{f.scope}</span>
                        <span className="mem-size">{f.size}</span>
                      </div>
                      <div className="mem-desc">{f.desc}</div>
                    </div>
                  ))}
                  <div style={{ padding:"10px 14px 4px", borderTop:"1px solid var(--b1)" }}>
                    <div style={{ fontSize:10, color:"var(--t3)", lineHeight:1.8 }}>
                      <div style={{ marginBottom:4, color:"var(--amber)", fontFamily:"var(--ui)", fontSize:9, letterSpacing:1, textTransform:"uppercase" }}>Управление контекстом</div>
                      <div>/compact — сжать историю, сохранив суть</div>
                      <div>/compact "сохрани решения по архитектуре"</div>
                      <div>/memory — список memory-файлов</div>
                      <div>/context — визуализация занятого контекста</div>
                    </div>
                  </div>
                  <div style={{ padding:"8px 14px", borderTop:"1px solid var(--b1)" }}>
                    <div style={{ fontSize:10, color:"var(--amber)", fontFamily:"var(--ui)", fontSize:9, letterSpacing:1, textTransform:"uppercase", marginBottom:6 }}>Token usage</div>
                    <div className="cost-bar-wrap">
                      <div className="cost-bar-label">
                        <span>Context</span>
                        <span style={{ color: inputTok/200000 > 0.8 ? "var(--red)" : "var(--t2)" }}>
                          {(inputTok/1000).toFixed(1)}k / 200k
                        </span>
                      </div>
                      <div className="cost-bar-track">
                        <div className="cost-bar-fill" style={{
                          width: `${(inputTok/200000)*100}%`,
                          background: inputTok/200000 > 0.8 ? "var(--red)" : inputTok/200000 > 0.5 ? "var(--amber)" : "var(--green)"
                        }}/>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="mem-actions">
                  <button className="obs-btn" style={{ flex:1 }} onClick={() => insertCmd("/compact")}>
                    ⎜⎜ Compact now
                  </button>
                  <button className="obs-btn" style={{ flex:1 }} onClick={() => insertCmd("/memory")}>
                    🧠 Edit memory
                  </button>
                </div>
              </>
            )}

            {/* ── Obsidian panel ── */}
            {panel === "obsidian" && (
              <>
                <div className="obs-status">
                  <div className={`obs-dot ${obsStatus === "connected" ? "obs-connected" : "obs-disconnected"}`}/>
                  <div>
                    <div style={{ color: obsStatus === "connected" ? "var(--green)" : "var(--red)", fontWeight:500 }}>
                      {obsStatus === "connected" ? "Vault connected" : "Disconnected"}
                    </div>
                    <div className="obs-info">port 22360 · obsidian-claude-code-mcp</div>
                  </div>
                </div>
                <div className="sidebar-body">
                  <div style={{ padding:"6px 14px 4px", fontSize:9, letterSpacing:1.5, textTransform:"uppercase", color:"var(--t3)", fontFamily:"var(--ui)", fontWeight:600 }}>Recent Notes</div>
                  {OBS_NOTES.map(n => (
                    <div key={n.name} className="obs-note">
                      <div className="obs-note-name">📄 {n.name}</div>
                      <div className="obs-note-meta">
                        <span className="obs-note-time">{n.modified}</span>
                        {n.tags.map(t => <span key={t} className="obs-tag">#{t}</span>)}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="obs-actions">
                  <button className="obs-btn" onClick={() => insertCmd('claude "Search my Obsidian vault for notes about "')} >
                    🔍 Search vault
                  </button>
                  <button className="obs-btn" onClick={() => insertCmd('claude "Save this session summary to Obsidian"')}>
                    💾 Save session → vault
                  </button>
                  <button className="obs-btn" onClick={() => insertCmd('claude "Open OES.MAS Architecture note from Obsidian"')}>
                    📂 Open note
                  </button>
                </div>
                <div className="obs-code">
                  Setup: <span style={{color:"var(--amber)"}}>claude mcp add obsidian</span><br/>
                  Config: port 22360 (HTTP/SSE)<br/>
                  Plugin: obsidian-claude-code-mcp
                </div>
              </>
            )}
          </div>

          {/* Terminal */}
          <div className="term-wrap">
            <div className="term-out" ref={termRef}>
              {history.map((e, i) => (
                <div className="tentry" key={i}>
                  {e.type === "cmd"    && <div className="tcmd"><span className="tprompt">❯</span><span className="tcmd-text">{e.text}</span></div>}
                  {e.type === "out"    && <div className="tout">{e.text}</div>}
                  {e.type === "banner" && <div className="tbanner">{e.text}</div>}
                  {e.type === "cost"   && (
                    <div className="tcost">
                      <div style={{ fontSize:10, color:"var(--t3)", letterSpacing:1.5, textTransform:"uppercase", fontFamily:"var(--ui)", fontWeight:600, marginBottom:8 }}>Session Cost Report</div>
                      <div className="cost-row"><span className="cost-label">Model</span><span className="cost-val">{activeModel.label}</span></div>
                      <div className="cost-row"><span className="cost-label">Input tokens</span><span className="cost-val">{inputTok.toLocaleString()}</span></div>
                      <div className="cost-row"><span className="cost-label">Output tokens</span><span className="cost-val">{outputTok.toLocaleString()}</span></div>
                      <hr className="cost-sep"/>
                      <div className="cost-row"><span className="cost-label">Input cost</span><span className="cost-val">${((inputTok * activeModel.in) / 1_000_000).toFixed(4)}</span></div>
                      <div className="cost-row"><span className="cost-label">Output cost</span><span className="cost-val">${((outputTok * activeModel.out) / 1_000_000).toFixed(4)}</span></div>
                      <div className="cost-row"><span className="cost-label" style={{fontWeight:600}}>Session total</span><span className="cost-hi" style={{fontSize:13}}>${costNow.toFixed(4)}</span></div>
                      <div className="cost-bar-wrap" style={{ marginTop:10 }}>
                        <div className="cost-bar-label"><span>Context used</span><span>{(inputTok/1000).toFixed(1)}k / 200k tokens</span></div>
                        <div className="cost-bar-track"><div className="cost-bar-fill" style={{ width:`${(inputTok/200000)*100}%`, background:"var(--amber)" }}/></div>
                      </div>
                      <div style={{ marginTop:8, fontSize:10, color:"var(--t3)" }}>
                        Tip: /compact сейчас сэкономит ~60% следующих запросов
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {isTyping && (
                <div className="ttyping">
                  <div className="dots"><span/><span/><span/></div>
                  Claude думает ({activeMode.label} mode)...
                </div>
              )}
            </div>

            {/* Input */}
            <div className="input-zone">
              <div className="irow">
                <span className="iprompt">❯</span>
                <input ref={inputRef} className="ifield"
                  value={input} onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKey} autoFocus
                  placeholder={`${activeMode.label} mode · ${activeModel.label} · ${enabledTools.length} tools active`}
                />
                <button className="ibtn-ghost" onClick={() => setHistory([])}>⌘K</button>
                <button className="ibtn" onClick={run}>⏎ RUN</button>
              </div>
            </div>

            {/* Quick commands */}
            <div className="qzone">
              <div className="qtop">
                <span className="qlabel">Quick</span>
                <div className="qtabs">
                  {Object.keys(QUICK_CMDS).map(g => (
                    <button key={g} className={`qtab ${g==="session"?"active":""}`}
                      onClick={e => {
                        e.currentTarget.closest(".qzone").querySelector(".qgrid").replaceChildren();
                      }}>{g}</button>
                  ))}
                </div>
              </div>
              <div className="qgrid">
                {[...QUICK_CMDS.session, ...QUICK_CMDS.code].map(c => (
                  <button key={c.label} className="qbtn" onClick={() => insertCmd(c.cmd)} title={c.cmd}>
                    <span>{c.icon}</span>{c.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Status bar */}
        <div className="statusbar">
          <div className="sitem">
            <div className="sdot sdot-g"/>
            {obsStatus === "connected" ? "Obsidian ✓" : "Obsidian ✗"}
          </div>
          <div className="sitem">
            <div className={`perm-badge perm-${permMode}`}>{permMode}</div>
          </div>
          <div className="sitem" style={{ gap:12 }}>
            <div className="tbar-wrap">
              <div className="tbar-label"><span>ctx</span><span>{(inputTok/1000).toFixed(0)}k</span></div>
              <div className="tbar-track">
                <div className="tbar-fill" style={{
                  width:`${(inputTok/200000)*100}%`,
                  background: inputTok/200000 > 0.7 ? "var(--red)" : "var(--amber)"
                }}/>
              </div>
            </div>
          </div>
          <div className="sitem" style={{ color:"var(--amber)" }}>
            ${sessionCost.toFixed(4)} session
          </div>
          <div className="sitem">
            thinking: <span style={{ color: thinking ? "var(--purple)" : "var(--t3)" }}>{thinking ? "ON" : "off"}</span>
          </div>
          <div className="sspacer"/>
          <div className="sitem skbd"><kbd>↑↓</kbd>&nbsp;hist</div>
          <div className="sitem skbd"><kbd>⌘K</kbd>&nbsp;clear</div>
          <div className="sitem skbd"><kbd>Tab</kbd>&nbsp;thinking</div>
          <div className="sitem skbd"><kbd>⌘P</kbd>&nbsp;mode</div>
        </div>
      </div>
    </>
  );
}
