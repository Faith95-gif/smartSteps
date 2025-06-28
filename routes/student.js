import express from 'express';
import Quiz from '../models/Quiz.js';
import Result from '../models/Result.js';

const router = express.Router();

// Submit quiz answers
router.post('/submit/:quizId', async (req, res) => {
  try {
    const { studentName, studentEmail, answers } = req.body;
    const quizId = req.params.quizId;

    // Get quiz with correct answers
    const quiz = await Quiz.findById(quizId);
    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    if (!quiz.isActive) {
      return res.status(403).json({ error: 'This quiz is no longer active' });
    }

    // Calculate score
    let score = 0;
    const totalQuestions = quiz.questions.length;

    answers.forEach((answer, index) => {
      if (quiz.questions[index] && answer.selectedAnswer === quiz.questions[index].correctAnswer) {
        score++;
      }
    });

    const percentage = Math.round((score / totalQuestions) * 100);

    // Save result
    const result = new Result({
      studentName,
      studentEmail,
      quiz: quizId,
      teacher: quiz.teacher,
      answers,
      score,
      totalQuestions,
      percentage
    });

    await result.save();

    res.json({
      message: 'Quiz submitted successfully',
      result: {
        score,
        totalQuestions,
        percentage,
        studentName
      }
    });
  } catch (error) {
    console.error('Error submitting quiz:', error);
    res.status(500).json({ error: 'Server error during submission' });
  }
});

export default router;