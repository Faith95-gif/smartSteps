import express from 'express';
import Teacher from '../models/Teacher.js';

const router = express.Router();

// Register teacher
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, subject } = req.body;

    // Check if teacher already exists
    const existingTeacher = await Teacher.findOne({ email });
    if (existingTeacher) {
      return res.status(400).json({ error: 'Teacher already exists with this email' });
    }

    // Create new teacher
    const teacher = new Teacher({ name, email, password, subject });
    await teacher.save();

    req.session.teacherId = teacher._id;
    req.session.teacherName = teacher.name;
    req.session.teacherSubject = teacher.subject;

    res.status(201).json({
      message: 'Teacher registered successfully',
      teacher: {
        id: teacher._id,
        name: teacher.name,
        email: teacher.email,
        subject: teacher.subject
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Server error during registration' });
  }
});

// Login teacher
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find teacher
    const teacher = await Teacher.findOne({ email });
    if (!teacher) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    // Check password
    const isMatch = await teacher.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    req.session.teacherId = teacher._id;
    req.session.teacherName = teacher.name;
    req.session.teacherSubject = teacher.subject;

    res.json({
      message: 'Login successful',
      teacher: {
        id: teacher._id,
        name: teacher.name,
        email: teacher.email,
        subject: teacher.subject
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error during login' });
  }
});

// Logout teacher
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Could not log out' });
    }
    res.json({ message: 'Logged out successfully' });
  });
});

// Check authentication status
router.get('/status', (req, res) => {
  if (req.session.teacherId) {
    res.json({
      authenticated: true,
      teacher: {
        id: req.session.teacherId,
        name: req.session.teacherName,
        subject: req.session.teacherSubject
      }
    });
  } else {
    res.json({ authenticated: false });
  }
});

export default router;