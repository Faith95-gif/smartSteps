import express from 'express';
import mongoose from 'mongoose';
import session from 'express-session';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcrypt';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/smartsteps';

mongoose.connect(MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Define Schemas
const teacherSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  subject: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const quizSchema = new mongoose.Schema({
  title: { type: String, required: true },
  subject: { type: String, required: true },
  teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher', required: true },
  questions: [{
    question: { type: String, required: true },
    options: [{ type: String, required: true }],
    correctAnswer: { type: Number, required: true }
  }],
  timeLimit: { type: Number, default: 0 }, // in minutes, 0 means no limit
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

const submissionSchema = new mongoose.Schema({
  quiz: { type: mongoose.Schema.Types.ObjectId, ref: 'Quiz', required: true },
  studentName: { type: String, required: true },
  studentEmail: { type: String, required: true },
  answers: [{
    questionIndex: { type: Number, required: true },
    selectedAnswer: { type: Number } // null if not answered
  }],
  score: { type: Number, required: true },
  totalQuestions: { type: Number, required: true },
  percentage: { type: Number, required: true },
  timeSpent: { type: Number, default: 0 }, // in seconds
  startedAt: { type: Date },
  submittedAt: { type: Date, default: Date.now }
});

// Create Models
const Teacher = mongoose.model('Teacher', teacherSchema);
const Quiz = mongoose.model('Quiz', quizSchema);
const Submission = mongoose.model('Submission', submissionSchema);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'smartsteps-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: false, // Set to true in production with HTTPS
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Authentication middleware
const requireAuth = (req, res, next) => {
  if (!req.session.teacherId) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
};

// Auth Routes
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password, subject } = req.body;
    
    // Check if teacher already exists
    const existingTeacher = await Teacher.findOne({ email });
    if (existingTeacher) {
      return res.status(400).json({ error: 'Email already registered' });
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Create new teacher
    const teacher = new Teacher({
      name,
      email,
      password: hashedPassword,
      subject
    });
    
    await teacher.save();
    
    // Set session
    req.session.teacherId = teacher._id;
    
    res.json({ 
      message: 'Registration successful',
      teacher: { id: teacher._id, name: teacher.name, email: teacher.email, subject: teacher.subject }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Find teacher
    const teacher = await Teacher.findOne({ email });
    if (!teacher) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }
    
    // Check password
    const isValidPassword = await bcrypt.compare(password, teacher.password);
    if (!isValidPassword) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }
    
    // Set session
    req.session.teacherId = teacher._id;
    
    res.json({ 
      message: 'Login successful',
      teacher: { id: teacher._id, name: teacher.name, email: teacher.email, subject: teacher.subject }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Logout failed' });
    }
    res.json({ message: 'Logout successful' });
  });
});

app.get('/api/auth/status', async (req, res) => {
  try {
    if (!req.session.teacherId) {
      return res.json({ authenticated: false });
    }
    
    const teacher = await Teacher.findById(req.session.teacherId);
    if (!teacher) {
      return res.json({ authenticated: false });
    }
    
    res.json({ 
      authenticated: true,
      teacher: { id: teacher._id, name: teacher.name, email: teacher.email, subject: teacher.subject }
    });
  } catch (error) {
    console.error('Auth status error:', error);
    res.status(500).json({ error: 'Failed to check auth status' });
  }
});

// Quiz Routes
app.post('/api/quiz/create', requireAuth, async (req, res) => {
  try {
    const { title, questions, timeLimit } = req.body;
    const teacher = await Teacher.findById(req.session.teacherId);
    
    const quiz = new Quiz({
      title,
      subject: teacher.subject,
      teacher: req.session.teacherId,
      questions,
      timeLimit: timeLimit || 0
    });
    
    await quiz.save();
    
    res.json({ 
      message: 'Quiz created successfully',
      quiz: { id: quiz._id, title: quiz.title }
    });
  } catch (error) {
    console.error('Quiz creation error:', error);
    res.status(500).json({ error: 'Failed to create quiz' });
  }
});

app.get('/api/quiz/my-quizzes', requireAuth, async (req, res) => {
  try {
    const quizzes = await Quiz.find({ teacher: req.session.teacherId })
      .populate('teacher', 'name')
      .sort({ createdAt: -1 });
    
    const formattedQuizzes = quizzes.map(quiz => ({
      id: quiz._id,
      title: quiz.title,
      subject: quiz.subject,
      questionCount: quiz.questions.length,
      timeLimit: quiz.timeLimit,
      isActive: quiz.isActive,
      createdAt: quiz.createdAt,
      teacher: quiz.teacher
    }));
    
    res.json(formattedQuizzes);
  } catch (error) {
    console.error('Error fetching quizzes:', error);
    res.status(500).json({ error: 'Failed to fetch quizzes' });
  }
});

