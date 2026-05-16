const statusEl = document.getElementById('status');
const statsGrid = document.getElementById('stats-grid');
const roomList = document.getElementById('room-list');
const bookingList = document.getElementById('booking-list');
const bookingRoom = document.getElementById('booking-room');
const filterDate = document.getElementById('filter-date');

let rooms = [];
let bookings = [];

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.className = isError ? 'error' : 'success';
  setTimeout(() => {
    statusEl.textContent = '';
    statusEl.className = '';
  }, 2500);
}

async function request(url, options = {}) {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || 'Request failed');
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

function renderStats(stats) {
  const fields = [
    ['Total Rooms', stats.totalRooms],
    ['Total Bookings', stats.totalBookings],
    ['Active Bookings', stats.activeBookings],
    ['Total Capacity', stats.totalCapacity],
    ['Reserved Seats', stats.reservedSeats]
  ];

  statsGrid.innerHTML = fields
    .map(([label, value]) => `<article class="stat-card"><h3>${value}</h3><p>${label}</p></article>`)
    .join('');
}

function renderRooms() {
  bookingRoom.innerHTML = rooms
    .map((room) => `<option value="${room.id}">${room.name} (${room.capacity} seats)</option>`)
    .join('');

  roomList.innerHTML = rooms
    .map(
      (room) => `
      <article class="list-item">
        <div>
          <h3>${room.name}</h3>
          <p>${room.location} • Capacity: ${room.capacity}</p>
          <p class="muted">${room.amenities.length ? room.amenities.join(', ') : 'No amenities listed'}</p>
        </div>
        <button class="danger" data-room-delete="${room.id}">Delete</button>
      </article>
    `
    )
    .join('');
}

function renderBookings() {
  bookingList.innerHTML = bookings
    .map((booking) => {
      const start = new Date(booking.startTime).toLocaleString();
      const end = new Date(booking.endTime).toLocaleString();
      return `
        <article class="list-item">
          <div>
            <h3>${booking.title}</h3>
            <p>${booking.room?.name || 'Unknown room'} • ${booking.organizer}</p>
            <p>${start} - ${end}</p>
            <p class="muted">Attendees: ${booking.attendees}</p>
          </div>
          <button class="danger" data-booking-delete="${booking.id}">Cancel</button>
        </article>
      `;
    })
    .join('');
}

async function refreshDashboard() {
  const stats = await request('/api/dashboard');
  renderStats(stats);
}

async function refreshRooms() {
  rooms = await request('/api/rooms');
  renderRooms();
}

async function refreshBookings(dateFilter = '') {
  const query = dateFilter ? `?date=${dateFilter}` : '';
  bookings = await request(`/api/bookings${query}`);
  renderBookings();
}

async function bootstrap() {
  await Promise.all([refreshDashboard(), refreshRooms(), refreshBookings()]);
}

document.getElementById('room-form').addEventListener('submit', async (event) => {
  event.preventDefault();

  const payload = {
    name: document.getElementById('room-name').value.trim(),
    location: document.getElementById('room-location').value.trim(),
    capacity: Number(document.getElementById('room-capacity').value),
    amenities: document.getElementById('room-amenities').value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
  };

  try {
    await request('/api/rooms', { method: 'POST', body: JSON.stringify(payload) });
    event.target.reset();
    await Promise.all([refreshRooms(), refreshDashboard()]);
    setStatus('Room added successfully.');
  } catch (error) {
    setStatus(error.message, true);
  }
});

document.getElementById('booking-form').addEventListener('submit', async (event) => {
  event.preventDefault();

  const payload = {
    roomId: Number(document.getElementById('booking-room').value),
    title: document.getElementById('booking-title').value.trim(),
    organizer: document.getElementById('booking-organizer').value.trim(),
    attendees: Number(document.getElementById('booking-attendees').value),
    startTime: new Date(document.getElementById('booking-start').value).toISOString(),
    endTime: new Date(document.getElementById('booking-end').value).toISOString()
  };

  try {
    await request('/api/bookings', { method: 'POST', body: JSON.stringify(payload) });
    event.target.reset();
    await Promise.all([refreshBookings(filterDate.value), refreshDashboard()]);
    setStatus('Booking created successfully.');
  } catch (error) {
    setStatus(error.message, true);
  }
});

document.getElementById('filter-btn').addEventListener('click', async () => {
  try {
    await refreshBookings(filterDate.value);
  } catch (error) {
    setStatus(error.message, true);
  }
});

document.getElementById('clear-filter-btn').addEventListener('click', async () => {
  filterDate.value = '';
  try {
    await refreshBookings();
  } catch (error) {
    setStatus(error.message, true);
  }
});

document.addEventListener('click', async (event) => {
  const roomId = event.target.dataset.roomDelete;
  const bookingId = event.target.dataset.bookingDelete;

  if (roomId) {
    try {
      await request(`/api/rooms/${roomId}`, { method: 'DELETE' });
      await Promise.all([refreshRooms(), refreshDashboard()]);
      setStatus('Room deleted successfully.');
    } catch (error) {
      setStatus(error.message, true);
    }
  }

  if (bookingId) {
    try {
      await request(`/api/bookings/${bookingId}`, { method: 'DELETE' });
      await Promise.all([refreshBookings(filterDate.value), refreshDashboard()]);
      setStatus('Booking cancelled successfully.');
    } catch (error) {
      setStatus(error.message, true);
    }
  }
});

bootstrap().catch((error) => setStatus(error.message, true));
