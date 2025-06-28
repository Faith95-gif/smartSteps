// Dashboard functionality
let currentTeacher = null;
let questions = [];
let deleteQuizId = null;

document.addEventListener('DOMContentLoaded', function() {
    checkAuth();
    setupTabs();
    setupQuizForm();
    loadQuizzes();
    loadResults();
});

async function checkAuth() {
    try {
        const response = await fetch('/api/auth/status');
        const result = await response.json();
        
        if (!result.authenticated) {
            window.location.href = '/';
            return;
        }
        
        currentTeacher = result.teacher;
        document.getElementById('teacherName').textContent = result.teacher.name;
        document.getElementById('teacherSubject').textContent = result.teacher.subject;
    } catch (error) {
        console.error('Auth check error:', error);
        window.location.href = '/';
    }
}

function setupTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    
    tabBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const targetTab = this.dataset.tab;
            switchTab(targetTab);
        });
    });
}

function switchTab(tabName) {
    // Update active tab button
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabName);
    });
    
    // Update active tab content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.toggle('active', content.id === `${tabName}-tab`);
    });
    
    // Load data for specific tabs
    if (tabName === 'quizzes') {
        loadQuizzes();
    } else if (tabName === 'results') {
        loadResults();
    }
}

function setupQuizForm() {
    const form = document.getElementById('quizForm');
    form.addEventListener('submit', createQuiz);
    
    // Add first question by default
    addQuestion();
}

function addQuestion() {
    const questionIndex = questions.length;
    const questionHtml = `
        <div class="question-item" data-question="${questionIndex}">
            <div class="question-header">
                <h4>Question ${questionIndex + 1}</h4>
                <button type="button" onclick="removeQuestion(${questionIndex})" class="btn btn-danger btn-sm">Remove</button>
            </div>
            
            <div class="form-group">
                <label>Question Text</label>
                <textarea name="question_${questionIndex}" required placeholder="Enter your question here..."></textarea>
            </div>
            
            <div class="options-container">
                <div class="form-group">
                    <label>Option A</label>
                    <input type="text" name="option_${questionIndex}_0" required placeholder="Option A">
                </div>
                <div class="form-group">
                    <label>Option B</label>
                    <input type="text" name="option_${questionIndex}_1" required placeholder="Option B">
                </div>
                <div class="form-group">
                    <label>Option C</label>
                    <input type="text" name="option_${questionIndex}_2" required placeholder="Option C">
                </div>
                <div class="form-group">
                    <label>Option D</label>
                    <input type="text" name="option_${questionIndex}_3" required placeholder="Option D">
                </div>
            </div>
            
            <div class="form-group">
                <label>Correct Answer</label>
                <select name="correct_${questionIndex}" required>
                    <option value="">Select correct answer</option>
                    <option value="0">A</option>
                    <option value="1">B</option>
                    <option value="2">C</option>
                    <option value="3">D</option>
                </select>
            </div>
        </div>
    `;
    
    document.getElementById('questionsContainer').insertAdjacentHTML('beforeend', questionHtml);
    questions.push({ index: questionIndex });
}

function removeQuestion(index) {
    if (questions.length <= 1) {
        showNotification('You must have at least one question', 'error');
        return;
    }
    
    const questionElement = document.querySelector(`[data-question="${index}"]`);
    questionElement.remove();
    
    questions = questions.filter(q => q.index !== index);
    
    // Renumber remaining questions
    renumberQuestions();
}

function renumberQuestions() {
    const questionElements = document.querySelectorAll('.question-item');
    questions = [];
    
    questionElements.forEach((element, index) => {
        element.dataset.question = index;
        element.querySelector('h4').textContent = `Question ${index + 1}`;
        
        // Update form field names
        const textarea = element.querySelector('textarea');
        textarea.name = `question_${index}`;
        
        const inputs = element.querySelectorAll('input[type="text"]');
        inputs.forEach((input, optionIndex) => {
            input.name = `option_${index}_${optionIndex}`;
        });
        
        const select = element.querySelector('select');
        select.name = `correct_${index}`;
        
        // Update remove button
        const removeBtn = element.querySelector('button[onclick*="removeQuestion"]');
        removeBtn.setAttribute('onclick', `removeQuestion(${index})`);
        
        questions.push({ index });
    });
}

