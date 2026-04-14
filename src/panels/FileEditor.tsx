interface Props { filePath: string; onClose: () => void }
export default function FileEditor({ filePath, onClose }: Props) {
  return <div data-testid="file-editor" style={{width:'var(--right-panel-width)',background:'var(--p1)',borderLeft:'1px solid var(--b1)',flexShrink:0}}>
    <button onClick={onClose}>&#x2715;</button>
    <div>{filePath}</div>
  </div>
}