app.get('/api/quiz/:id', async (req, res) => {
  try {
    const quiz = await Quiz.findById(req.params.id).populate('teacher', 'name');
    
    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found' });
    }
    
    if (!quiz.isActive) {
      return res.status(403).json({ error: 'Quiz is not active' });
    }
    
    res.json({
      id: quiz._id,
      title: quiz.title,
      subject: quiz.subject,
      questions: quiz.questions,
      timeLimit: quiz.timeLimit,
      teacher: quiz.teacher
    });
  } catch (error) {
    console.error('Error fetching quiz:', error);
    res.status(500).json({ error: 'Failed to fetch quiz' });
  }
});

app.patch('/api/quiz/:id/toggle', requireAuth, async (req, res) => {
  try {
    const quiz = await Quiz.findOne({ _id: req.params.id, teacher: req.session.teacherId });
    
    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found' });
    }
    
    quiz.isActive = !quiz.isActive;
    await quiz.save();
    
    res.json({ 
      message: `Quiz ${quiz.isActive ? 'activated' : 'deactivated'} successfully`,
      isActive: quiz.isActive
    });
  } catch (error) {
    console.error('Error toggling quiz status:', error);
    res.status(500).json({ error: 'Failed to update quiz status' });
  }
});

// NEW: Delete quiz endpoint
app.delete('/api/quiz/:id', requireAuth, async (req, res) => {
  try {
    const quiz = await Quiz.findOne({ _id: req.params.id, teacher: req.session.teacherId });
    
    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found' });
    }
    
    // Delete all submissions for this quiz first
    await Submission.deleteMany({ quiz: req.params.id });
    
    // Delete the quiz
    await Quiz.findByIdAndDelete(req.params.id);
    
    res.json({ 
      message: 'Quiz deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting quiz:', error);
    res.status(500).json({ error: 'Failed to delete quiz' });
  }
});

// ENHANCED: Get results for a specific quiz (separate results)
app.get('/api/quiz/:id/results', requireAuth, async (req, res) => {
  try {
    const quiz = await Quiz.findOne({ _id: req.params.id, teacher: req.session.teacherId });
    
    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found' });
    }
    
    const submissions = await Submission.find({ quiz: req.params.id })
      .populate('quiz', 'title')
      .sort({ submittedAt: -1 });
    
    // Enhanced response with quiz details
    res.json({
      quiz: {
        id: quiz._id,
        title: quiz.title,
        subject: quiz.subject,
        questionCount: quiz.questions.length,
        timeLimit: quiz.timeLimit,
        createdAt: quiz.createdAt
      },
      submissions: submissions.map(sub => ({
        id: sub._id,
        studentName: sub.studentName,
        studentEmail: sub.studentEmail,
        score: sub.score,
        totalQuestions: sub.totalQuestions,
        percentage: sub.percentage,
        timeSpent: sub.timeSpent,
        submittedAt: sub.submittedAt,
        quiz: sub.quiz
      }))
    });
  } catch (error) {
    console.error('Error fetching quiz results:', error);
    res.status(500).json({ error: 'Failed to fetch quiz results' });
  }
});

// NEW: Get all results grouped by quiz
app.get('/api/quiz/all-results', requireAuth, async (req, res) => {
  try {
    const teacherQuizzes = await Quiz.find({ teacher: req.session.teacherId })
      .select('_id title subject createdAt')
      .sort({ createdAt: -1 });
    
    const resultsGrouped = [];
    
    for (const quiz of teacherQuizzes) {
      const submissions = await Submission.find({ quiz: quiz._id })
        .populate('quiz', 'title')
        .sort({ submittedAt: -1 });
      
      if (submissions.length > 0) {
        resultsGrouped.push({
          quiz: {
            id: quiz._id,
            title: quiz.title,
            subject: quiz.subject,
            createdAt: quiz.createdAt
          },
          submissions: submissions.map(sub => ({
            id: sub._id,
            studentName: sub.studentName,
            studentEmail: sub.studentEmail,
            score: sub.score,
            totalQuestions: sub.totalQuestions,
            percentage: sub.percentage,
            timeSpent: sub.timeSpent,
            submittedAt: sub.submittedAt
          })),
          submissionCount: submissions.length,
          averageScore: Math.round(submissions.reduce((acc, sub) => acc + sub.percentage, 0) / submissions.length)
        });
      }
    }
    
    res.json(resultsGrouped);
  } catch (error) {
    console.error('Error fetching all results:', error);
    res.status(500).json({ error: 'Failed to fetch results' });
  }
});

