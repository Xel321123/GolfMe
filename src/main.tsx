import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles/index.css'

/**
 * Application bootstrap. Mounts the React tree into the DOM root element
 * declared in index.html.
 */
const rootElement = document.getElementById('root')

if (rootElement === null) {
  throw new Error('Fatal: #root element not found — the app cannot mount.')
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>
)
