interface Props { onFileSelect: (path: string) => void }
export default function Sidebar({ onFileSelect: _onFileSelect }: Props) {
  return <div data-testid="sidebar" style={{width:'var(--sidebar-width)',background:'var(--p1)',borderRight:'1px solid var(--b1)',flexShrink:0}}>Sidebar</div>
}
