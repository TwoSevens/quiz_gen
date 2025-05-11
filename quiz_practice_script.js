const quizArea = document.getElementById('quizArea');
const resultsArea = document.getElementById('resultsArea');
const noQuizMessage = document.getElementById('noQuizMessage');

const quizTitleEl = document.getElementById('quizTitle');
const questionNumberEl = document.getElementById('questionNumber');
const questionTextEl = document.getElementById('questionText');
const optionsListEl = document.getElementById('optionsList');
const feedbackAreaEl = document.getElementById('feedbackArea');
const explanationAreaEl = document.getElementById('explanationArea');
const nextQuestionBtn = document.getElementById('nextQuestionBtn');
const scoreTextEl = document.getElementById('scoreText');
const percentageTextEl = document.getElementById('percentageText');
const restartQuizBtn = document.getElementById('restartQuizBtn');
const retryQuizBtn = document.getElementById('retryQuizBtn'); // Get reference to the new button
const progressBarEl = document.getElementById('progressBar');

let quizData = null;
let currentQuestionIndex = 0;
let score = 0;
let answerSubmitted = false;

function loadQuizData() {
    const urlParams = new URLSearchParams(window.location.search);
    const encodedQuizData = urlParams.get('quizData');

    if (!encodedQuizData) {
        quizArea.style.display = 'none';
        resultsArea.style.display = 'none';
        noQuizMessage.style.display = 'block';
        console.error("No quiz data found in URL.");
        return false;
    }

    try {
        const decodedQuizData = decodeURIComponent(encodedQuizData);
        quizData = JSON.parse(decodedQuizData);

        if (!quizData || !quizData.questions || quizData.questions.length === 0) {
            throw new Error("Invalid or empty quiz data.");
        }
        quizArea.style.display = 'block';
        noQuizMessage.style.display = 'none';
        return true;
    } catch (error) {
        console.error("Error loading or parsing quiz data:", error);
        quizArea.style.display = 'none';
        resultsArea.style.display = 'none';
        noQuizMessage.style.display = 'block';
        noQuizMessage.innerHTML += `<p>Error details: ${error.message}. Please try generating the quiz again.</p>`;
        return false;
    }
}

function displayQuestion() {
    answerSubmitted = false;
    const question = quizData.questions[currentQuestionIndex];
    quizTitleEl.textContent = quizData.quizTitle || "Practice Quiz";
    questionNumberEl.textContent = `Question ${currentQuestionIndex + 1} of ${quizData.questions.length}`;
    questionTextEl.textContent = question.questionText;

    optionsListEl.innerHTML = ''; // Clear previous options
    question.options.forEach(option => {
        const li = document.createElement('li');
        li.textContent = `${option.id.toUpperCase()}. ${option.text}`;
        li.dataset.optionId = option.id;
        li.addEventListener('click', handleOptionSelect);
        optionsListEl.appendChild(li);
    });

    feedbackAreaEl.style.display = 'none';
    explanationAreaEl.style.display = 'none';
    nextQuestionBtn.style.display = 'none';
    updateProgressBar();
}

function handleOptionSelect(event) {
    if (answerSubmitted) return; // Don't allow changing answer after submission

    const selectedLi = event.target.closest('li');
    if (!selectedLi) return;

    answerSubmitted = true;
    const selectedOptionId = selectedLi.dataset.optionId;
    const question = quizData.questions[currentQuestionIndex];
    const correctOptionId = question.correctOptionId;

    // Remove 'selected' from all, then add to the clicked one
    Array.from(optionsListEl.children).forEach(li => li.classList.remove('selected'));
    selectedLi.classList.add('selected');


    if (selectedOptionId === correctOptionId) {
        score++;
        selectedLi.classList.add('correct');
        feedbackAreaEl.textContent = "Correct!";
        feedbackAreaEl.className = 'feedback correct';
    } else {
        selectedLi.classList.add('incorrect');
        feedbackAreaEl.textContent = "Incorrect!";
        feedbackAreaEl.className = 'feedback incorrect';

        // Highlight the correct answer as well
        const correctLi = optionsListEl.querySelector(`li[data-option-id="${correctOptionId}"]`);
        if (correctLi) {
            correctLi.classList.add('correct');
        }
    }

    feedbackAreaEl.style.display = 'block';
    if (question.explanation) {
        explanationAreaEl.textContent = `Explanation: ${question.explanation}`;
        explanationAreaEl.style.display = 'block';
    }

    // Disable further clicks on options
    Array.from(optionsListEl.children).forEach(li => {
        li.removeEventListener('click', handleOptionSelect); // remove old one
        li.style.cursor = 'default'; // Change cursor to indicate non-interactivity
    });


    nextQuestionBtn.style.display = 'inline-block';
    if (currentQuestionIndex >= quizData.questions.length - 1) {
        nextQuestionBtn.textContent = "Show Results";
    } else {
        nextQuestionBtn.textContent = "Next Question";
    }
}

function updateProgressBar() {
    const progress = ((currentQuestionIndex) / quizData.questions.length) * 100;
    progressBarEl.style.width = `${progress}%`;
    progressBarEl.textContent = `${Math.round(progress)}%`;
}

nextQuestionBtn.addEventListener('click', () => {
    currentQuestionIndex++;
    if (currentQuestionIndex < quizData.questions.length) {
        displayQuestion();
    } else {
        showResults();
    }
});

function showResults() {
    quizArea.style.display = 'none';
    resultsArea.style.display = 'block';
    const totalQuestions = quizData.questions.length;
    const percentage = totalQuestions > 0 ? Math.round((score / totalQuestions) * 100) : 0;

    scoreTextEl.textContent = `Your score: ${score} / ${totalQuestions}`;
    percentageTextEl.textContent = `Percentage: ${percentage}%`;

    // Final progress bar update to 100%
    // We don't need to show the progress bar on the results screen,
    // but if it were visible, this would be correct.
    // It will be reset correctly when the quiz is retried.
}

restartQuizBtn.addEventListener('click', () => {
    // Go back to the generator page (assuming it's index.html)
    window.location.href = "index.html";
});

// Event listener for the new Retry button
retryQuizBtn.addEventListener('click', () => {
    // Reset quiz state
    currentQuestionIndex = 0;
    score = 0;
    answerSubmitted = false; // Though displayQuestion will also set this

    // Hide results, show quiz area
    resultsArea.style.display = 'none';
    quizArea.style.display = 'block';

    // Display the first question
    displayQuestion();
    // The progress bar will be updated by displayQuestion -> updateProgressBar
});


// Initialize
if (loadQuizData()) {
    displayQuestion();
}