import { useState, useRef, useEffect, useCallback } from "react";

const MOCK_FILES = {
  name: "oes-mas",
  type: "dir",
  children: [
    { name: "agents", type: "dir", children: [
      { name: "topology.go", type: "file", content: `package agents\n\nimport "context"\n\n// TopologyAgent builds self-describing\n// mine topology from FMS trip data\ntype TopologyAgent struct {\n    ID       string\n    FMSConn  FMSConnector\n    CHClient ClickHouseClient\n}\n\nfunc (a *TopologyAgent) Run(ctx context.Context) error {\n    trips, err := a.FMSConn.FetchTrips(ctx)\n    if err != nil {\n        return err\n    }\n    return a.CHClient.UpsertTopology(ctx, trips)\n}` },
      { name: "synthesis.go", type: "file", content: `package agents\n\n// SynthesisAgent aggregates all agent\n// outputs into executive briefing\ntype SynthesisAgent struct {\n    LLMClient LLMClient\n    Langfuse  LangfuseTracer\n}\n\nfunc (a *SynthesisAgent) Synthesize(inputs []AgentOutput) (*Briefing, error) {\n    // Build prompt from structured outputs\n    prompt := buildSynthesisPrompt(inputs)\n    return a.LLMClient.Complete(prompt)\n}` },
    ]},
    { name: "infra", type: "dir", children: [
      { name: "config.yaml", type: "file", content: `server:\n  host: 0.0.0.0\n  port: 8080\n\nclickhouse:\n  host: ch.internal\n  port: 9000\n  db: oes_mas\n\nllm:\n  provider: litellm\n  endpoint: http://llmsrv:4000\n  model: claude-sonnet-4\n\nlangfuse:\n  enabled: true\n  endpoint: http://langfuse.internal` },
      { name: "docker-compose.yml", type: "file", content: `version: "3.9"\n\nservices:\n  api:\n    build: .\n    ports:\n      - "8080:8080"\n    env_file: .env\n    depends_on:\n      - clickhouse\n\n  clickhouse:\n    image: clickhouse/clickhouse-server:23.8\n    volumes:\n      - ch_data:/var/lib/clickhouse\n\nvolumes:\n  ch_data:` },
    ]},
    { name: "prompts", type: "dir", children: [
      { name: "ceo_twin.md", type: "file", content: `# CEO Digital Twin — VGK\n\nYou are a digital twin of the General Director of VGK.\nYou speak in the style derived from meeting transcripts.\n\n## Persona\n- Data-driven, concise\n- Focuses on production KPIs\n- Expects structured briefings\n\n## Output Format\nAlways respond with:\n1. Situation summary (2-3 sentences)\n2. Key metrics delta\n3. Recommended action` },
    ]},
    { name: "README.md", type: "file", content: `# OES.MAS — Multi-Agent System\n\nReal-time mining operations intelligence.\n\n## Architecture\n\nLangGraph 4-level agent hierarchy:\n- Topology → Transfer → TOC → Synthesis\n\n## Stack\n\n- Go 1.22 + Python 3.11\n- ClickHouse 23.8\n- LiteLLM Proxy\n- Langfuse observability\n- Galileosky/Wialon FMS` },
    { name: "go.mod", type: "file", content: `module github.com/petrovich-opendev/oes-mas\n\ngo 1.22\n\nrequire (\n    github.com/langchain-ai/langchaingo v0.1.12\n    github.com/ClickHouse/clickhouse-go/v2 v2.23.2\n)` },
  ]
};

