import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router';
import { AvatarUpgrade } from './features/identity';
import { PhoneGate } from './features/phone-gate';
import { NotFoundPage } from './routes/not-found/NotFoundPage';
import { RoomPage } from './routes/room/RoomPage';

const queryClient = new QueryClient();

/** The React app, mounted on src/pages/app.astro. Routes here must match src/app-routes.ts. */
export function App() {
  return (
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <AvatarUpgrade />
        <PhoneGate>
          <BrowserRouter>
            <Routes>
              <Route path="/r/:code" element={<RoomPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </BrowserRouter>
        </PhoneGate>
      </QueryClientProvider>
    </StrictMode>
  );
}
