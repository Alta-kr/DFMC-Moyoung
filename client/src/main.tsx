import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'

// Keep the legacy interceptor and its automatic seeding out of the isolated Auth preview.
async function bootstrap() {
  const Component = import.meta.env.DEV && import.meta.env.MODE === 'auth-preview'
    ? (await import('./pages/EmailAuthPage')).default
    : await (async () => {
        await import('./firebase/setupFirebase');
        return (await import('./App')).default;
      })();
  createRoot(document.getElementById('root')!).render(<StrictMode><Component /></StrictMode>);
}
void bootstrap();
