import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { PhoneGate } from './features/phone-gate';
import { LobbyPage } from './routes/lobby/LobbyPage';
import { NotFoundPage } from './routes/not-found/NotFoundPage';
import { RoomPage } from './routes/room/RoomPage';

const queryClient = new QueryClient();

/** The React app, mounted on src/pages/app.astro. Routes here must match src/app-routes.ts. */
export function App() {
  return (
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <PhoneGate>
          <BrowserRouter>
            <Routes>
              <Route path="/play" element={<LobbyPage />} />
              <Route path="/r/:code" element={<RoomPage />} />
              <Route path="/app" element={<Navigate to="/play" replace />} />
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </BrowserRouter>
        </PhoneGate>
      </QueryClientProvider>
    </StrictMode>
  );
}
