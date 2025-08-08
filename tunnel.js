import fs from 'fs';
import path from 'path';
import localtunnel from 'localtunnel';

const PUBLIC_FILE = path.join(process.cwd(), 'public', 'tunnel.txt');

(async () => {
  try {
    const tunnel = await localtunnel({ port: 3000 });
    const url = tunnel.url;
    fs.mkdirSync(path.dirname(PUBLIC_FILE), { recursive: true });
    fs.writeFileSync(PUBLIC_FILE, url, 'utf8');
    console.log(`Tunnel established: ${url}`);
    tunnel.on('close', () => {
      console.log('Tunnel closed');
    });
    // Keep process alive
  } catch (err) {
    console.error('Failed to start tunnel', err);
    process.exit(1);
  }
})();