# BUGS.md — claude-terminal

> Живой трекер известных проблем. Обновляется после каждой сессии.
> Последнее обновление: 2026-04-15 (сессия 4)

---

## КРИТИЧЕСКИЕ

| # | Файл | Строка | Описание | Статус |
|---|---|---|---|---|
| C-1 | `src/components/QuickCommands.tsx` | 5-24 | **Неправильный формат команд** — используются `/review`, `/fix` и т.д., которых нет в Claude CLI. SPEC требует `claude "Review this code..."` | FIXED |
| C-2 | `src/components/sidebar/ObsidianPanel.tsx` | 18 | **Неправильный порт Obsidian** — `DEFAULT_PORT = 27123`, SPEC требует `22360` | FIXED |
| C-3 | `src/components/sidebar/ObsidianPanel.tsx` | — | **SSE протокол не реализован** — используется обычный HTTP fetch, SPEC требует HTTP/SSE (`2024-11-05`) | FIXED — переписан на MCP SSE клиент |

---

## БАГИ В ЛОГИКЕ

| # | Файл | Строка | Описание | Статус |
|---|---|---|---|---|
| B-1 | `electron/ipc/config.ts` | 5 | `app.getPath('home')` вызывался на уровне модуля до `app.whenReady()` — крэш при инициализации. **ИСПРАВЛЕНО** заменой на `os.homedir()` (commit 1737b36) | FIXED |
| B-2 | `src/components/TerminalPane.tsx` | 108,133 | **Race condition при размонтировании** — `spawnPty()` возвращает `Promise<cleanup>`, cleanup вызывает `.then()` в React-деструкторе. Если компонент размонтируется раньше resolve — слушатели `pty:data`/`pty:exit` не отписываются, утечка памяти | FIXED — `alive` flag |
| B-9 | `src/components/TerminalPane.tsx` | — | **Scroll колесо мыши писало историю команд** — wheel события уходили в PTY как ESC[A/B, bash интерпретировал как ↑↓. Клик не фокусировал xterm → мышь не работала. Root cause: listener в bubble phase, xterm-viewport обрабатывал событие первым. **ИСПРАВЛЕНО** `capture:true` (должно держаться) | FIXED |
| B-11 | `src/components/TerminalPane.tsx` | — | **Trackpad scroll не работал** — `term.scrollLines()` не вызывает визуальный ре-рендер в Electron/macOS. Root fix: напрямую двигаем `.xterm-viewport.scrollTop` — xterm слушает `scroll` event на своём viewport и сам обновляет ydisp + canvas. Дополнительно: флаг `userScrolledUp` предотвращает сброс скролла при новых данных из PTY. | FIXED (сессия 4) |
| B-3 | `electron/ipc/sftp.ts` | 103 | **Upload Promise зависает** — счётчик `done` инкрементируется только в `ws.on('close')`. Если SSH-стрим закрывается с ошибкой без события `close` — Promise остаётся pending навсегда | FIXED — `settle()` one-shot |
| B-4 | `electron/ipc/ssh.ts` | 6 | `JSON.parse` без try-catch — крэш IPC handler если `sessions.json` повреждён | FIXED (также sftp.ts) |
| B-10 | `electron/ipc/sftp.ts` + `SSHPanel.tsx` | 45, handleImport | **`sftp:list` → Invalid session ID** — две причины: (1) UUID_RE отклонял legacy IDs (до commit 7869ca4); (2) импортированные сессии не сохранялись в sessions.json. **ИСПРАВЛЕНО** (commit 75728bb) | FIXED |
| B-5 | `src/components/StatusBar.tsx` | 14-16 | **Неверный расчёт context** — считается `(inputTokens + outputTokens) / 200000`. SPEC требует только `inputTokens` для context usage | FIXED |
| B-6 | `electron/ipc/sftp.ts` | 99 | `fs.statSync(lp)` без try-catch — крэш если файл удалён между проверкой и загрузкой | FIXED — внутри `settle()` |
| B-7 | `src/components/Settings.tsx` | 28 | **Накопление Escape-listener** — `window.addEventListener('keydown')` добавляется при каждом изменении `onClose`, старый не удаляется корректно. Множественные вызовы onClose | FIXED — `useRef` + empty deps |
| B-8 | `src/components/sidebar/SSHPanel.tsx` | 145-149 | **Regex validation отрезает IPv6 и некоторые валидные хосты** — паттерн `/^[a-zA-Z0-9._-]+$/` не поддерживает `::1`, `[::1]` | FIXED (SSHPanel + ssh.ts + RFC 2732 bracket) |

---

## UX/UI РАСХОЖДЕНИЯ СО SPEC

| # | Компонент | Файл | Строка | Описание | Статус |
|---|---|---|---|---|---|
| U-1 | Terminal | `TerminalPane.tsx` | 122 | **Cmd+F использует `window.prompt()`** — должен быть встроенный SearchAddon UI, не браузерный диалог | FIXED — inline search overlay |
| U-2 | Terminal | `TerminalPane.tsx` | — | **Cmd+K (clear terminal) не реализован** — SPEC п. 9.2 требует | FIXED |
| U-3 | Terminal | `TerminalPane.tsx` | 69-73 | `cwd` захардкожен как `'~'` — должна передаваться реальная рабочая директория сессии | FIXED |
| U-4 | FilesPanel | `sidebar/FilesPanel.tsx` | 335-371 | **Right-click сразу выполняет "Explain"** — должно быть контекстное меню: Open / Rename / Delete / Copy path / Ask Claude | FIXED |
| U-5 | FilesPanel | `sidebar/FilesPanel.tsx` | — | **`.gitignore` parsing не реализован** — игнорируются только захардкоженные паттерны, SPEC требует парсинг `.gitignore` | FIXED |
| U-6 | ToolsPanel | `sidebar/ToolsPanel.tsx` | 58-60 | **Risk indicators — текст вместо цветных dots** — SPEC требует визуальные кружки (none/low/med/high) | FIXED |
| U-7 | ToolsPanel | `sidebar/ToolsPanel.tsx` | — | **Permissions mode badge не отображается** — SPEC требует AUTO / MANUAL / YOLO badge | FIXED |
| U-8 | MemoryPanel | `sidebar/MemoryPanel.tsx` | — | **Нет "Estimated remaining turns"** — SPEC 5.4 требует расчёт оставшихся turns до исчерпания контекста | FIXED |
| U-9 | MemoryPanel | `sidebar/MemoryPanel.tsx` | — | **Отсутствуют кнопки "Edit global memory", "Edit project memory", "New custom command"** — SPEC 5.4 | FIXED |
| U-10 | StatusBar | `StatusBar.tsx` | — | **Нет баннера "⚠ Compact recommended"** — должен появляться при context > 70% или cost > $0.50 | FIXED |
| U-11 | SSHPanel | `sidebar/SSHPanel.tsx` | — | **Right-click context menu отсутствует** — есть только hover-кнопки, SPEC требует контекстное меню | FIXED |
| U-12 | SSHPanel | `sidebar/SSHPanel.tsx` | — | **Drag-to-reorder внутри группы не реализован** | OPEN |
| U-13 | QuickCommands | `QuickCommands.tsx` | — | **Нет customization** — add/edit/delete команд, хранение в `quick-commands.json` | OPEN |
| U-14 | Settings | `Settings.tsx` | — | **Отсутствуют поля**: scrollback, defaultMode, obsidianPort, editor.readOnlyDefault, editor.wordWrap, updates.checkOnLaunch, updates.channel | FIXED (scrollback, obsidianPort, wordWrap, readOnlyDefault) |
| U-15 | TitleBar | `TitleBar.tsx` | 32-34 | Нет статуса активной сессии (connected/idle/error) рядом с именем | FIXED |
| U-16 | Theme | `styles/theme.css` | 30 | `--ui` font — отсутствует `'Rajdhani'` как primary (дизайн-прототип) | FIXED |
| U-17 | FileEditor | `panels/FileEditor.tsx` | 126 | Default width 480px, SPEC требует 360px | FIXED |

---

## MINOR / ТЕХНИЧЕСКИЙ ДОЛГ

| # | Файл | Описание |
|---|---|---|
| T-1 | `TerminalPane.tsx:96-98` | `term.onData` регистрируется после spawn — возможна потеря первых байт при быстром вводе | FIXED |
| T-2 | `TerminalPane.tsx:87` | `term.buffer.active` может быть null при очень быстрых resize | FIXED |
| T-3 | `electron/ipc/sftp.ts:28` | authType=key без keyPath даёт неясную ошибку SSH вместо "Key path not set" | FIXED |
| T-4 | `electron/ipc/fs.ts:21` | `fs.realpathSync` может зависнуть на циклических симлинках | OPEN |
| T-5 | `electron/ipc/pty.ts:39` | `validateCmd` не вызывается для `/bin/zsh` — путь проходит без валидации | FIXED |

---

## КАК РАБОТАТЬ С ЭТИМ ФАЙЛОМ

- При старте новой сессии: **прочитай этот файл первым делом**
- При фиксе бага: меняй статус `OPEN` → `FIXED (commit XXXXXXX)`
- При обнаружении нового бага: добавляй сюда, не держи в голове
- Не закрывай баг пока **не проверил** что исправление реально работает
