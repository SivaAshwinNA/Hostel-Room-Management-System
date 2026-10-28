
import { useEffect, useState } from 'react';
import {
  BedDouble,
  Building2,
  Users,
  CheckCircle2,
  Search,
  Plus,
  LogOut,
  Pencil,
  Trash2,
  DoorOpen,
  ShieldCheck,
  GraduationCap,
  RefreshCw,
  X
} from 'lucide-react';

const API_URL =
  import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const ROOM_CAPACITY = {
  'Single Seater': 1,
  'Double Seater': 2,
  'Triple Seater': 3,
  'Four Seater': 4
};

const ROOM_TYPES = Object.keys(ROOM_CAPACITY);

// Support both field names while older database records are being migrated.
function getAcFacility(room) {
  const value = room?.acFacility ?? room?.acType;
  return value === 'AC' ? 'AC' : 'Non-AC';
}

const emptyRoom = {
  roomNumber: '',
  roomType: 'Single Seater',
  acType: 'Non-AC',
  capacity: 1
};

const emptyForm = {
  name: '',
  email: '',
  password: '',
  studentId: ''
};

const emptySummary = {
  totalRooms: 0,
  availableBeds: 0,
  occupiedBeds: 0,
  fullRooms: 0
};

export default function App() {
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('hostel_user') || 'null');
    } catch {
      return null;
    }
  });

  const [mode, setMode] = useState('login');
  const [form, setForm] = useState(emptyForm);

  const [rooms, setRooms] = useState([]);
  const [summary, setSummary] = useState(emptySummary);

  const [search, setSearch] = useState('');

  const [roomForm, setRoomForm] = useState({ ...emptyRoom });
  const [editing, setEditing] = useState(null);
  const [showRoomForm, setShowRoomForm] = useState(false);

  const [alloc, setAlloc] = useState(null);
  const [allocEmail, setAllocEmail] = useState('');

  const [vacate, setVacate] = useState(null);
  const [vacateEmail, setVacateEmail] = useState('');

  const [mine, setMine] = useState(null);

  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const isAdmin = user?.role === 'admin';

  // --------------------------------------------------
  // API REQUEST HELPER
  // --------------------------------------------------

  async function request(path, options = {}) {
    const token = localStorage.getItem('hostel_token');

    const response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers
      }
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      if (response.status === 401) {
        localStorage.removeItem('hostel_token');
        localStorage.removeItem('hostel_user');
        setUser(null);
      }

      throw new Error(data.message || data.error || 'Request failed.');
    }

    return data;
  }

  function showNotice(message) {
    setNotice(message);
    setError('');
  }

  function showError(message) {
    setError(message);
    setNotice('');
  }

  function clearMessages() {
    setError('');
    setNotice('');
  }

  // --------------------------------------------------
  // LOAD ROOMS
  // --------------------------------------------------

  async function loadRooms(term = '') {
    const query = term
      ? `?search=${encodeURIComponent(term)}`
      : '';

    const data = await request(`/rooms${query}`);

    const roomList = Array.isArray(data)
      ? data
      : Array.isArray(data.rooms)
        ? data.rooms
        : [];

    setRooms(roomList);
    setSummary(data.summary || emptySummary);
  }

  async function loadMyAllocation() {
    const data = await request('/rooms/mine/allocation');
    setMine(data.room || null);
  }

  useEffect(() => {
    if (!user) return;

    loadRooms('').catch(err => showError(err.message));

    if (user.role === 'student') {
      loadMyAllocation().catch(err => {
        console.error('Unable to load allocation:', err.message);
      });
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;

    const timer = setTimeout(() => {
      loadRooms(search).catch(err => showError(err.message));
    }, 300);

    return () => clearTimeout(timer);
  }, [search, user]);

  // --------------------------------------------------
  // SIGN IN / STUDENT REGISTRATION
  // --------------------------------------------------

  async function handleAuth(event) {
    event.preventDefault();

    setBusy(true);
    clearMessages();

    try {
      const registering = mode === 'register';

      if (registering && !form.studentId.trim()) {
        throw new Error('Student registration number is compulsory.');
      }

      const endpoint = registering
        ? '/auth/register'
        : '/auth/login';

      const payload = registering
        ? {
            name: form.name.trim(),
            email: form.email.trim(),
            password: form.password,
            studentId: form.studentId.trim(),
            role: 'student'
          }
        : {
            email: form.email.trim(),
            password: form.password
          };

      const data = await request(endpoint, {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      if (!data.token || !data.user) {
        throw new Error(
          'The server did not return a user and authentication token.'
        );
      }

      localStorage.setItem('hostel_token', data.token);
      localStorage.setItem('hostel_user', JSON.stringify(data.user));

      setUser(data.user);
      setForm({ ...emptyForm });

      showNotice(`Welcome, ${data.user.name}.`);
    } catch (err) {
      showError(err.message);
    } finally {
      setBusy(false);
    }
  }

  // --------------------------------------------------
  // SIGN OUT
  // --------------------------------------------------

  function logout() {
    localStorage.removeItem('hostel_token');
    localStorage.removeItem('hostel_user');

    setUser(null);
    setMode('login');
    setForm({ ...emptyForm });

    setRooms([]);
    setSummary({ ...emptySummary });
    setMine(null);

    setSearch('');
    setRoomForm({ ...emptyRoom });
    setEditing(null);
    setShowRoomForm(false);

    setAlloc(null);
    setVacate(null);

    clearMessages();
  }

  // --------------------------------------------------
  // ROOM FORM
  // --------------------------------------------------

  function changeRoomType(roomType) {
    setRoomForm(previous => ({
      ...previous,
      roomType,
      capacity: ROOM_CAPACITY[roomType]
    }));
  }

  function openNewRoomForm() {
    setEditing(null);
    setRoomForm({ ...emptyRoom });
    setShowRoomForm(true);
    clearMessages();
  }

  function closeRoomForm() {
    setShowRoomForm(false);
    setEditing(null);
    setRoomForm({ ...emptyRoom });
  }

  function editRoom(room) {
    const roomType = ROOM_CAPACITY[room.roomType]
      ? room.roomType
      : 'Double Seater';

    setEditing(room);

    setRoomForm({
      roomNumber: room.roomNumber || '',
      roomType,
      acType: getAcFacility(room),
      capacity: ROOM_CAPACITY[roomType]
    });

    setShowRoomForm(true);
    clearMessages();
  }

  async function saveRoom(event) {
    event.preventDefault();

    setBusy(true);
    clearMessages();

    try {
      const capacity = ROOM_CAPACITY[roomForm.roomType];

      if (!capacity) {
        throw new Error('Please select a valid room type.');
      }

      const payload = {
        roomNumber: roomForm.roomNumber.trim(),
        roomType: roomForm.roomType,
        acType: roomForm.acType,
        acFacility: roomForm.acType,
        capacity
      };

      const endpoint = editing
        ? `/rooms/${editing._id}`
        : '/rooms';

      const data = await request(endpoint, {
        method: editing ? 'PUT' : 'POST',
        body: JSON.stringify(payload)
      });

      closeRoomForm();

      await loadRooms(search);

      showNotice(
        data.message ||
          (editing
            ? 'Room updated successfully.'
            : 'Room created successfully.')
      );
    } catch (err) {
      showError(err.message);
    } finally {
      setBusy(false);
    }
  }

  // --------------------------------------------------
  // DELETE ROOM
  // --------------------------------------------------

  async function deleteRoom(room) {
    if (
      !window.confirm(
        `Are you sure you want to delete room ${room.roomNumber}?`
      )
    ) {
      return;
    }

    setBusy(true);
    clearMessages();

    try {
      const data = await request(`/rooms/${room._id}`, {
        method: 'DELETE'
      });

      await loadRooms(search);

      showNotice(data.message || 'Room deleted successfully.');
    } catch (err) {
      showError(err.message);
    } finally {
      setBusy(false);
    }
  }

  // --------------------------------------------------
  // ALLOCATE STUDENT
  // --------------------------------------------------

  async function allocateStudent(event) {
    event.preventDefault();

    const studentId = allocEmail.trim();
    if (!studentId) {
      showError('Enter the student registration number.');
      return;
    }

    setBusy(true);
    clearMessages();

    try {
      const data = await request(`/rooms/${alloc._id}/allocate`, {
        method: 'POST',
        body: JSON.stringify({ studentId })
      });

      setAlloc(null);
      setAllocEmail('');

      await loadRooms(search);

      showNotice(data.message || 'Student allocated successfully.');
    } catch (err) {
      showError(err.message);
    } finally {
      setBusy(false);
    }
  }

  // --------------------------------------------------
  // VACATE STUDENT
  // --------------------------------------------------

  async function vacateStudent(event) {
    event.preventDefault();

    if (!vacateEmail) {
      showError('Select a student to vacate.');
      return;
    }

    setBusy(true);
    clearMessages();

    try {
      const data = await request(`/rooms/${vacate._id}/vacate`, {
        method: 'POST',
        body: JSON.stringify({
          email: vacateEmail
        })
      });

      setVacate(null);
      setVacateEmail('');

      await loadRooms(search);

      if (user?.role === 'student') {
        await loadMyAllocation();
      }

      showNotice(data.message || 'Student vacated successfully.');
    } catch (err) {
      showError(err.message);
    } finally {
      setBusy(false);
    }
  }

  // --------------------------------------------------
  // SIGN IN / REGISTER PAGE
  // --------------------------------------------------

  if (!user) {
    return (
      <div className="auth">
        <section className="hero">
          <div className="logo">
            <BedDouble size={30} />
            <strong>
              Hostel<span>Hub</span>
            </strong>
          </div>

          <div className="hero-copy">
            <small>SMART HOSTEL OPERATIONS</small>

            <h1>A better way to manage hostel living.</h1>

            <p>
              Room inventory, student allocations and availability,
              organized in one workspace.
            </p>

            <p className="hero-features">
              ✓ Student and administrator access
              <br />
              ✓ Live room inventory
              <br />
              ✓ AC and Non-AC accommodation
              <br />
              ✓ Student allocation
            </p>
          </div>

          <small>HOSTEL ROOM MANAGEMENT SYSTEM</small>
        </section>

        <section className="authbox">
          <small className="eyebrow">
            {mode === 'login' ? 'WELCOME BACK' : 'GET STARTED'}
          </small>

          <h2>
            {mode === 'login' ? 'Sign in' : 'Create a student account'}
          </h2>

          <p>
            {mode === 'login'
              ? 'Use your registered email and password.'
              : 'Register using your student registration number.'}
          </p>

          {error && (
            <div className="alert alert-danger" role="alert">
              {error}
            </div>
          )}

          {notice && (
            <div className="alert alert-success" role="status">
              {notice}
            </div>
          )}

          <form onSubmit={handleAuth}>
            {mode === 'register' && (
              <>
                <label>
                  Full name
                  <input
                    className="form-control"
                    type="text"
                    autoComplete="name"
                    minLength={2}
                    maxLength={100}
                    required
                    value={form.name}
                    onChange={event =>
                      setForm(previous => ({
                        ...previous,
                        name: event.target.value
                      }))
                    }
                    placeholder="Enter your full name"
                  />
                </label>

                <label>
                  Student Registration Number
                  <input
                    className="form-control"
                    type="text"
                    autoComplete="off"
                    maxLength={50}
                    required
                    value={form.studentId}
                    onChange={event =>
                      setForm(previous => ({
                        ...previous,
                        studentId: event.target.value
                      }))
                    }
                    placeholder="Enter your registration number"
                  />
                </label>
              </>
            )}

            <label>
              Email address
              <input
                className="form-control"
                type="email"
                autoComplete="email"
                required
                value={form.email}
                onChange={event =>
                  setForm(previous => ({
                    ...previous,
                    email: event.target.value
                  }))
                }
                placeholder="student@example.com"
              />
            </label>

            <label>
              Password (minimum 8 characters)
              <input
                className="form-control"
                type="password"
                autoComplete={
                  mode === 'login'
                    ? 'current-password'
                    : 'new-password'
                }
                minLength={8}
                required
                value={form.password}
                onChange={event =>
                  setForm(previous => ({
                    ...previous,
                    password: event.target.value
                  }))
                }
                placeholder="Enter your password"
              />
            </label>

            <button
              type="submit"
              className="btn btn-primary w-100 mt-2"
              disabled={busy}
            >
              {busy
                ? 'Please wait...'
                : mode === 'login'
                  ? 'Sign in'
                  : 'Create student account'}
            </button>
          </form>

          <p className="switch">
            {mode === 'login'
              ? "Don't have a student account?"
              : 'Already registered?'}

            <button
              type="button"
              onClick={() => {
                setMode(mode === 'login' ? 'register' : 'login');
                setForm({ ...emptyForm });
                clearMessages();
              }}
            >
              {mode === 'login' ? 'Create account' : 'Sign in'}
            </button>
          </p>

          <small className="security">
            <ShieldCheck size={16} />
            Passwords must be securely hashed by the backend.
          </small>
        </section>
      </div>
    );
  }

  // --------------------------------------------------
  // DASHBOARD
  // --------------------------------------------------

  return (
    <div className="layout">
      <aside className="side">
        <div className="logo">
          <BedDouble size={28} />
          <strong>
            Hostel<span>Hub</span>
          </strong>
        </div>

        <small className="side-label">WORKSPACE</small>

        <div className="active">
          {isAdmin ? 'Room Management' : 'Student Dashboard'}
        </div>

        <div className="sidebar-note">
          <CheckCircle2 size={18} />
          <strong>Room status</strong>
          <p>
            Room occupancy and availability are updated when
            students are allocated or vacated.
          </p>
        </div>

        <div className="sidefoot">
          <div className="avatar">
            {(user.name || 'U').charAt(0).toUpperCase()}
          </div>

          <div className="user-info">
            <b>{user.name}</b>
            <small>{isAdmin ? 'Administrator' : 'Student'}</small>
          </div>

          <button
            type="button"
            className="logout-btn"
            onClick={logout}
            title="Sign out"
            aria-label="Sign out"
          >
            <LogOut size={17} />
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <span>
            Workspace / {isAdmin ? 'Room Management' : 'Student Portal'}
          </span>

          <div className="user-indicator">
            <span className="online-dot" />
            {isAdmin ? 'Administrator' : 'Student'}
          </div>
        </header>

        <div className="content">
          <div className="heading">
            <div>
              <small>
                {isAdmin ? 'HOSTEL OPERATIONS' : 'STUDENT SERVICES'}
              </small>

              <h1>
                {isAdmin ? 'Room Management' : 'Student Dashboard'}
              </h1>

              <p>
                {isAdmin
                  ? 'Manage room inventory, AC facilities, student allocations and availability.'
                  : 'View accommodation information and available hostel rooms.'}
              </p>
            </div>

            {isAdmin && (
              <button
                type="button"
                className="btn btn-primary add-room-btn"
                onClick={openNewRoomForm}
              >
                <Plus size={18} />
                Add new room
              </button>
            )}
          </div>

          {error && (
            <div className="alert alert-danger" role="alert">
              {error}
            </div>
          )}

          {notice && (
            <div className="alert alert-success" role="status">
              {notice}
            </div>
          )}

          {isAdmin ? (
            <div className="stats">
              {[
                {
                  icon: <Building2 />,
                  label: 'TOTAL ROOMS',
                  value: summary.totalRooms ?? rooms.length
                },
                {
                  icon: <BedDouble />,
                  label: 'AVAILABLE BEDS',
                  value: summary.availableBeds ?? 0
                },
                {
                  icon: <Users />,
                  label: 'OCCUPIED BEDS',
                  value: summary.occupiedBeds ?? 0
                },
                {
                  icon: <CheckCircle2 />,
                  label: 'FULL ROOMS',
                  value: summary.fullRooms ?? 0
                }
              ].map(item => (
                <div className="stat" key={item.label}>
                  <div className="stat-icon">{item.icon}</div>
                  <small>{item.label}</small>
                  <strong>{item.value}</strong>
                </div>
              ))}
            </div>
          ) : (
            <div className="card welcome">
              <GraduationCap size={32} />

              <div>
                <h3>Welcome, {user.name}</h3>

                <p>
                  Registration number:{' '}
                  <strong>{user.studentId || 'Not provided'}</strong>
                </p>

                {mine ? (
                  <>
                    <p>
                      Allocated room:{' '}
                      <strong>{mine.roomNumber}</strong>
                    </p>
                    <p>
                      Room type: {mine.roomType}
                      {' · '}
                      {getAcFacility(mine)}
                    </p>
                  </>
                ) : (
                  <p>
                    You do not currently have a room allocation.
                    Please contact the administrator.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Add/edit room form */}
          {isAdmin && showRoomForm && (
            <section className="card roomform">
              <div className="sectionhead">
                <div>
                  <h3>
                    {editing ? 'Update room details' : 'Add new room'}
                  </h3>
                  <p>
                    Choose the room type to set bed capacity automatically.
                  </p>
                </div>

                <button
                  type="button"
                  className="btn btn-light close-form-btn"
                  onClick={closeRoomForm}
                  aria-label="Close room form"
                  title="Close"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={saveRoom}>
                <div className="room-form-grid">
                  <label>
                    Room number
                    <input
                      className="form-control"
                      type="text"
                      maxLength={30}
                      required
                      value={roomForm.roomNumber}
                      onChange={event =>
                        setRoomForm(previous => ({
                          ...previous,
                          roomNumber: event.target.value
                        }))
                      }
                      placeholder="A-101"
                    />
                  </label>

                  <label>
                    Room type
                    <select
                      className="form-select"
                      required
                      value={roomForm.roomType}
                      onChange={event =>
                        changeRoomType(event.target.value)
                      }
                    >
                      {ROOM_TYPES.map(type => (
                        <option key={type} value={type}>
                          {type} — {ROOM_CAPACITY[type]}{' '}
                          {ROOM_CAPACITY[type] === 1 ? 'Bed' : 'Beds'}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    AC facility
                    <select
                      className="form-select"
                      required
                      value={roomForm.acType}
                      onChange={event =>
                        setRoomForm(previous => ({
                          ...previous,
                          acType: event.target.value
                        }))
                      }
                    >
                      <option value="AC">AC</option>
                      <option value="Non-AC">Non-AC</option>
                    </select>
                  </label>

                  <label>
                    Automatic bed capacity
                    <input
                      className="form-control"
                      type="number"
                      value={ROOM_CAPACITY[roomForm.roomType]}
                      readOnly
                    />
                  </label>
                </div>

                <div className="form-actions">
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={busy}
                  >
                    {busy
                      ? 'Saving...'
                      : editing
                        ? 'Update room'
                        : 'Create room'}
                  </button>

                  <button
                    type="button"
                    className="btn btn-light"
                    onClick={closeRoomForm}
                    disabled={busy}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </section>
          )}

          {/* Room inventory */}
          <section className="card">
            <div className="sectionhead">
              <div>
                <h3>
                  {isAdmin ? 'All hostel rooms' : 'Hostel room availability'}
                </h3>

                <p>Search rooms by number, type or AC facility.</p>
              </div>

              <button
                type="button"
                className="btn btn-outline-secondary btn-sm"
                onClick={() => {
                  loadRooms(search).catch(err => showError(err.message));

                  if (!isAdmin) {
                    loadMyAllocation().catch(err =>
                      showError(err.message)
                    );
                  }
                }}
              >
                <RefreshCw size={14} />
                Refresh
              </button>
            </div>

            <div className="search">
              <Search size={17} />

              <input
                type="search"
                placeholder="Search room number, type or AC..."
                value={search}
                onChange={event => setSearch(event.target.value)}
              />

              <span>{rooms.length} found</span>
            </div>

            <div className="table-responsive">
              <table className="table align-middle">
                <thead>
                  <tr>
                    <th>ROOM</th>
                    <th>ROOM TYPE</th>
                    <th>AC FACILITY</th>
                    <th>OCCUPANCY</th>
                    <th>AVAILABLE BEDS</th>
                    <th>STATUS</th>
                    {isAdmin && <th>STUDENTS</th>}
                    {isAdmin && <th>ACTIONS</th>}
                  </tr>
                </thead>

                <tbody>
                  {rooms.map(room => {
                    const capacity =
                      ROOM_CAPACITY[room.roomType] || room.capacity || 0;

                    const occupants = Array.isArray(room.occupants)
                      ? room.occupants
                      : Array.isArray(room.occupants?.students)
                        ? room.occupants.students
                        : [];

                    const occupied = occupants.length;
                    const availableBeds = Math.max(0, capacity - occupied);
                    const full = availableBeds === 0;

                    return (
                      <tr key={room._id}>
                        <td>
                          <strong>{room.roomNumber}</strong>
                        </td>

                        <td>{room.roomType}</td>

                        <td>
                          <span
                            className={
                              'badge ' +
                              (getAcFacility(room) === 'AC'
                                ? 'text-bg-info'
                                : 'text-bg-secondary')
                            }
                          >
                            {getAcFacility(room)}
                          </span>
                        </td>

                        <td>
                          {occupied}/{capacity}
                        </td>

                        <td>{availableBeds}</td>

                        <td>
                          <span
                            className={
                              'badge ' +
                              (full
                                ? 'text-bg-warning'
                                : 'text-bg-success')
                            }
                          >
                            {full ? 'Full' : 'Available'}
                          </span>
                        </td>

                        {isAdmin && (
                          <td>
                            {occupants.length ? (
                              occupants.map((student, index) => (
                                <div key={student.email || index}>
                                  {student.studentName || student.name}

                                  <small className="d-block text-secondary">
                                    {student.studentId || student.email}
                                  </small>
                                </div>
                              ))
                            ) : (
                              <span className="text-secondary">
                                No students
                              </span>
                            )}
                          </td>
                        )}

                        {isAdmin && (
                          <td>
                            <div className="actions">
                              <button
                                type="button"
                                title="Allocate student"
                                className="btn btn-sm btn-light"
                                disabled={full || busy}
                                onClick={() => {
                                  setAlloc(room);
                                  setAllocEmail('');
                                  clearMessages();
                                }}
                              >
                                <Users size={15} />
                              </button>

                              <button
                                type="button"
                                title="Vacate student"
                                className="btn btn-sm btn-light"
                                disabled={occupied === 0 || busy}
                                onClick={() => {
                                  setVacate(room);
                                  setVacateEmail(
                                    occupants[0]?.email || ''
                                  );
                                  clearMessages();
                                }}
                              >
                                <DoorOpen size={15} />
                              </button>

                              <button
                                type="button"
                                title="Edit room"
                                className="btn btn-sm btn-light"
                                disabled={busy}
                                onClick={() => editRoom(room)}
                              >
                                <Pencil size={15} />
                              </button>

                              <button
                                type="button"
                                title="Delete room"
                                className="btn btn-sm btn-light text-danger"
                                disabled={busy}
                                onClick={() => deleteRoom(room)}
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}

                  {rooms.length === 0 && (
                    <tr>
                      <td
                        colSpan={isAdmin ? 8 : 6}
                        className="text-center p-5 text-secondary"
                      >
                        No rooms found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <footer className="app-footer">
          HostelHub · Hostel Room Management System
        </footer>
      </main>

      {/* Allocate student dialog */}
      {alloc && (
        <div className="overlay">
          <form className="dialog" onSubmit={allocateStudent}>
            <h3>Allocate student</h3>

            <p>
              Room: <strong>{alloc.roomNumber}</strong>
              <br />
              Type: {alloc.roomType} · {getAcFacility(alloc)}
              <br />
              Capacity: {ROOM_CAPACITY[alloc.roomType] || alloc.capacity}
            </p>

            <label>
                Student Registration Number
                <input
                    className="form-control"
                    type="text"
                    required
                    autoComplete="off"
                    value={allocEmail}
                    onChange={event => setAllocEmail(event.target.value)}
                    placeholder="e.g. URK24CSB001"
                />
            </label>

            <div className="buttons">
              <button
                type="button"
                className="btn btn-light"
                onClick={() => setAlloc(null)}
              >
                Cancel
              </button>

              <button
                type="submit"
                className="btn btn-primary"
                disabled={busy}
              >
                {busy ? 'Allocating...' : 'Allocate student'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Vacate student dialog */}
      {vacate && (
        <div className="overlay">
          <form className="dialog" onSubmit={vacateStudent}>
            <h3>Vacate student</h3>

            <p>
              Room: <strong>{vacate.roomNumber}</strong>
            </p>

            <label>
              Select student
              <select
                className="form-select"
                required
                value={vacateEmail}
                onChange={event => setVacateEmail(event.target.value)}
              >
                {(
                  Array.isArray(vacate.occupants)
                    ? vacate.occupants
                    : []
                ).map((student, index) => (
                  <option
                    key={student.email || index}
                    value={student.email || ''}
                  >
                    {student.studentName || student.name} (
                    {student.email})
                  </option>
                ))}
              </select>
            </label>

            <div className="buttons">
              <button
                type="button"
                className="btn btn-light"
                onClick={() => setVacate(null)}
              >
                Cancel
              </button>

              <button
                type="submit"
                className="btn btn-primary"
                disabled={busy}
              >
                {busy ? 'Processing...' : 'Confirm vacate'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