async function createQuiz(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const title = formData.get('title');
    const timeLimit = parseInt(formData.get('timeLimit')) || 0;
    
    // Collect questions
    const quizQuestions = [];
    
    for (let i = 0; i < questions.length; i++) {
        const question = formData.get(`question_${i}`);
        const options = [
            formData.get(`option_${i}_0`),
            formData.get(`option_${i}_1`),
            formData.get(`option_${i}_2`),
            formData.get(`option_${i}_3`)
        ];
        const correctAnswer = parseInt(formData.get(`correct_${i}`));
        
        if (!question || options.some(opt => !opt) || isNaN(correctAnswer)) {
            showNotification(`Please complete all fields for Question ${i + 1}`, 'error');
            return;
        }
        
        quizQuestions.push({
            question,
            options,
            correctAnswer
        });
    }
    
    if (quizQuestions.length === 0) {
        showNotification('Please add at least one question', 'error');
        return;
    }
    
    try {
        const response = await fetch('/api/quiz/create', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                title,
                questions: quizQuestions,
                timeLimit
            })
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showNotification('Quiz created successfully!', 'success');
            
            // Reset form
            e.target.reset();
            document.getElementById('questionsContainer').innerHTML = '<h3>Questions</h3>';
            questions = [];
            addQuestion();
            
            // Switch to quizzes tab and reload
            switchTab('quizzes');
        } else {
            showNotification(result.error || 'Failed to create quiz', 'error');
        }
    } catch (error) {
        console.error('Error creating quiz:', error);
        showNotification('Failed to create quiz', 'error');
    }
}

async function loadQuizzes() {
    const container = document.getElementById('quizzesContainer');
    container.innerHTML = '<div class="loading">Loading quizzes...</div>';
    
    try {
        const response = await fetch('/api/quiz/my-quizzes');
        const quizzes = await response.json();
        
        if (response.ok) {
            displayQuizzes(quizzes);
        } else {
            container.innerHTML = '<p>Failed to load quizzes</p>';
        }
    } catch (error) {
        console.error('Error loading quizzes:', error);
        container.innerHTML = '<p>Error loading quizzes</p>';
    }
}

function displayQuizzes(quizzes) {
    const container = document.getElementById('quizzesContainer');
    
    if (quizzes.length === 0) {
        container.innerHTML = `
            <div class="text-center">
                <h3>No quizzes yet</h3>
                <p>Create your first quiz to get started!</p>
                <button onclick="switchTab('create')" class="btn btn-primary">Create Quiz</button>
            </div>
        `;
        return;
    }
    
    container.innerHTML = quizzes.map(quiz => `
        <div class="quiz-card">
            <h3>${quiz.title}</h3>
            <div class="quiz-meta">
                <span>📝 ${quiz.questionCount} questions</span>
                <span>⏱️ ${quiz.timeLimit > 0 ? `${quiz.timeLimit} min` : 'No limit'}</span>
                <span>📅 ${new Date(quiz.createdAt).toLocaleDateString()}</span>
                <span class="${quiz.isActive ? 'text-success' : 'text-error'}">
                    ${quiz.isActive ? '✅ Active' : '❌ Inactive'}
                </span>
            </div>
            
            <div class="quiz-link">
                <strong>Quiz Link:</strong>
                <a href="/quiz/${quiz.id}" target="_blank">${window.location.origin}/quiz/${quiz.id}</a>
            </div>
            
            <div class="quiz-actions">
                <button onclick="viewQuizResults('${quiz.id}')" class="btn btn-primary btn-sm">
                    📊 View Results
                </button>
                <button onclick="toggleQuiz('${quiz.id}', ${quiz.isActive})" class="btn btn-secondary btn-sm">
                    ${quiz.isActive ? '⏸️ Deactivate' : '▶️ Activate'}
                </button>
                <button onclick="deleteQuiz('${quiz.id}')" class="btn btn-danger btn-sm">
                    🗑️ Delete
                </button>
            </div>
        </div>
    `).join('');
}

