import { Router } from 'express';
import mongoose from 'mongoose';
import { body, validationResult } from 'express-validator';
import Room from '../models/Room.js';
import User from '../models/User.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const r = Router();
r.use(requireAuth);

const check = (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ message: 'Please check the submitted fields.', errors: errors.array() });
    return false;
  }
  return true;
};

const AC_FIELD = Room.schema.path('acType') ? 'acType' : null;
const readAC = body => body.acType ?? body.acFacility;
const normalizeAC = value => {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'ac') return 'AC';
  if (normalized === 'non-ac') return 'Non-AC';
  return null;
};
const serializeRoom = room => {
  const data = room.toObject();
  data.acType = data.acType ?? null;
  data.acFacility = data.acType ?? null;
  return data;
};
const status = room => {
  room.availabilityStatus = room.occupants.length >= room.capacity ? 'Full' : 'Available';
};

r.get('/', async (req, res) => {
  try {
    const s = String(req.query.search || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const filter = s ? { $or: [
      { roomNumber: { $regex: s, $options: 'i' } },
      { roomType: { $regex: s, $options: 'i' } },
      { acType: { $regex: s, $options: 'i' } }
    ] } : {};
    const rooms = await Room.find(filter).sort({ roomNumber: 1 });
    res.json({
      rooms: rooms.map(serializeRoom),
      summary: {
        totalRooms: rooms.length,
        availableBeds: rooms.reduce((n, x) => n + Math.max(0, x.capacity - x.occupants.length), 0),
        occupiedBeds: rooms.reduce((n, x) => n + x.occupants.length, 0),
        fullRooms: rooms.filter(x => x.occupants.length >= x.capacity).length
      }
    });
  } catch (error) {
    console.error('Get rooms error:', error);
    res.status(500).json({ message: 'Could not load rooms.' });
  }
});

r.post('/', requireRole('admin'), [
  body('roomNumber').trim().notEmpty(),
  body('roomType').trim().notEmpty(),
  body('capacity').isInt({ min: 1, max: 100 })
], async (req, res) => {
  if (!check(req, res)) return;
  try {
    const supplied = readAC(req.body);
    const acType = supplied === undefined ? undefined : normalizeAC(supplied);
    if (supplied !== undefined && !acType) {
      return res.status(400).json({ message: 'AC facility must be AC or Non-AC.' });
    }
    const room = new Room({
      roomNumber: req.body.roomNumber.trim(),
      roomType: req.body.roomType.trim(),
      capacity: Number(req.body.capacity),
      ...(acType ? { acType } : {}),
      occupants: []
    });
    status(room);
    await room.save();
    res.status(201).json({ room: serializeRoom(room), message: 'Room created successfully.' });
  } catch (error) {
    console.error('Create room error:', error);
    res.status(error.code === 11000 ? 409 : 500).json({
      message: error.code === 11000 ? 'Room number already exists.' : 'Could not create room.'
    });
  }
});

r.put('/:id', requireRole('admin'), async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid room ID.' });
    }
    const room = await Room.findById(req.params.id);
    if (!room) return res.status(404).json({ message: 'Room not found.' });

    if (req.body.roomNumber !== undefined) {
      const roomNumber = String(req.body.roomNumber).trim();
      if (!roomNumber) return res.status(400).json({ message: 'Room number is required.' });
      room.roomNumber = roomNumber;
    }
    if (req.body.roomType !== undefined) {
      const roomType = String(req.body.roomType).trim();
      if (!roomType) return res.status(400).json({ message: 'Room type is required.' });
      room.roomType = roomType;
    }
    if (req.body.capacity !== undefined) {
      const capacity = Number(req.body.capacity);
      if (!Number.isInteger(capacity) || capacity < 1 || capacity > 100 || capacity < room.occupants.length) {
        return res.status(400).json({ message: 'Capacity must be valid and not below current occupancy.' });
      }
      room.capacity = capacity;
    }

    const supplied = readAC(req.body);
    if (supplied !== undefined) {
      const acType = normalizeAC(supplied);
      if (!acType) return res.status(400).json({ message: 'AC facility must be AC or Non-AC.' });
      room.acType = acType;
    }

    status(room);
    await room.save();
    const savedRoom = await Room.findById(room._id);
    res.json({ room: serializeRoom(savedRoom), message: 'Room updated successfully.' });
  } catch (error) {
    console.error('Update room error:', error);
    res.status(error.code === 11000 ? 409 : 500).json({
      message: error.code === 11000 ? 'Room number already exists.' : 'Room update failed.'
    });
  }
});

