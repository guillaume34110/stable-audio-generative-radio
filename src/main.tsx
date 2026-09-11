import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { GenerativeRadioPage } from './radio/GenerativeRadioPage'
import './app.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <GenerativeRadioPage />
  </StrictMode>,
)
