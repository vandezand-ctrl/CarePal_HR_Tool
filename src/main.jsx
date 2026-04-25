import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { GoogleOAuthProvider } from '@react-oauth/google'
import App from './App.jsx'
import { AUTH_MODE } from './api.js'

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''

// In Google mode the provider is required by <GoogleLogin>. In mock mode we
// skip it — keeps local dev working without VITE_GOOGLE_CLIENT_ID set.
// eslint-disable-next-line react-refresh/only-export-components -- entrypoint
function Root() {
  if (AUTH_MODE === 'google') {
    if (!GOOGLE_CLIENT_ID) {
      // Fail loud at the boot — silently rendering an unusable login screen
      // would be much more confusing for a deploy that forgot the secret.
      return (
        <div style={{ padding: 24, fontFamily: 'system-ui' }}>
          <h1>Configuration error</h1>
          <p>
            <code>VITE_AUTH_MODE=google</code> requires <code>VITE_GOOGLE_CLIENT_ID</code> to be
            set at build time. See <code>docs/DEPLOY_TO_CLOUD_RUN.md</code>.
          </p>
        </div>
      )
    }
    return (
      <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
        <App />
      </GoogleOAuthProvider>
    )
  }
  return <App />
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
