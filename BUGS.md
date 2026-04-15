# BUGS.md — claude-terminal

> Живой трекер известных проблем. Обновляется после каждой сессии.
> Последнее обновление: 2026-04-15

---

## КРИТИЧЕСКИЕ

| # | Файл | Строка | Описание | Статус |
|---|---|---|---|---|
| C-1 | `src/components/QuickCommands.tsx` | 5-24 | **Неправильный формат команд** — используются `/review`, `/fix` и т.д., которых нет в Claude CLI. SPEC требует `claude "Review this code..."` | OPEN |
| C-2 | `src/components/sidebar/ObsidianPanel.tsx` | 18 | **Неправильный порт Obsidian** — `DEFAULT_PORT = 27123`, SPEC требует `22360` | OPEN |
| C-3 | `src/components/sidebar/ObsidianPanel.tsx` | — | **SSE протокол не реализован** — используется обычный HTTP fetch, SPEC требует HTTP/SSE (`2024-11-05`) | OPEN |

---

## БАГИ В ЛОГИКЕ

| # | Файл | Строка | Описание | Статус |
|---|---|---|---|---|
| B-1 | `electron/ipc/config.ts` | 5 | `app.getPath('home')` вызывался на уровне модуля до `app.whenReady()` — крэш при инициализации. **ИСПРАВЛЕНО** заменой на `os.homedir()` (commit 1737b36) | FIXED |
| B-2 | `src/components/TerminalPane.tsx` | 108,133 | **Race condition при размонтировании** — `spawnPty()` возвращает `Promise<cleanup>`, cleanup вызывает `.then()` в React-деструкторе. Если компонент размонтируется раньше resolve — слушатели `pty:data`/`pty:exit` не отписываются, утечка памяти | OPEN |
| B-9 | `src/components/TerminalPane.tsx` | — | **Scroll колесо мыши писало историю команд** — wheel события уходили в PTY как ESC[A/B, bash интерпретировал как ↑↓. Клик не фокусировал xterm → мышь не работала. **ИСПРАВЛЕНО** (commit 0c4fb66) | FIXED |
| B-3 | `electron/ipc/sftp.ts` | 103 | **Upload Promise зависает** — счётчик `done` инкрементируется только в `ws.on('close')`. Если SSH-стрим закрывается с ошибкой без события `close` — Promise остаётся pending навсегда | OPEN |
| B-4 | `electron/ipc/ssh.ts` | 6 | `JSON.parse` без try-catch — крэш IPC handler если `sessions.json` повреждён | OPEN |
| B-5 | `src/components/StatusBar.tsx` | 14-16 | **Неверный расчёт context** — считается `(inputTokens + outputTokens) / 200000`. SPEC требует только `inputTokens` для context usage | OPEN |
| B-6 | `electron/ipc/sftp.ts` | 99 | `fs.statSync(lp)` без try-catch — крэш если файл удалён между проверкой и загрузкой | OPEN |
| B-7 | `src/components/Settings.tsx` | 28 | **Накопление Escape-listener** — `window.addEventListener('keydown')` добавляется при каждом изменении `onClose`, старый не удаляется корректно. Множественные вызовы onClose | OPEN |
| B-8 | `src/components/sidebar/SSHPanel.tsx` | 145-149 | **Regex validation отрезает IPv6 и некоторые валидные хосты** — паттерн `/^[a-zA-Z0-9._-]+$/` не поддерживает `::1`, `[::1]` | OPEN |

---

## UX/UI РАСХОЖДЕНИЯ СО SPEC

| # | Компонент | Файл | Строка | Описание | Статус |
|---|---|---|---|---|---|
| U-1 | Terminal | `TerminalPane.tsx` | 122 | **Cmd+F использует `window.prompt()`** — должен быть встроенный SearchAddon UI, не браузерный диалог | OPEN |
| U-2 | Terminal | `TerminalPane.tsx` | — | **Cmd+K (clear terminal) не реализован** — SPEC п. 9.2 требует | OPEN |
| U-3 | Terminal | `TerminalPane.tsx` | 69-73 | `cwd` захардкожен как `'~'` — должна передаваться реальная рабочая директория сессии | OPEN |
| U-4 | FilesPanel | `sidebar/FilesPanel.tsx` | 335-371 | **Right-click сразу выполняет "Explain"** — должно быть контекстное меню: Open / Rename / Delete / Copy path / Ask Claude | OPEN |
| U-5 | FilesPanel | `sidebar/FilesPanel.tsx` | — | **`.gitignore` parsing не реализован** — игнорируются только захардкоженные паттерны, SPEC требует парсинг `.gitignore` | OPEN |
| U-6 | ToolsPanel | `sidebar/ToolsPanel.tsx` | 58-60 | **Risk indicators — текст вместо цветных dots** — SPEC требует визуальные кружки (none/low/med/high) | OPEN |
| U-7 | ToolsPanel | `sidebar/ToolsPanel.tsx` | — | **Permissions mode badge не отображается** — SPEC требует AUTO / MANUAL / YOLO badge | OPEN |
| U-8 | MemoryPanel | `sidebar/MemoryPanel.tsx` | — | **Нет "Estimated remaining turns"** — SPEC 5.4 требует расчёт оставшихся turns до исчерпания контекста | OPEN |
| U-9 | MemoryPanel | `sidebar/MemoryPanel.tsx` | — | **Отсутствуют кнопки "Edit global memory", "Edit project memory", "New custom command"** — SPEC 5.4 | OPEN |
| U-10 | StatusBar | `StatusBar.tsx` | — | **Нет баннера "⚠ Compact recommended"** — должен появляться при context > 70% или cost > $0.50 | OPEN |
| U-11 | SSHPanel | `sidebar/SSHPanel.tsx` | — | **Right-click context menu отсутствует** — есть только hover-кнопки, SPEC требует контекстное меню | OPEN |
| U-12 | SSHPanel | `sidebar/SSHPanel.tsx` | — | **Drag-to-reorder внутри группы не реализован** | OPEN |
| U-13 | QuickCommands | `QuickCommands.tsx` | — | **Нет customization** — add/edit/delete команд, хранение в `quick-commands.json` | OPEN |
| U-14 | Settings | `Settings.tsx` | — | **Отсутствуют поля**: scrollback, defaultMode, obsidianPort, editor.readOnlyDefault, editor.wordWrap, updates.checkOnLaunch, updates.channel | OPEN |
| U-15 | TitleBar | `TitleBar.tsx` | 32-34 | Нет статуса активной сессии (connected/idle/error) рядом с именем | OPEN |
| U-16 | Theme | `styles/theme.css` | 30 | `--ui` font — отсутствует `'Rajdhani'` как primary (дизайн-прототип) | OPEN |
| U-17 | FileEditor | `panels/FileEditor.tsx` | 126 | Default width 480px, SPEC требует 360px | OPEN |

---

## MINOR / ТЕХНИЧЕСКИЙ ДОЛГ

| # | Файл | Описание |
|---|---|---|
| T-1 | `TerminalPane.tsx:96-98` | `term.onData` регистрируется после spawn — возможна потеря первых байт при быстром вводе |
| T-2 | `TerminalPane.tsx:87` | `term.buffer.active` может быть null при очень быстрых resize |
| T-3 | `electron/ipc/sftp.ts:28` | authType=key без keyPath даёт неясную ошибку SSH вместо "Key path not set" |
| T-4 | `electron/ipc/fs.ts:21` | `fs.realpathSync` может зависнуть на циклических симлинках |
| T-5 | `electron/ipc/pty.ts:39` | `validateCmd` не вызывается для `/bin/zsh` — путь проходит без валидации |

---

## КАК РАБОТАТЬ С ЭТИМ ФАЙЛОМ

- При старте новой сессии: **прочитай этот файл первым делом**
- При фиксе бага: меняй статус `OPEN` → `FIXED (commit XXXXXXX)`
- При обнаружении нового бага: добавляй сюда, не держи в голове
- Не закрывай баг пока **не проверил** что исправление реально работает
