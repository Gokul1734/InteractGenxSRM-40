import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { theme, generateCSSVariables } from './theme.js'

// Apply theme CSS variables at runtime (matte neutral dark theme by default)
const themeStyleTagId = 'app-theme-vars'
let themeStyleEl = document.getElementById(themeStyleTagId)
if (!themeStyleEl) {
  themeStyleEl = document.createElement('style')
  themeStyleEl.id = themeStyleTagId
  document.head.appendChild(themeStyleEl)
}
themeStyleEl.textContent = generateCSSVariables(theme)

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