r.delete('/:id', requireRole('admin'), async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid room ID.' });
    }
    const room = await Room.findById(req.params.id);
    if (!room) return res.status(404).json({ message: 'Room not found.' });
    if (room.occupants.length) {
      return res.status(400).json({ message: 'Vacate all students before deleting this room.' });
    }
    await room.deleteOne();
    res.json({ message: 'Room deleted successfully.' });
  } catch (error) {
    console.error('Delete room error:', error);
    res.status(500).json({ message: 'Could not delete room.' });
  }
});

const findStudent = async identifier => {
  const value = String(identifier || '').trim();
  if (!value) return null;
  const conditions = [];
  if (User.schema.path('studentId')) conditions.push({ studentId: value });
  if (User.schema.path('registrationNumber')) conditions.push({ registrationNumber: value });
  if (User.schema.path('email')) conditions.push({ email: value.toLowerCase() });
  if (!conditions.length) return null;
  return User.findOne({ role: 'student', $or: conditions });
};

r.post('/:id/allocate', requireRole('admin'), async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid room ID.' });
    const identifier = req.body.registrationNumber ?? req.body.studentId ?? req.body.email;
    if (!identifier || !String(identifier).trim()) {
      return res.status(400).json({ message: 'Enter the student registration number or email.' });
    }
    const room = await Room.findById(req.params.id);
    if (!room) return res.status(404).json({ message: 'Room not found.' });
    const student = await findStudent(identifier);
    if (!student) return res.status(404).json({ message: 'No registered student found for that registration number or email.' });
    if (room.occupants.some(o => String(o.user) === String(student._id))) {
      return res.status(409).json({ message: 'Student is already allocated to this room.' });
    }
    if (await Room.findOne({ 'occupants.user': student._id })) {
      return res.status(409).json({ message: 'Student is already allocated to another room.' });
    }
    if (room.occupants.length >= room.capacity) return res.status(400).json({ message: 'Room is full.' });
    room.occupants.push({
      user: student._id,
      studentName: student.name,
      studentId: student.studentId || student.registrationNumber || '',
      email: student.email || ''
    });
    status(room);
    await room.save();
    res.json({ room: serializeRoom(room), message: `${student.name} allocated successfully.` });
  } catch (error) {
    console.error('Allocate student error:', error);
    res.status(500).json({ message: 'Could not allocate student.' });
  }
});

r.post('/:id/vacate', requireRole('admin'), async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid room ID.' });
    const identifier = String(req.body.registrationNumber ?? req.body.studentId ?? req.body.email ?? '').trim();
    if (!identifier) return res.status(400).json({ message: 'Enter the student registration number or email.' });
    const room = await Room.findById(req.params.id);
    if (!room) return res.status(404).json({ message: 'Room not found.' });
    const oldCount = room.occupants.length;
    room.occupants = room.occupants.filter(o => {
      const emailMatch = o.email && o.email.toLowerCase() === identifier.toLowerCase();
      const idMatch = o.studentId && o.studentId.toLowerCase() === identifier.toLowerCase();
      return !emailMatch && !idMatch;
    });
    if (room.occupants.length === oldCount) {
      return res.status(404).json({ message: 'Student was not found in this room.' });
    }
    status(room);
    await room.save();
    res.json({ room: serializeRoom(room), message: 'Student vacated successfully.' });
  } catch (error) {
    console.error('Vacate student error:', error);
    res.status(500).json({ message: 'Could not vacate student.' });
  }
});

r.get('/mine/allocation', requireRole('student'), async (req, res) => {
  try {
    const room = await Room.findOne({ 'occupants.user': req.user._id });
    res.json({ room: room ? serializeRoom(room) : null });
  } catch (error) {
    console.error('Get student allocation error:', error);
    res.status(500).json({ message: 'Could not load your room allocation.' });
  }
});

export default r;
