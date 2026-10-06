import { loadEnv } from 'vite';
import { createRoomService, roomMiddleware } from './server/rooms.mjs';
import { createTurnProvider } from './server/turn.mjs';
import { makeLoginHandler } from './api/password-login.mjs';
// Local rooms run alongside Vite. Static-only hosting does not provide this API.
const allowedHosts = ['log-classroom-perfect-fly.trycloudflare.com', '.trycloudflare.com'];
export default ({ mode }) => {
  // Server-only credentials: never prefix these with VITE_ or expose them via define.
  const env = loadEnv(mode, process.cwd(), 'TURN_');
  const login = makeLoginHandler({env:loadEnv(mode, process.cwd(), '')});
  const loginPlugin = {name:'together-login', configureServer(server) { server.middlewares.use('/api/password-login', async(req,res)=>{
    try { let body=''; for await(const chunk of req){body+=chunk;if(body.length>16384){res.statusCode=413;res.end();return;}}
      req.body=body?JSON.parse(body):{};
      res.status=code=>{res.statusCode=code;return res;};res.json=value=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(value));return res;};
      await login(req,res);
    }catch{res.statusCode=400;res.end('{"message":"Invalid request"}');}
  });}};
  const middleware = () => roomMiddleware(createRoomService({ rtcConfig: createTurnProvider({ env }) }));
  return { server: { allowedHosts }, preview: { allowedHosts }, plugins: [loginPlugin, { name: 'together-rooms', configureServer(server) { server.middlewares.use(middleware()); }, configurePreviewServer(server) { server.middlewares.use(middleware()); } }] };
};