// Student Routes
// NEW: Start quiz session (for timer tracking)
app.post('/api/student/start/:quizId', async (req, res) => {
  try {
    const { studentName, studentEmail } = req.body;
    const quizId = req.params.quizId;
    
    const quiz = await Quiz.findById(quizId);
    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found' });
    }
    
    if (!quiz.isActive) {
      return res.status(403).json({ error: 'Quiz is not active' });
    }
    
    // Create a session token for this quiz attempt
    const sessionToken = `${quizId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Store session in memory or database (for production, use Redis or database)
    // For now, we'll return the start time and let the client handle timing
    const startTime = new Date();
    
    res.json({
      sessionToken,
      startTime: startTime.toISOString(),
      timeLimit: quiz.timeLimit,
      quiz: {
        id: quiz._id,
        title: quiz.title,
        subject: quiz.subject,
        questions: quiz.questions,
        teacher: quiz.teacher
      }
    });
  } catch (error) {
    console.error('Error starting quiz:', error);
    res.status(500).json({ error: 'Failed to start quiz' });
  }
});

app.post('/api/student/submit/:quizId', async (req, res) => {
  try {
    const { studentName, studentEmail, answers, startTime, timeSpent } = req.body;
    const quizId = req.params.quizId;
    
    const quiz = await Quiz.findById(quizId);
    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found' });
    }
    
    if (!quiz.isActive) {
      return res.status(403).json({ error: 'Quiz is not active' });
    }
    
    // Validate time limit if set
    if (quiz.timeLimit > 0 && timeSpent) {
      const maxTimeInSeconds = quiz.timeLimit * 60;
      if (timeSpent > maxTimeInSeconds + 30) { // 30 seconds grace period
        return res.status(400).json({ error: 'Time limit exceeded' });
      }
    }
    
    // Calculate score
    let score = 0;
    const totalQuestions = quiz.questions.length;
    
    answers.forEach(answer => {
      if (answer.selectedAnswer !== null && 
          answer.selectedAnswer === quiz.questions[answer.questionIndex].correctAnswer) {
        score++;
      }
    });
    
    const percentage = Math.round((score / totalQuestions) * 100);
    
    // Create submission
    const submission = new Submission({
      quiz: quizId,
      studentName,
      studentEmail,
      answers,
      score,
      totalQuestions,
      percentage,
      timeSpent: timeSpent || 0,
      startedAt: startTime ? new Date(startTime) : new Date()
    });
    
    await submission.save();
    
    res.json({
      message: 'Quiz submitted successfully',
      submissionId: submission._id,
      result: {
        studentName,
        score,
        totalQuestions,
        percentage,
        timeSpent
      }
    });
  } catch (error) {
    console.error('Error submitting quiz:', error);
    res.status(500).json({ error: 'Failed to submit quiz' });
  }
});

// CRITICAL: Enhanced correction endpoint
app.get('/api/student/correction/:submissionId', async (req, res) => {
  try {
    const submissionId = req.params.submissionId;
    
    // Find the submission and populate quiz and teacher data
    const submission = await Submission.findById(submissionId)
      .populate({
        path: 'quiz',
        populate: {
          path: 'teacher',
          select: 'name'
        }
      });
    
    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' });
    }
    
    // Format the response data for the correction page
    const correctionData = {
      quiz: {
        id: submission.quiz._id,
        title: submission.quiz.title,
        subject: submission.quiz.subject,
        questions: submission.quiz.questions,
        timeLimit: submission.quiz.timeLimit,
        teacher: {
          name: submission.quiz.teacher.name
        }
      },
      result: {
        studentName: submission.studentName,
        score: submission.score,
        totalQuestions: submission.totalQuestions,
        percentage: submission.percentage,
        timeSpent: submission.timeSpent,
        submittedAt: submission.submittedAt
      },
      studentAnswers: submission.answers
    };
    
    res.json(correctionData);
  } catch (error) {
    console.error('Error fetching correction data:', error);
    res.status(500).json({ error: 'Failed to load correction data' });
  }
});

// Serve static files and routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/quiz/:id', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'quiz.html'));
});

// CRITICAL: Add route for correction page
app.get('/correction.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'correction.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});