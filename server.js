import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const port = Number(process.env.PORT) || 3000;
const publicDir = path.join(__dirname, 'public');

const rooms = [
  { id: 1, name: 'Orion Hall', location: 'Floor 3', capacity: 12, amenities: ['Projector', 'Whiteboard', 'Video Conferencing'] },
  { id: 2, name: 'Nimbus Room', location: 'Floor 1', capacity: 6, amenities: ['TV Screen', 'Speakerphone'] }
];

const bookings = [
  { id: 1, roomId: 1, title: 'Weekly Product Sync', organizer: 'Alex', attendees: 9, startTime: '2026-01-12T09:00:00.000Z', endTime: '2026-01-12T10:00:00.000Z' }
];

let nextRoomId = 3;
let nextBookingId = 2;

function sendJson(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(JSON.stringify(data));
}

function sendNoContent(res) {
  res.writeHead(204, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end();
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error('Invalid JSON payload'));
      }
    });
    req.on('error', reject);
  });
}

function parseDate(value) {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function overlaps(roomId, start, end) {
  return bookings.some((booking) => booking.roomId === roomId && start < new Date(booking.endTime) && end > new Date(booking.startTime));
}

function withRoom(booking) {
  return { ...booking, room: rooms.find((room) => room.id === booking.roomId) || null };
}

function serveStatic(req, res, pathname) {
  const requested = pathname === '/' ? 'index.html' : pathname.slice(1);
  const filePath = path.join(publicDir, requested);
  if (!filePath.startsWith(publicDir)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not Found');
      return;
    }

    const ext = path.extname(filePath);
    const type = ext === '.html' ? 'text/html' : ext === '.css' ? 'text/css' : ext === '.js' ? 'application/javascript' : 'text/plain';
    res.writeHead(200, { 'Content-Type': type });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;

  if (req.method === 'OPTIONS') {
    return sendNoContent(res);
  }

  try {
    if (req.method === 'GET' && pathname === '/api/health') return sendJson(res, 200, { ok: true });

    if (req.method === 'GET' && pathname === '/api/rooms') return sendJson(res, 200, rooms);

    if (req.method === 'POST' && pathname === '/api/rooms') {
      const { name, location, capacity, amenities } = await parseBody(req);
      if (!name || !location || !Number.isFinite(capacity) || capacity < 1) return sendJson(res, 400, { error: 'Invalid room payload. name, location, and capacity are required.' });

      const room = {
        id: nextRoomId++,
        name: String(name).trim(),
        location: String(location).trim(),
        capacity: Math.floor(capacity),
        amenities: Array.isArray(amenities) ? amenities.map((item) => String(item).trim()).filter(Boolean) : []
      };

      rooms.push(room);
      return sendJson(res, 201, room);
    }

    if (req.method === 'DELETE' && pathname.startsWith('/api/rooms/')) {
      const roomId = Number(pathname.split('/').pop());
      const index = rooms.findIndex((room) => room.id === roomId);
      if (index === -1) return sendJson(res, 404, { error: 'Room not found.' });
      if (bookings.some((booking) => booking.roomId === roomId)) return sendJson(res, 400, { error: 'Cannot delete room with existing bookings.' });
      rooms.splice(index, 1);
      return sendNoContent(res);
    }

    if (req.method === 'GET' && pathname === '/api/bookings') {
      const date = url.searchParams.get('date');
      const filtered = date ? bookings.filter((booking) => booking.startTime.startsWith(date)) : bookings;
      return sendJson(res, 200, filtered.map(withRoom).sort((a, b) => new Date(a.startTime) - new Date(b.startTime)));
    }

    if (req.method === 'POST' && pathname === '/api/bookings') {
      const { roomId, title, organizer, attendees, startTime, endTime } = await parseBody(req);
      const room = rooms.find((entry) => entry.id === Number(roomId));
      if (!room) return sendJson(res, 404, { error: 'Room not found.' });
      if (!title || !organizer) return sendJson(res, 400, { error: 'title and organizer are required.' });
      if (!Number.isFinite(attendees) || attendees < 1) return sendJson(res, 400, { error: 'attendees must be a positive number.' });
      if (attendees > room.capacity) return sendJson(res, 400, { error: 'attendees exceed room capacity.' });

      const start = parseDate(startTime);
      const end = parseDate(endTime);
      if (!start || !end || start >= end) return sendJson(res, 400, { error: 'Invalid date range.' });
      if (overlaps(room.id, start, end)) return sendJson(res, 409, { error: 'Room is already booked during that time.' });

      const booking = {
        id: nextBookingId++,
        roomId: room.id,
        title: String(title).trim(),
        organizer: String(organizer).trim(),
        attendees: Math.floor(attendees),
        startTime: start.toISOString(),
        endTime: end.toISOString()
      };
      bookings.push(booking);
      return sendJson(res, 201, booking);
    }

    if (req.method === 'DELETE' && pathname.startsWith('/api/bookings/')) {
      const bookingId = Number(pathname.split('/').pop());
      const index = bookings.findIndex((booking) => booking.id === bookingId);
      if (index === -1) return sendJson(res, 404, { error: 'Booking not found.' });
      bookings.splice(index, 1);
      return sendNoContent(res);
    }

    if (req.method === 'GET' && pathname === '/api/dashboard') {
      const now = new Date();
      const activeBookings = bookings.filter((booking) => new Date(booking.startTime) <= now && new Date(booking.endTime) >= now).length;
      const totalCapacity = rooms.reduce((sum, room) => sum + room.capacity, 0);
      const reservedSeats = bookings.reduce((sum, booking) => sum + booking.attendees, 0);
      return sendJson(res, 200, { totalRooms: rooms.length, totalBookings: bookings.length, activeBookings, totalCapacity, reservedSeats });
    }

    if (!pathname.startsWith('/api/')) {
      return serveStatic(req, res, pathname);
    }

    sendJson(res, 404, { error: 'Route not found.' });
  } catch (error) {
    sendJson(res, 400, { error: error.message || 'Request failed.' });
  }
});

server.listen(port, () => {
  console.log(`Meeting room system running at http://localhost:${port}`);
});