async function toggleQuiz(quizId, isActive) {
    try {
        const response = await fetch(`/api/quiz/${quizId}/toggle`, {
            method: 'PATCH'
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showNotification(result.message, 'success');
            loadQuizzes();
        } else {
            showNotification(result.error || 'Failed to update quiz', 'error');
        }
    } catch (error) {
        console.error('Error toggling quiz:', error);
        showNotification('Failed to update quiz', 'error');
    }
}

function deleteQuiz(quizId) {
    deleteQuizId = quizId;
    document.getElementById('deleteModal').style.display = 'flex';
}

function closeDeleteModal() {
    document.getElementById('deleteModal').style.display = 'none';
    deleteQuizId = null;
}

async function confirmDelete() {
    if (!deleteQuizId) return;
    
    try {
        const response = await fetch(`/api/quiz/${deleteQuizId}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showNotification('Quiz deleted successfully', 'success');
            loadQuizzes();
            loadResults(); // Refresh results as well
        } else {
            showNotification(result.error || 'Failed to delete quiz', 'error');
        }
    } catch (error) {
        console.error('Error deleting quiz:', error);
        showNotification('Failed to delete quiz', 'error');
    }
    
    closeDeleteModal();
}

async function viewQuizResults(quizId) {
    try {
        const response = await fetch(`/api/quiz/${quizId}/results`);
        const data = await response.json();
        
        if (response.ok) {
            displayQuizResults(data);
            switchTab('results');
        } else {
            showNotification(data.error || 'Failed to load results', 'error');
        }
    } catch (error) {
        console.error('Error loading quiz results:', error);
        showNotification('Failed to load results', 'error');
    }
}

async function loadResults() {
    const container = document.getElementById('resultsContainer');
    container.innerHTML = '<div class="loading">Loading results...</div>';
    
    try {
        const response = await fetch('/api/quiz/all-results');
        const results = await response.json();
        
        if (response.ok) {
            displayAllResults(results);
        } else {
            container.innerHTML = '<p>Failed to load results</p>';
        }
    } catch (error) {
        console.error('Error loading results:', error);
        container.innerHTML = '<p>Error loading results</p>';
    }
}

function displayAllResults(resultsData) {
    const container = document.getElementById('resultsContainer');
    
    if (resultsData.length === 0) {
        container.innerHTML = `
            <div class="text-center">
                <h3>No results yet</h3>
                <p>Results will appear here once students start taking your quizzes.</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = resultsData.map(quizData => `
        <div class="results-container">
            <div class="quiz-results-header">
                <h3>${quizData.quiz.title}</h3>
                <div class="quiz-stats">
                    <span>📊 ${quizData.submissionCount} submissions</span>
                    <span>📈 ${quizData.averageScore}% average</span>
                    <span>📅 ${new Date(quizData.quiz.createdAt).toLocaleDateString()}</span>
                </div>
            </div>
            
            <table class="results-table">
                <thead>
                    <tr>
                        <th>Student Name</th>
                        <th>Email</th>
                        <th>Score</th>
                        <th>Percentage</th>
                        <th>Time Spent</th>
                        <th>Submitted</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${quizData.submissions.map(submission => `
                        <tr>
                            <td>${submission.studentName}</td>
                            <td>${submission.studentEmail}</td>
                            <td>${submission.score}/${submission.totalQuestions}</td>
                            <td>
                                <span class="score-badge ${getScoreClass(submission.percentage)}">
                                    ${submission.percentage}%
                                </span>
                            </td>
                            <td>${formatTimeSpent(submission.timeSpent)}</td>
                            <td>${new Date(submission.submittedAt).toLocaleString()}</td>
                            <td>
                                <button onclick="viewCorrection('${submission.id}')" class="btn btn-primary btn-sm">
                                    📝 View Correction
                                </button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `).join('');
}

function displayQuizResults(data) {
    const container = document.getElementById('resultsContainer');
    
    if (data.submissions.length === 0) {
        container.innerHTML = `
            <div class="text-center">
                <h3>No submissions for "${data.quiz.title}"</h3>
                <p>Students haven't taken this quiz yet.</p>
            </div>
        `;
        return;
    }
    
    const averageScore = Math.round(
        data.submissions.reduce((acc, sub) => acc + sub.percentage, 0) / data.submissions.length
    );
    
    container.innerHTML = `
        <div class="results-container">
            <div class="quiz-results-header">
                <h3>${data.quiz.title} - Results</h3>
                <div class="quiz-stats">
                    <span>📊 ${data.submissions.length} submissions</span>
                    <span>📈 ${averageScore}% average</span>
                    <span>📝 ${data.quiz.questionCount} questions</span>
                    <span>⏱️ ${data.quiz.timeLimit > 0 ? `${data.quiz.timeLimit} min` : 'No limit'}</span>
                </div>
            </div>
            
            <table class="results-table">
                <thead>
                    <tr>
                        <th>Student Name</th>
                        <th>Email</th>
                        <th>Score</th>
                        <th>Percentage</th>
                        <th>Time Spent</th>
                        <th>Submitted</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.submissions.map(submission => `
                        <tr>
                            <td>${submission.studentName}</td>
                            <td>${submission.studentEmail}</td>
                            <td>${submission.score}/${submission.totalQuestions}</td>
                            <td>
                                <span class="score-badge ${getScoreClass(submission.percentage)}">
                                    ${submission.percentage}%
                                </span>
                            </td>
                            <td>${formatTimeSpent(submission.timeSpent)}</td>
                            <td>${new Date(submission.submittedAt).toLocaleString()}</td>
                            <td>
                                <button onclick="viewCorrection('${submission.id}')" class="btn btn-primary btn-sm">
                                    📝 View Correction
                                </button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

function getScoreClass(percentage) {
    if (percentage >= 80) return 'score-excellent';
    if (percentage >= 60) return 'score-good';
    return 'score-needs-improvement';
}

function formatTimeSpent(seconds) {
    if (!seconds) return 'N/A';
    
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    
    if (minutes > 0) {
        return `${minutes}m ${remainingSeconds}s`;
    }
    return `${remainingSeconds}s`;
}

function viewCorrection(submissionId) {
    window.open(`/correction.html?submission=${submissionId}`, '_blank');
}

async function refreshResults() {
    await loadResults();
    showNotification('Results refreshed', 'success');
}

async function logout() {
    try {
        const response = await fetch('/api/auth/logout', {
            method: 'POST'
        });
        
        if (response.ok) {
            window.location.href = '/';
        } else {
            showNotification('Logout failed', 'error');
        }
    } catch (error) {
        console.error('Logout error:', error);
        showNotification('Logout failed', 'error');
    }
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