const QUICK_COMMANDS = [
  { label: "Start", cmd: "claude", icon: "⚡", group: "session" },
  { label: "Continue", cmd: "claude --continue", icon: "▶", group: "session" },
  { label: "Resume", cmd: "claude --resume", icon: "⏮", group: "session" },
  { label: "Review", cmd: 'claude "Review this code and find potential issues"', icon: "🔍", group: "task" },
  { label: "Fix bugs", cmd: 'claude "Find and fix all bugs in this file"', icon: "🐛", group: "task" },
  { label: "Tests", cmd: 'claude "Write comprehensive unit tests"', icon: "✓", group: "task" },
  { label: "Refactor", cmd: 'claude "Refactor for readability and performance"', icon: "♻", group: "task" },
  { label: "Explain", cmd: 'claude "Explain what this code does"', icon: "💡", group: "task" },
  { label: "Commit", cmd: 'claude "Create a conventional commit message for staged changes"', icon: "📦", group: "git" },
  { label: "PR Draft", cmd: 'claude "Draft a PR description for these changes"', icon: "🔀", group: "git" },
];

const INITIAL_HISTORY = [
  { type: "cmd", text: "claude --version" },
  { type: "out", text: "Claude Code 1.2.3\nClaude: claude-sonnet-4" },
  { type: "cmd", text: "claude" },
  { type: "banner", text: `  ██████╗██╗      █████╗ ██╗   ██╗██████╗ ███████╗
 ██╔════╝██║     ██╔══██╗██║   ██║██╔══██╗██╔════╝
 ██║     ██║     ███████║██║   ██║██║  ██║█████╗
 ██║     ██║     ██╔══██║██║   ██║██║  ██║██╔══╝
 ╚██████╗███████╗██║  ██║╚██████╔╝██████╔╝███████╗
  ╚═════╝╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚═════╝ ╚══════╝

  Project : oes-mas         Model  : claude-sonnet-4
  Files   : 7 indexed       Tokens : 18.4k / 200k
  Server  : llmsrv          Status : ✓ Ready` },
  { type: "out", text: "How can I help you with the project?" },
  { type: "cmd", text: 'claude "Explain the topology agent architecture"' },
  { type: "out", text: `The TopologyAgent is the first level of your 4-level LangGraph hierarchy.

It works by:
1. Fetching raw FMS truck trip data (Galileosky/Wialon)
2. Deriving mine topology graph from trip patterns
3. Upserting the topology into ClickHouse

This "self-describing topology" approach means you don't need\nmanual configuration — the system learns routes and zones\nautomatically from vehicle movement data.

Next step: the TransferAgent uses this topology to calculate\nmaterial flow volumes between nodes.` },
];

const FILE_ICONS = { go: "🔷", md: "📄", yaml: "⚙️", yml: "⚙️", mod: "📦", json: "🔶", ts: "🔹", js: "🟡", py: "🐍", sh: "⬛" };

