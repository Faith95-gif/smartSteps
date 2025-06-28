// Quiz taking functionality
let currentQuiz = null;
let currentQuestionIndex = 0;
let studentAnswers = [];
let studentInfo = null;
let quizTimer = null;
let timeRemaining = 0;

document.addEventListener('DOMContentLoaded', function() {
    const quizId = window.location.pathname.split('/').pop();
    loadQuiz(quizId);
    
    // Initialize student form
    document.getElementById('studentForm').addEventListener('submit', startQuiz);
    
    // Initialize time up modal
    document.getElementById('timeUpOkBtn').addEventListener('click', function() {
        document.getElementById('timeUpModal').style.display = 'none';
    });
});

async function loadQuiz(quizId) {
    try {
        const response = await fetch(`/api/quiz/${quizId}`);
        const quiz = await response.json();
        
        if (response.ok) {
            currentQuiz = quiz;
            displayQuizInfo(quiz);
        } else {
            showNotification(quiz.error || 'Quiz not found', 'error');
            document.getElementById('quizInfo').innerHTML = '<h2>Quiz not available</h2>';
        }
    } catch (error) {
        console.error('Error loading quiz:', error);
        showNotification('Error loading quiz', 'error');
    }
}

function displayQuizInfo(quiz) {
    document.getElementById('quizTitle').textContent = quiz.title;
    document.getElementById('quizSubject').textContent = quiz.subject;
    document.getElementById('teacherName').textContent = `Teacher: ${quiz.teacher.name}`;
    
    // Display time limit info if available
    if (quiz.timeLimit && quiz.timeLimit > 0) {
        const timeInfo = document.getElementById('timeInfo');
        const timeLimit = document.getElementById('timeLimit');
        timeLimit.textContent = quiz.timeLimit;
        timeInfo.style.display = 'inline-block';
    }
}

function startQuiz(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    studentInfo = {
        name: formData.get('studentName'),
        email: formData.get('studentEmail')
    };
    
    if (!studentInfo.name || !studentInfo.email) {
        showNotification('Please fill in all required fields', 'error');
        return;
    }
    
    if (!currentQuiz || !currentQuiz.questions || currentQuiz.questions.length === 0) {
        showNotification('No questions available for this quiz', 'error');
        return;
    }
    
    // Initialize answers array
    studentAnswers = new Array(currentQuiz.questions.length).fill(null);
    currentQuestionIndex = 0;
    
    // Hide student form and show quiz questions
    document.getElementById('studentInfoForm').style.display = 'none';
    document.getElementById('quizQuestions').style.display = 'block';
    
    // Start timer if quiz has time limit
    if (currentQuiz.timeLimit && currentQuiz.timeLimit > 0) {
        startTimer(currentQuiz.timeLimit);
    }
    
    // Render questions
    renderQuestions();
    updateProgress();
    
    // Initialize navigation
    setupNavigation();
    
    showNotification('Quiz started! Good luck!', 'success');
}

function startTimer(timeLimitMinutes) {
    timeRemaining = timeLimitMinutes * 60; // Convert to seconds
    const timerDisplay = document.getElementById('timerDisplay');
    const timerValue = document.getElementById('timerValue');
    
    timerDisplay.style.display = 'block';
    
    quizTimer = setInterval(() => {
        timeRemaining--;
        
        const minutes = Math.floor(timeRemaining / 60);
        const seconds = timeRemaining % 60;
        
        timerValue.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        // Change color when time is running low
        if (timeRemaining <= 300) { // 5 minutes
            timerValue.classList.add('timer-warning');
        }
        if (timeRemaining <= 60) { // 1 minute
            timerValue.classList.add('timer-critical');
        }
        
        // Auto-submit when time is up
        if (timeRemaining <= 0) {
            clearInterval(quizTimer);
            showTimeUpModal();
        }
    }, 1000);
}

function showTimeUpModal() {
    const modal = document.getElementById('timeUpModal');
    modal.style.display = 'flex';
    
    // Auto-submit after showing modal
    setTimeout(() => {
        modal.style.display = 'none';
        submitQuiz(true); // true indicates auto-submit due to time up
    }, 3000);
}

function renderQuestions() {
    const container = document.getElementById('questionsContainer');
    
    if (!currentQuiz.questions || currentQuiz.questions.length === 0) {
        container.innerHTML = '<p>No questions available</p>';
        return;
    }
    
    container.innerHTML = currentQuiz.questions.map((question, index) => `
        <div class="question-container ${index === 0 ? 'active' : ''}" data-question="${index}">
            <div class="question-text">
                <strong>Question ${index + 1}:</strong> ${question.question}
            </div>
            <div class="options-list">
                ${question.options.map((option, optionIndex) => `
                    <div class="option-item">
                        <label class="option-label">
                            <input type="radio" name="question_${index}" value="${optionIndex}" 
                                   ${studentAnswers[index] === optionIndex ? 'checked' : ''}>
                            <span class="option-text">${String.fromCharCode(65 + optionIndex)}. ${option}</span>
                        </label>
                    </div>
                `).join('')}
            </div>
        </div>
    `).join('');
    
    // Add event listeners for answer selection
    container.addEventListener('change', function(e) {
        if (e.target.type === 'radio') {
            const questionIndex = parseInt(e.target.name.split('_')[1]);
            const answerIndex = parseInt(e.target.value);
            studentAnswers[questionIndex] = answerIndex;
            updateNavigation();
            
            // Visual feedback
            const questionContainer = e.target.closest('.question-container');
            questionContainer.classList.add('answered');
        }
    });
}

