export const QUICK_COMMANDS_UPDATED = 'claude-terminal:quick-commands-updated'

export function notifyQuickCommandsUpdated(): void {
  window.dispatchEvent(new Event(QUICK_COMMANDS_UPDATED))
}