export default function ClaudeTerminal() {
  const [input, setInput] = useState("");
  const [history, setHistory] = useState(INITIAL_HISTORY);
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileContent, setFileContent] = useState("");
  const [fileName, setFileName] = useState("");
  const [expandedDirs, setExpandedDirs] = useState(new Set(["oes-mas", "agents", "infra"]));
  const [cmdHistory, setCmdHistory] = useState([]);
  const [cmdHistoryIndex, setCmdHistoryIndex] = useState(-1);
  const [editorOpen, setEditorOpen] = useState(false);
  const [activeGroup, setActiveGroup] = useState("all");
  const [sidebarWidth] = useState(220);
  const [editorWidth] = useState(360);
  const [isTyping, setIsTyping] = useState(false);

  const inputRef = useRef(null);
  const terminalRef = useRef(null);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [history]);

  const executeCommand = useCallback(() => {
    if (!input.trim()) return;
    setHistory(prev => [...prev, { type: "cmd", text: input }]);
    setCmdHistory(prev => [input, ...prev.slice(0, 49)]);
    setCmdHistoryIndex(-1);
    const cmd = input;
    setInput("");
    setIsTyping(true);
    setTimeout(() => {
      setIsTyping(false);
      setHistory(prev => [...prev, {
        type: "out",
        text: `Processing: ${cmd}\n\n[Claude Code response would appear here in the real terminal]`
      }]);
    }, 800);
  }, [input]);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      executeCommand();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const newIdx = Math.min(cmdHistoryIndex + 1, cmdHistory.length - 1);
      if (newIdx >= 0) {
        setCmdHistoryIndex(newIdx);
        setInput(cmdHistory[newIdx]);
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      const newIdx = cmdHistoryIndex - 1;
      setCmdHistoryIndex(Math.max(newIdx, -1));
      setInput(newIdx < 0 ? "" : cmdHistory[newIdx]);
    }
  };

  const openFile = (file) => {
    setFileName(file.name);
    setFileContent(file.content);
    setSelectedFile(file.name);
    setEditorOpen(true);
  };

  const toggleDir = (name) => {
    setExpandedDirs(prev => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  };

  const insertQuickCmd = (cmd) => {
    setInput(cmd);
    inputRef.current?.focus();
  };

  const renderTree = (node, depth = 0) => {
    if (node.type === "dir") {
      const exp = expandedDirs.has(node.name);
      return (
        <div key={node.name}>
          <div className={`tree-item ${depth === 0 ? "tree-root" : ""}`}
            style={{ paddingLeft: depth * 14 + 10 }}
            onClick={() => toggleDir(node.name)}>
            <span className="tree-arrow">{exp ? "▾" : "▸"}</span>
            <span className="tree-folder-icon">📁</span>
            <span className="tree-name">{node.name}</span>
          </div>
          {exp && node.children?.map(child => renderTree(child, depth + 1))}
        </div>
      );
    }
    const ext = node.name.split(".").pop();
    const icon = FILE_ICONS[ext] || "📄";
    return (
      <div key={node.name}
        className={`tree-item tree-file ${selectedFile === node.name ? "tree-selected" : ""}`}
        style={{ paddingLeft: depth * 14 + 10 }}
        onClick={() => openFile(node)}>
        <span className="tree-arrow"> </span>
        <span className="tree-folder-icon">{icon}</span>
        <span className="tree-name">{node.name}</span>
      </div>
    );
  };

  const filteredCmds = activeGroup === "all" ? QUICK_COMMANDS : QUICK_COMMANDS.filter(c => c.group === activeGroup);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:ital,wght@0,300;0,400;0,500;0,600;1,400&family=Rajdhani:wght@500;600;700&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        :root {
          --bg:        #09090b;
          --panel:     #0f0f12;
          --panel2:    #131318;
          --panel3:    #17171d;
          --border:    #1f1f28;
          --border2:   #2a2a38;
          --amber:     #f59e0b;
          --amber-lo:  rgba(245,158,11,0.08);
          --amber-mid: rgba(245,158,11,0.15);
          --green:     #22c55e;
          --green-lo:  rgba(34,197,94,0.12);
          --red:       #ef4444;
          --blue:      #60a5fa;
          --purple:    #a78bfa;
          --text:      #a1a1aa;
          --text2:     #71717a;
          --text-hi:   #e4e4e7;
          --text-top:  #fafafa;
          --mono: 'JetBrains Mono', monospace;
          --ui: 'Rajdhani', sans-serif;
        }

        body { background: var(--bg); color: var(--text); font-family: var(--mono); }

        .app {
          display: flex; flex-direction: column;
          height: 100vh; overflow: hidden;
          background: var(--bg);
          font-size: 13px;
        }

        /* ── Titlebar ── */
        .titlebar {
          height: 40px; min-height: 40px;
          display: flex; align-items: center;
          background: var(--panel);
          border-bottom: 1px solid var(--border);
          padding: 0 16px; gap: 14px;
          user-select: none;
        }
        .tlights { display: flex; gap: 7px; align-items: center; }
        .tl { width: 12px; height: 12px; border-radius: 50%; cursor: pointer; transition: filter .15s; }
        .tl:hover { filter: brightness(1.3); }
        .tl-r { background: #ff5f57; }
        .tl-y { background: #febc2e; }
        .tl-g { background: #28c840; }

        .title-center {
          flex: 1; display: flex; justify-content: center; align-items: center; gap: 10px;
        }
        .title-name {
          font-family: var(--ui); font-weight: 700; font-size: 14px;
          letter-spacing: 3px; color: var(--amber); text-transform: uppercase;
        }
        .title-sep { color: var(--border2); }
        .title-meta { font-size: 11px; color: var(--text2); letter-spacing: 0.5px; }
        .title-badge {
          font-family: var(--ui); font-size: 10px; font-weight: 600;
          letter-spacing: 1.5px; padding: 2px 7px;
          background: var(--amber-lo); border: 1px solid rgba(245,158,11,0.3);
          border-radius: 3px; color: var(--amber); text-transform: uppercase;
        }

        /* ── Main layout ── */
        .main { display: flex; flex: 1; overflow: hidden; }

        /* ── Sidebar ── */
        .sidebar {
          width: 220px; min-width: 180px;
          display: flex; flex-direction: column;
          background: var(--panel); border-right: 1px solid var(--border);
          overflow: hidden;
        }
        .panel-hdr {
          padding: 9px 12px;
          display: flex; align-items: center; justify-content: space-between;
          border-bottom: 1px solid var(--border);
        }
        .panel-hdr-label {
          font-family: var(--ui); font-weight: 600; font-size: 10px;
          letter-spacing: 2.5px; text-transform: uppercase; color: var(--text2);
        }
        .panel-hdr-badge {
          font-size: 9px; color: var(--text2);
          background: var(--panel2); border: 1px solid var(--border2);
          border-radius: 3px; padding: 1px 5px;
        }

        .file-tree { flex: 1; overflow-y: auto; padding: 4px 0; }
        .file-tree::-webkit-scrollbar { width: 3px; }
        .file-tree::-webkit-scrollbar-thumb { background: var(--border2); border-radius: 2px; }

        .tree-item {
          display: flex; align-items: center; gap: 4px;
          padding: 4px 10px; cursor: pointer; transition: background .1s;
          white-space: nowrap; overflow: hidden;
        }
        .tree-item:hover { background: var(--amber-lo); }
        .tree-root > .tree-name { color: var(--text-hi); font-weight: 500; }
        .tree-file:hover .tree-name { color: var(--text-hi); }
        .tree-selected { background: var(--amber-mid) !important; }
        .tree-selected .tree-name { color: var(--amber) !important; }
        .tree-arrow { width: 10px; font-size: 9px; color: var(--text2); flex-shrink: 0; }
        .tree-folder-icon { font-size: 11px; flex-shrink: 0; }
        .tree-name { font-size: 12px; color: var(--text); overflow: hidden; text-overflow: ellipsis; }

        /* ── Terminal ── */
        .terminal-wrap {
          flex: 1; display: flex; flex-direction: column; overflow: hidden;
          background: var(--bg);
        }

        .term-out-area {
          flex: 1; overflow-y: auto; padding: 14px 20px 8px;
          font-size: 12.5px; line-height: 1.65;
        }
        .term-out-area::-webkit-scrollbar { width: 4px; }
        .term-out-area::-webkit-scrollbar-thumb { background: var(--border2); border-radius: 2px; }

        .term-entry { margin-bottom: 8px; }

        .term-cmd-row {
          display: flex; align-items: flex-start; gap: 8px;
          color: var(--amber);
        }
        .term-prompt { color: var(--green); flex-shrink: 0; font-size: 13px; line-height: 1.65; }
        .term-cmd-text { color: var(--text-hi); }
        .term-out-text {
          white-space: pre; overflow-x: auto;
          color: var(--text);
          margin-top: 2px;
          padding: 6px 10px;
          border-left: 2px solid var(--border2);
          font-size: 12px;
          line-height: 1.6;
        }
        .term-banner {
          white-space: pre;
          font-size: 9.5px;
          line-height: 1.4;
          color: var(--amber);
          opacity: 0.65;
          padding: 4px 0 4px 0;
          overflow-x: auto;
        }
        .term-typing {
          display: flex; align-items: center; gap: 6px;
          color: var(--text2); font-size: 11px; padding: 4px 0;
        }
        .typing-dots span {
          display: inline-block; width: 4px; height: 4px; border-radius: 50%;
          background: var(--amber); margin: 0 1px;
          animation: bounce 1.2s infinite;
        }
        .typing-dots span:nth-child(2) { animation-delay: .2s; }
        .typing-dots span:nth-child(3) { animation-delay: .4s; }
        @keyframes bounce {
          0%,60%,100% { transform: translateY(0); opacity: .5; }
          30% { transform: translateY(-4px); opacity: 1; }
        }

        /* ── Input zone ── */
        .input-zone {
          border-top: 1px solid var(--border);
          background: var(--panel);
        }
        .input-row {
          display: flex; align-items: center; gap: 8px;
          padding: 10px 14px;
        }
        .input-prompt-label {
          color: var(--green); font-size: 14px; flex-shrink: 0; line-height: 1;
        }
        .input-field {
          flex: 1; background: transparent; border: none; outline: none;
          color: var(--text-top); font-family: var(--mono); font-size: 13px;
          caret-color: var(--amber); line-height: 1.5;
        }
        .input-field::placeholder { color: var(--text2); }
        .input-actions { display: flex; gap: 6px; flex-shrink: 0; }
        .btn-run {
          background: var(--amber); border: none; border-radius: 5px;
          color: #000; font-family: var(--ui); font-weight: 700; font-size: 12px;
          letter-spacing: 1px; padding: 5px 12px; cursor: pointer;
          transition: opacity .15s, transform .1s;
        }
        .btn-run:hover { opacity: .88; }
        .btn-run:active { transform: scale(.97); }
        .btn-clear {
          background: transparent; border: 1px solid var(--border2);
          border-radius: 5px; color: var(--text2); font-family: var(--mono);
          font-size: 11px; padding: 5px 10px; cursor: pointer; transition: all .15s;
        }
        .btn-clear:hover { border-color: var(--red); color: var(--red); }

        /* ── Quick commands ── */
        .quick-zone {
          border-top: 1px solid var(--border);
          background: var(--panel2);
          padding: 8px 14px 10px;
        }
        .quick-top {
          display: flex; align-items: center; gap: 10px; margin-bottom: 7px;
        }
        .quick-hdr {
          font-family: var(--ui); font-weight: 600; font-size: 9px;
          letter-spacing: 2px; text-transform: uppercase; color: var(--text2);
        }
        .quick-groups { display: flex; gap: 4px; }
        .qg-btn {
          background: transparent; border: 1px solid var(--border);
          border-radius: 3px; color: var(--text2);
          font-family: var(--mono); font-size: 10px;
          padding: 2px 7px; cursor: pointer; transition: all .1s;
        }
        .qg-btn:hover, .qg-btn.active {
          border-color: var(--amber); color: var(--amber);
          background: var(--amber-lo);
        }
        .quick-grid { display: flex; gap: 5px; flex-wrap: wrap; }
        .qcmd {
          background: transparent; border: 1px solid var(--border);
          border-radius: 4px; color: var(--text);
          font-family: var(--mono); font-size: 11px;
          padding: 4px 10px; cursor: pointer; transition: all .12s;
          display: flex; align-items: center; gap: 5px;
        }
        .qcmd:hover {
          border-color: var(--amber); color: var(--amber);
          background: var(--amber-lo);
          transform: translateY(-1px);
        }
        .qcmd:active { transform: translateY(0); }
        .qcmd-icon { font-size: 10px; }

        /* ── Editor panel ── */
        .editor-panel {
          width: 360px; min-width: 280px;
          display: flex; flex-direction: column;
          background: var(--panel); border-left: 1px solid var(--border);
          overflow: hidden;
        }
        .editor-hdr {
          display: flex; align-items: center;
          padding: 9px 12px; border-bottom: 1px solid var(--border);
          gap: 8px;
        }
        .editor-icon { font-size: 13px; }
        .editor-fname {
          flex: 1; font-size: 12px; color: var(--amber);
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .editor-actions-top { display: flex; gap: 4px; }
        .e-btn-top {
          background: transparent; border: 1px solid var(--border2);
          border-radius: 3px; color: var(--text2);
          font-size: 9px; padding: 2px 7px; cursor: pointer;
          font-family: var(--mono); transition: all .1s;
          text-transform: uppercase; letter-spacing: .5px;
        }
        .e-btn-top:hover { border-color: var(--amber); color: var(--amber); }
        .e-btn-close:hover { border-color: var(--red); color: var(--red); }

        .editor-lines {
          flex: 1; display: flex; overflow: hidden;
        }
        .line-nums {
          padding: 12px 10px 12px 8px; background: var(--panel2);
          border-right: 1px solid var(--border);
          font-size: 11px; line-height: 1.7; color: var(--text2);
          user-select: none; text-align: right; min-width: 36px;
          overflow: hidden;
        }
        .editor-ta {
          flex: 1; background: transparent; border: none; outline: none;
          color: var(--text-hi); font-family: var(--mono); font-size: 12px;
          line-height: 1.7; padding: 12px; resize: none;
          caret-color: var(--amber); overflow-y: auto;
        }
        .editor-ta::-webkit-scrollbar { width: 3px; }
        .editor-ta::-webkit-scrollbar-thumb { background: var(--border2); }

        .editor-footer {
          padding: 8px 12px; border-top: 1px solid var(--border);
          display: flex; gap: 6px; align-items: center;
        }
        .e-btn {
          background: transparent; border: 1px solid var(--border2);
          border-radius: 4px; color: var(--text);
          font-family: var(--mono); font-size: 11px;
          padding: 5px 12px; cursor: pointer; transition: all .12s;
        }
        .e-btn:hover { border-color: var(--purple); color: var(--purple); }
        .e-btn-save {
          background: var(--amber); border: none; border-radius: 4px;
          color: #000; font-family: var(--ui); font-weight: 700; font-size: 11px;
          letter-spacing: .5px; padding: 5px 14px; cursor: pointer; transition: opacity .15s;
          margin-left: auto;
        }
        .e-btn-save:hover { opacity: .87; }
        .e-info { font-size: 10px; color: var(--text2); margin-right: auto; }

        /* ── Status bar ── */
        .statusbar {
          height: 22px; min-height: 22px;
          display: flex; align-items: center;
          background: var(--panel); border-top: 1px solid var(--border);
          padding: 0 14px; gap: 18px;
        }
        .s-item { display: flex; align-items: center; gap: 5px; font-size: 10px; color: var(--text2); }
        .s-dot { width: 5px; height: 5px; border-radius: 50%; }
        .s-dot-green { background: var(--green); box-shadow: 0 0 4px var(--green); }
        .s-dot-amber { background: var(--amber); }
        .s-spacer { flex: 1; }
        .s-kbd {
          font-size: 9px; color: var(--text2);
          display: flex; align-items: center; gap: 3px;
        }
        .s-kbd kbd {
          background: var(--panel2); border: 1px solid var(--border2);
          border-radius: 2px; padding: 0 4px;
          font-family: var(--mono); font-size: 9px; color: var(--text);
        }
      `}</style>

      <div className="app">
        {/* Title bar */}
        <div className="titlebar">
          <div className="tlights">
            <div className="tl tl-r" />
            <div className="tl tl-y" />
            <div className="tl tl-g" />
          </div>
          <div className="title-center">
            <span className="title-name">Claude Terminal</span>
            <span className="title-sep">·</span>
            <span className="title-meta">oes-mas</span>
            <span className="title-sep">·</span>
            <span className="title-meta">llmsrv</span>
          </div>
          <div className="title-badge">claude-sonnet-4</div>
        </div>

        <div className="main">
          {/* Sidebar */}
          <div className="sidebar">
            <div className="panel-hdr">
              <span className="panel-hdr-label">Explorer</span>
              <span className="panel-hdr-badge">7 files</span>
            </div>
            <div className="file-tree">
              {renderTree(MOCK_FILES)}
            </div>
          </div>

          {/* Terminal */}
          <div className="terminal-wrap">
            <div className="term-out-area" ref={terminalRef}>
              {history.map((entry, i) => (
                <div className="term-entry" key={i}>
                  {entry.type === "cmd" && (
                    <div className="term-cmd-row">
                      <span className="term-prompt">❯</span>
                      <span className="term-cmd-text">{entry.text}</span>
                    </div>
                  )}
                  {entry.type === "out" && (
                    <div className="term-out-text">{entry.text}</div>
                  )}
                  {entry.type === "banner" && (
                    <div className="term-banner">{entry.text}</div>
                  )}
                </div>
              ))}
              {isTyping && (
                <div className="term-typing">
                  <div className="typing-dots"><span/><span/><span/></div>
                  Claude is thinking...
                </div>
              )}
            </div>

            {/* Input zone */}
            <div className="input-zone">
              <div className="input-row">
                <span className="input-prompt-label">❯</span>
                <input
                  ref={inputRef}
                  className="input-field"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type a command or ask Claude... (↑↓ history, ⌘K clear)"
                  autoFocus
                />
                <div className="input-actions">
                  <button className="btn-clear" onClick={() => setHistory([])}>⌘K</button>
                  <button className="btn-run" onClick={executeCommand}>⏎ RUN</button>
                </div>
              </div>
            </div>

            {/* Quick commands */}
            <div className="quick-zone">
              <div className="quick-top">
                <span className="quick-hdr">Quick</span>
                <div className="quick-groups">
                  {["all","session","task","git"].map(g => (
                    <button key={g} className={`qg-btn ${activeGroup===g?"active":""}`}
                      onClick={() => setActiveGroup(g)}>{g}</button>
                  ))}
                </div>
              </div>
              <div className="quick-grid">
                {filteredCmds.map(qc => (
                  <button key={qc.label} className="qcmd"
                    onClick={() => insertQuickCmd(qc.cmd)}
                    title={qc.cmd}>
                    <span className="qcmd-icon">{qc.icon}</span>
                    {qc.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Editor panel */}
          {editorOpen && (
            <div className="editor-panel">
              <div className="editor-hdr">
                <span className="editor-fname">{fileName}</span>
                <div className="editor-actions-top">
                  <button className="e-btn-top" onClick={() => {
                    setInput(`claude "In file ${fileName}: "`);
                    inputRef.current?.focus();
                  }}>Ask Claude</button>
                  <button className="e-btn-top e-btn-close" onClick={() => { setEditorOpen(false); setSelectedFile(null); }}>✕</button>
                </div>
              </div>
              <div className="editor-lines">
                <div className="line-nums">
                  {fileContent.split("\n").map((_, i) => (
                    <div key={i}>{i + 1}</div>
                  ))}
                </div>
                <textarea
                  className="editor-ta"
                  value={fileContent}
                  onChange={e => setFileContent(e.target.value)}
                  spellCheck={false}
                />
              </div>
              <div className="editor-footer">
                <span className="e-info">{fileContent.split("\n").length} lines</span>
                <button className="e-btn" onClick={() => {
                  setInput(`claude "Refactor ${fileName} for better readability"`);
                  inputRef.current?.focus();
                }}>Refactor</button>
                <button className="e-btn" onClick={() => {
                  setInput(`claude "Write tests for ${fileName}"`);
                  inputRef.current?.focus();
                }}>Tests</button>
                <button className="e-btn-save">Save</button>
              </div>
            </div>
          )}
        </div>

        {/* Status bar */}
        <div className="statusbar">
          <div className="s-item">
            <div className="s-dot s-dot-green" />
            Connected · llmsrv
          </div>
          <div className="s-item">
            <div className="s-dot s-dot-amber" />
            18.4k / 200k tokens
          </div>
          <div className="s-item">Session: 00:34</div>
          <div className="s-spacer" />
          <div className="s-kbd"><kbd>↑↓</kbd>History</div>
          <div className="s-kbd"><kbd>⌘K</kbd>Clear</div>
          <div className="s-kbd"><kbd>⌘P</kbd>Files</div>
          <div className="s-kbd"><kbd>⌘E</kbd>Editor</div>
        </div>
      </div>
    </>
  );
}
