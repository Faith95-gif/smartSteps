import express from 'express';
import Quiz from '../models/Quiz.js';
import Result from '../models/Result.js';

const router = express.Router();

// Middleware to check authentication
const requireAuth = (req, res, next) => {
  if (!req.session.teacherId) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
};

// Create quiz
router.post('/create', requireAuth, async (req, res) => {
  try {
    const { title, questions } = req.body;
    
    const quiz = new Quiz({
      title,
      subject: req.session.teacherSubject,
      teacher: req.session.teacherId,
      questions
    });

    await quiz.save();
    res.status(201).json({ 
      message: 'Quiz created successfully', 
      quiz: {
        id: quiz._id,
        title: quiz.title,
        subject: quiz.subject,
        questionCount: quiz.questions.length
      }
    });
  } catch (error) {
    console.error('Quiz creation error:', error);
    res.status(500).json({ error: 'Server error during quiz creation' });
  }
});

// Get teacher's quizzes
router.get('/my-quizzes', requireAuth, async (req, res) => {
  try {
    const quizzes = await Quiz.find({ teacher: req.session.teacherId })
      .select('title subject questions createdAt isActive')
      .sort({ createdAt: -1 });

    const quizzesWithStats = quizzes.map(quiz => ({
      id: quiz._id,
      title: quiz.title,
      subject: quiz.subject,
      questionCount: quiz.questions.length,
      createdAt: quiz.createdAt,
      isActive: quiz.isActive
    }));

    res.json(quizzesWithStats);
  } catch (error) {
    console.error('Error fetching quizzes:', error);
    res.status(500).json({ error: 'Server error fetching quizzes' });
  }
});

// Get quiz by ID (for students)
router.get('/:id', async (req, res) => {
  try {
    const quiz = await Quiz.findById(req.params.id)
      .populate('teacher', 'name subject')
      .select('-questions.correctAnswer'); // Don't send correct answers to students

    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    if (!quiz.isActive) {
      return res.status(403).json({ error: 'This quiz is no longer active' });
    }

    res.json({
      id: quiz._id,
      title: quiz.title,
      subject: quiz.subject,
      teacher: quiz.teacher,
      questions: quiz.questions.map(q => ({
        question: q.question,
        options: q.options
      }))
    });
  } catch (error) {
    console.error('Error fetching quiz:', error);
    res.status(500).json({ error: 'Server error fetching quiz' });
  }
});

// Toggle quiz active status
router.patch('/:id/toggle', requireAuth, async (req, res) => {
  try {
    const quiz = await Quiz.findOne({ 
      _id: req.params.id, 
      teacher: req.session.teacherId 
    });

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
    res.status(500).json({ error: 'Server error' });
  }
});

// Get quiz results for teacher
router.get('/:id/results', requireAuth, async (req, res) => {
  try {
    const results = await Result.find({ 
      quiz: req.params.id,
      teacher: req.session.teacherId 
    })
    .populate('quiz', 'title')
    .sort({ submittedAt: -1 });

    res.json(results);
  } catch (error) {
    console.error('Error fetching results:', error);
    res.status(500).json({ error: 'Server error fetching results' });
  }
});

export default router;