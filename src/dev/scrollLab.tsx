import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import ScrollLabApp from './ScrollLabApp'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ScrollLabApp />
  </StrictMode>,
)