function setupNavigation() {
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    const submitBtn = document.getElementById('submitBtn');
    
    // Remove existing event listeners
    prevBtn.replaceWith(prevBtn.cloneNode(true));
    nextBtn.replaceWith(nextBtn.cloneNode(true));
    submitBtn.replaceWith(submitBtn.cloneNode(true));
    
    // Get fresh references
    const newPrevBtn = document.getElementById('prevBtn');
    const newNextBtn = document.getElementById('nextBtn');
    const newSubmitBtn = document.getElementById('submitBtn');
    
    newPrevBtn.addEventListener('click', () => {
        if (currentQuestionIndex > 0) {
            currentQuestionIndex--;
            showQuestion(currentQuestionIndex);
        }
    });
    
    newNextBtn.addEventListener('click', () => {
        if (currentQuestionIndex < currentQuiz.questions.length - 1) {
            currentQuestionIndex++;
            showQuestion(currentQuestionIndex);
        }
    });
    
    newSubmitBtn.addEventListener('click', () => submitQuiz(false));
    
    updateNavigation();
}

function showQuestion(index) {
    const questions = document.querySelectorAll('.question-container');
    
    questions.forEach((question, i) => {
        question.classList.toggle('active', i === index);
    });
    
    currentQuestionIndex = index;
    updateProgress();
    updateNavigation();
}

function updateProgress() {
    const progress = ((currentQuestionIndex + 1) / currentQuiz.questions.length) * 100;
    document.getElementById('progressFill').style.width = `${progress}%`;
    document.getElementById('progressText').textContent = 
        `Question ${currentQuestionIndex + 1} of ${currentQuiz.questions.length}`;
    
    // Update percentage
    const progressPercentage = document.querySelector('.progress-percentage');
    progressPercentage.textContent = `${Math.round(progress)}%`;
}

function updateNavigation() {
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    const submitBtn = document.getElementById('submitBtn');
    
    // Show/hide previous button
    prevBtn.style.display = currentQuestionIndex > 0 ? 'inline-block' : 'none';
    
    // Show/hide next and submit buttons
    if (currentQuestionIndex === currentQuiz.questions.length - 1) {
        nextBtn.style.display = 'none';
        submitBtn.style.display = 'inline-block';
    } else {
        nextBtn.style.display = 'inline-block';
        submitBtn.style.display = 'none';
    }
}

async function submitQuiz(isAutoSubmit = false) {
    // Clear timer if running
    if (quizTimer) {
        clearInterval(quizTimer);
    }
    
    // Check if all questions are answered (only if not auto-submit)
    if (!isAutoSubmit) {
        const unansweredQuestions = studentAnswers.filter(answer => answer === null).length;
        
        if (unansweredQuestions > 0) {
            const confirm = window.confirm(
                `You have ${unansweredQuestions} unanswered question(s). Submit anyway?`
            );
            if (!confirm) return;
        }
    }
    
    // Show loading state
    const submitBtn = document.getElementById('submitBtn');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Submitting...';
    submitBtn.disabled = true;
    
    // Prepare submission data
    const submissionData = {
        studentName: studentInfo.name,
        studentEmail: studentInfo.email,
        answers: studentAnswers.map((answer, index) => ({
            questionIndex: index,
            selectedAnswer: answer
        }))
    };
    
    try {
        const quizId = window.location.pathname.split('/').pop();
        const response = await fetch(`/api/student/submit/${quizId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(submissionData)
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showResults(result.result);
            if (isAutoSubmit) {
                showNotification('Quiz auto-submitted due to time limit!', 'warning');
            }
        } else {
            showNotification(result.error || 'Submission failed', 'error');
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        }
    } catch (error) {
        console.error('Error submitting quiz:', error);
        showNotification('Submission failed. Please try again.', 'error');
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
    }
}

function showResults(result) {
    // Hide quiz questions and show results
    document.getElementById('quizQuestions').style.display = 'none';
    document.getElementById('quizResults').style.display = 'block';
    
    // Update results display
    document.getElementById('scorePercentage').textContent = `${result.percentage}%`;
    document.getElementById('scoreText').textContent = `${result.score} out of ${result.totalQuestions}`;
    document.getElementById('studentNameDisplay').textContent = `Great job, ${result.studentName}!`;
    
    // Add performance message
    const performanceMessage = document.getElementById('performanceMessage');
    if (result.percentage >= 90) {
        performanceMessage.textContent = '🌟 Outstanding performance!';
        performanceMessage.className = 'performance-message excellent';
    } else if (result.percentage >= 80) {
        performanceMessage.textContent = '🎉 Great job!';
        performanceMessage.className = 'performance-message good';
    } else if (result.percentage >= 60) {
        performanceMessage.textContent = '👍 Good effort!';
        performanceMessage.className = 'performance-message average';
    } else {
        performanceMessage.textContent = '📚 Keep practicing!';
        performanceMessage.className = 'performance-message needs-improvement';
    }
    
    // Update score circle color based on performance
    const scoreCircle = document.querySelector('.score-circle');
    const percentage = result.percentage;
    
    let color = '#ef4444'; // Red for low scores
    if (percentage >= 80) {
        color = '#10b981'; // Green for excellent
    } else if (percentage >= 60) {
        color = '#f59e0b'; // Orange for good
    }
    
    scoreCircle.style.setProperty('--score-color', color);
    
    // Animate the score circle
    setTimeout(() => {
        const degrees = (percentage / 100) * 360;
        scoreCircle.style.background = `conic-gradient(
            ${color} ${degrees}deg, 
            #e5e7eb ${degrees}deg
        )`;
    }, 500);
    
    showNotification('Quiz submitted successfully!', 'success');
    
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showNotification(message, type = 'success') {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.className = `notification ${type}`;
    notification.classList.add('show');
    
    setTimeout(() => {
        notification.classList.remove('show');
    }, 4000);
}