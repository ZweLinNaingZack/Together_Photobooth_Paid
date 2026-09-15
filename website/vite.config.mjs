import { loadEnv } from 'vite';
import { createRoomService, roomMiddleware } from './server/rooms.mjs';
import { createTurnProvider } from './server/turn.mjs';
// Local rooms run alongside Vite. Static-only hosting does not provide this API.
const allowedHosts = ['chevy-visitor-stomach-drinking.trycloudflare.com', '.trycloudflare.com'];
export default ({ mode }) => {
  // Server-only credentials: never prefix these with VITE_ or expose them via define.
  const env = loadEnv(mode, process.cwd(), 'TURN_');
  const middleware = () => roomMiddleware(createRoomService({ rtcConfig: createTurnProvider({ env }) }));
  return { server: { allowedHosts }, preview: { allowedHosts }, plugins: [{ name: 'together-rooms', configureServer(server) { server.middlewares.use(middleware()); }, configurePreviewServer(server) { server.middlewares.use(middleware()); } }] };
};
