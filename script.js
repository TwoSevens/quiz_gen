const apiKeyInput = document.getElementById('apiKeyInput');
const fileInput = document.getElementById('fileInput');
const instructionsInput = document.getElementById('instructionsInput');
const generateBtn = document.getElementById('generateBtn');
const loadingIndicator = document.getElementById('loadingIndicator');
const outputBlock = document.getElementById('outputBlock');
const jsonOutput = document.getElementById('jsonOutput');
const downloadBtn = document.getElementById('downloadBtn');
const copyBtn = document.getElementById('copyBtn');
const practiceQuizBtn = document.getElementById('practiceQuizBtn');

// New elements for uploading existing JSON
const uploadJsonFileInput = document.getElementById('uploadJsonFileInput');
const practiceUploadedJsonBtn = document.getElementById('practiceUploadedJsonBtn');

let generatedJsonData = null;

/**
 * Reads a file and returns its base64 encoded content and MIME type.
 * @param {File} file The file to read.
 * @returns {Promise<{base64Data: string, mimeType: string}>}
 */
async function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            const result = event.target.result;
            const base64Data = result.split(',')[1];
            resolve({ base64Data, mimeType: file.type });
        };
        reader.onerror = (error) => reject(error);
        reader.readAsDataURL(file);
    });
}

/**
 * Reads a file and returns its content as text.
 * @param {File} file The file to read.
 * @returns {Promise<string>}
 */
async function readFileAsText(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => resolve(event.target.result);
        reader.onerror = (error) => reject(error);
        reader.readAsText(file);
    });
}

/**
 * Validates the structure of the quiz JSON data.
 * Throws an error if validation fails.
 * @param {object} quizData The quiz data object to validate.
 */
function validateQuizJsonData(quizData) {
    if (!quizData || typeof quizData !== 'object') {
        throw new Error("Invalid JSON: Data is not an object.");
    }
    if (typeof quizData.quizTitle !== 'string' || !quizData.quizTitle.trim()) {
        throw new Error("Invalid JSON: Missing or empty 'quizTitle'.");
    }
    if (!Array.isArray(quizData.questions) || quizData.questions.length === 0) {
        throw new Error("Invalid JSON: 'questions' must be a non-empty array.");
    }

    for (let i = 0; i < quizData.questions.length; i++) {
        const q = quizData.questions[i];
        if (typeof q !== 'object' || q === null) {
            throw new Error(`Invalid JSON: Question at index ${i} is not an object.`);
        }
        // As per prompt: "id": 1, // Integer ID
        if (typeof q.id !== 'number' || !Number.isInteger(q.id)) {
            throw new Error(`Invalid JSON: Question at index ${i} 'id' must be an integer (e.g., 1, 2).`);
        }
        if (typeof q.questionText !== 'string' || !q.questionText.trim()) {
            throw new Error(`Invalid JSON: Question at index ${i} is missing or empty 'questionText'.`);
        }
        if (!Array.isArray(q.options) || q.options.length < 2) { // At least 2 options
            throw new Error(`Invalid JSON: Question at index ${i} must have at least 2 'options' in an array.`);
        }
        const optionIds = new Set(); // To check for duplicate option IDs and existence of correctOptionId
        for (let j = 0; j < q.options.length; j++) {
            const opt = q.options[j];
            if (typeof opt !== 'object' || opt === null) {
                throw new Error(`Invalid JSON: Option at index ${j} for question ${i} is not an object.`);
            }
            // As per prompt: { "id": "a", "text": "..." }
            if (typeof opt.id !== 'string' || !opt.id.trim()) {
                throw new Error(`Invalid JSON: Option 'id' at index ${j} for question ${i} must be a non-empty string (e.g., "a", "b").`);
            }
            if (optionIds.has(opt.id)) {
                 throw new Error(`Invalid JSON: Duplicate option 'id' ("${opt.id}") found for question ${i}. Option IDs must be unique within a question.`);
            }
            optionIds.add(opt.id);
            if (typeof opt.text !== 'string' || !opt.text.trim()) {
                throw new Error(`Invalid JSON: Option 'text' at index ${j} for question ${i} is missing or empty.`);
            }
        }
        // As per prompt: "correctOptionId": "b", // The 'id' of the correct option
        if (typeof q.correctOptionId !== 'string' || !q.correctOptionId.trim()) {
             throw new Error(`Invalid JSON: Question at index ${i} 'correctOptionId' must be a non-empty string.`);
        }
        if (!optionIds.has(q.correctOptionId)) {
            throw new Error(`Invalid JSON: 'correctOptionId' ("${q.correctOptionId}") for question ${i} does not match any available option IDs (${Array.from(optionIds).join(', ')}).`);
        }
        if (typeof q.explanation !== 'string' || !q.explanation.trim()) {
            throw new Error(`Invalid JSON: Question at index ${i} is missing or empty 'explanation'.`);
        }
    }
    // If all checks pass, no error is thrown.
}


generateBtn.addEventListener('click', async () => {
    const apiKey = apiKeyInput.value.trim();
    if (!apiKey) {
        alert("Please enter your Google AI API Key.");
        return;
    }

    const file = fileInput.files[0];
    const instructions = instructionsInput.value.trim();

    if (!instructions && !file) {
        alert("Please provide some instructions or upload a file for context.");
        return;
    }

    loadingIndicator.style.display = 'inline';
    generateBtn.disabled = true;
    outputBlock.style.display = 'none';
    jsonOutput.value = '';
    downloadBtn.disabled = true;
    copyBtn.disabled = true;
    practiceQuizBtn.disabled = true;
    generatedJsonData = null;

    const apiParts = [];
    let fileDetailsForPrompt = "No file provided.";

    if (file) {
        try {
            const { base64Data, mimeType } = await readFileAsBase64(file);
            apiParts.push({
                inlineData: {
                    mimeType: mimeType,
                    data: base64Data
                }
            });
            fileDetailsForPrompt = `A file named '${file.name}' (type: ${mimeType}) has been uploaded. Please use its content as the primary context for the quiz.`;
            console.log(`File '${file.name}' prepared for API upload.`);
        } catch (error) {
            console.error("Error reading file for API upload:", error);
            alert(`Error processing file '${file.name}': ${error.message}. Quiz generation will proceed without file context.`);
            fileDetailsForPrompt = `Error processing file: ${file.name}. Proceeding without file context.`;
        }
    }

    const promptText = `
You are an expert MCQ (Multiple Choice Question) quiz generator AI. Your primary goal is to create high-quality, accurate, and engaging quizzes.

Your task is to generate a Multiple Choice Question (MCQ) quiz based on the provided context (from an uploaded file, if any) and specific user instructions.

The output MUST be a single, valid JSON object. Do not include any explanatory text, comments, or markdown backticks (like \`\`\`json or \`\`\`) before or after the JSON block. Ensure the JSON is perfectly parsable.

The JSON structure MUST be exactly as follows:
{
  "quizTitle": "Quiz based on [Source/Topic derived from context or instructions]",
  "questions": [
    {
      "id": 1,
      "questionText": "What is the core concept discussed in section X?",
      "options": [
        { "id": "a", "text": "Plausible but incorrect option A" },
        { "id": "b", "text": "Correct Option B" },
        { "id": "c", "text": "Plausible but incorrect option C" },
        { "id": "d", "text": "Another plausible distractor D" }
      ],
      "correctOptionId": "b",
      "explanation": "A brief, clear explanation for why the answer is correct, and optionally why other options might be incorrect. This should reinforce learning."
    }
  ]
}

--- FILE CONTEXT ---
${fileDetailsForPrompt}
If a file was uploaded and successfully processed, prioritize its content for generating the quiz questions. If file processing failed or no file was provided, rely solely on the user instructions.

--- USER INSTRUCTIONS ---
${instructions || "Generate a general knowledge quiz with about 3-5 questions. Ensure questions are clear, options are distinct, and provide good explanations."}
---

Important Considerations for Quiz Generation:
1.  **Accuracy:** Ensure all questions and correct answers are factually accurate based on the provided context or reliable general knowledge.
2.  **Clarity:** Questions should be unambiguous and easy to understand.
3.  **Plausible Distractors:** Incorrect options should be plausible yet clearly wrong to a knowledgeable person. Avoid trick questions or overly obscure options unless specified.
4.  **Balanced Coverage:** If the context is rich, try to cover different aspects of it.
5.  **Number of Questions:** Adhere to the number of questions specified in user instructions. If not specified, generate 3-5 questions. Question IDs should be sequential integers starting from 1.
6.  **Explanations:** Provide concise and informative explanations for each correct answer. This is crucial.
7.  **JSON Format:** Strictly adhere to the specified JSON format including data types (e.g., question id as integer, option ids as strings). No extra text outside the JSON block.

Generate the quiz now. Output ONLY the single, valid JSON object as specified.
`;

    apiParts.unshift({ text: promptText });

    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`; // Updated to a common model

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [{ parts: apiParts }],
                generationConfig: {
                    responseMimeType: "application/json",
                    temperature: 0.5,
                    maxOutputTokens: 8192,
                }
            }),
        });

        if (!response.ok) {
            let errorData;
            try {
                errorData = await response.json();
            } catch (e) {
                errorData = { error: { message: await response.text() || "Unknown error during API response processing." } };
            }
            console.error("API Error Response:", errorData);
            throw new Error(`API Error: ${response.status} ${response.statusText}. ${errorData.error?.message || ''}`);
        }

        const data = await response.json();
        console.log("Raw API Response:", data);

        if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts[0]) {
            let aiOutputPart = data.candidates[0].content.parts[0];
            let jsonString;

            if (typeof aiOutputPart.text === 'string') {
                jsonString = aiOutputPart.text;
            } else if (typeof aiOutputPart === 'object' && aiOutputPart.text === undefined) {
                jsonString = JSON.stringify(aiOutputPart);
            } else {
                console.warn("AI response part was not a direct string or expected object, attempting to stringify candidate content:", data.candidates[0].content);
                jsonString = JSON.stringify(data.candidates[0].content.parts[0]);
            }

            jsonString = jsonString.replace(/^```json\s*/, '').replace(/\s*```$/, '').trim();

            try {
                generatedJsonData = JSON.parse(jsonString);
                validateQuizJsonData(generatedJsonData); // Use the centralized validation function

                jsonOutput.value = JSON.stringify(generatedJsonData, null, 2);
                outputBlock.style.display = 'block';
                downloadBtn.disabled = false;
                copyBtn.disabled = false;
                practiceQuizBtn.disabled = false;
            } catch (validationOrParseError) {
                console.error("Error parsing JSON from AI or validating structure:", validationOrParseError);
                const errorMessage = `Error: AI did not return valid/expected JSON format.\nReason: ${validationOrParseError.message}\n\nRaw AI output (if available):\n${jsonString || 'N/A'}`;
                jsonOutput.value = errorMessage;
                outputBlock.style.display = 'block'; // Show the output block to display the error
                downloadBtn.disabled = true;
                copyBtn.disabled = false; // Allow copying the error message
                practiceQuizBtn.disabled = true;
                alert(`Error: AI response was not valid JSON or had an unexpected structure. ${validationOrParseError.message}`);
                generatedJsonData = null;
            }
        } else if (data.promptFeedback && data.promptFeedback.blockReason) {
            const blockReason = data.promptFeedback.blockReason;
            const safetyRatingsDetails = data.promptFeedback.safetyRatings ? data.promptFeedback.safetyRatings.map(r => `${r.category}: ${r.probability}`).join(', ') : 'No specific safety rating details.';
            jsonOutput.value = `Error: Prompt was blocked by the API.\nReason: ${blockReason}.\nDetails: ${safetyRatingsDetails}`;
            outputBlock.style.display = 'block';
            copyBtn.disabled = false; // Allow copying error
            alert(`Error: Prompt was blocked by the API. Reason: ${blockReason}.`);
            console.log("Prompt Feedback:", data.promptFeedback);
        } else {
            console.error("Unexpected API response structure:", data);
            jsonOutput.value = "Error: Unexpected response structure from AI. Check console for the full API response.";
            outputBlock.style.display = 'block';
            copyBtn.disabled = false; // Allow copying error
            alert("Error: Unexpected response structure from AI. The AI might not have generated any content.");
        }

    } catch (error) {
        console.error("Error during API call or processing:", error);
        jsonOutput.value = `An error occurred: ${error.message}\nCheck the browser console for more details.`;
        outputBlock.style.display = 'block';
        copyBtn.disabled = false; // Allow copying error
        alert(`An error occurred: ${error.message}`);
    } finally {
        loadingIndicator.style.display = 'none';
        generateBtn.disabled = false;
    }
});


downloadBtn.addEventListener('click', () => {
    if (!generatedJsonData) return;
    const jsonString = JSON.stringify(generatedJsonData, null, 2);
    const blob = new Blob([jsonString], {
        type: 'application/json'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    let filename = 'ai_generated_quiz.json';
    if (generatedJsonData.quizTitle) {
        filename = generatedJsonData.quizTitle.replace(/[^a-z0-9_-\s]/gi, '').replace(/\s+/g, '_').toLowerCase() + '_quiz.json';
        if (filename.length < 10 || filename.length > 100) {
            filename = 'ai_generated_quiz.json';
        }
    }
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
});

copyBtn.addEventListener('click', () => {
    if (!jsonOutput.value) return;
    jsonOutput.select();
    jsonOutput.setSelectionRange(0, 99999);
    try {
        const successful = document.execCommand('copy');
        if (successful) {
            alert('Successfully copied to clipboard!');
        } else {
            // Attempt to use navigator.clipboard as a fallback
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(jsonOutput.value).then(() => {
                    alert('Successfully copied to clipboard!');
                }).catch(err => {
                    console.error('Fallback copy to clipboard failed: ', err);
                    alert('Oops, unable to copy. Your browser might not support this action or there was an issue.');
                });
            } else {
                alert('Oops, unable to copy. Your browser might not support this action or there was an issue.');
            }
        }
    } catch (err) {
        console.error('Copy to clipboard failed: ', err);
        alert('Oops, unable to copy.');
    }
    window.getSelection().removeAllRanges();
});

practiceQuizBtn.addEventListener('click', () => {
    if (!generatedJsonData) {
        alert("No quiz data available to practice. Please generate a quiz first.");
        return;
    }
    try {
        // Ensure the data to be passed is valid before navigating
        validateQuizJsonData(generatedJsonData); // Re-validate just in case
        const quizDataString = JSON.stringify(generatedJsonData);
        const encodedQuizData = encodeURIComponent(quizDataString);
        window.location.href = `quiz_practice.html?quizData=${encodedQuizData}`;
    } catch (error) {
        alert("Error preparing quiz data for practice: " + error.message);
        console.error("Error stringifying, encoding or validating quiz data for practice:", error);
    }
});

// Event listener for practicing an uploaded JSON quiz
practiceUploadedJsonBtn.addEventListener('click', async () => {
    const file = uploadJsonFileInput.files[0];

    if (!file) {
        alert("Please select a JSON quiz file to upload.");
        return;
    }

    if (!file.name.toLowerCase().endsWith('.json') && file.type !== 'application/json') {
        alert("Invalid file type. Please upload a .json file.");
        uploadJsonFileInput.value = ''; // Clear the input
        return;
    }

    try {
        const fileContent = await readFileAsText(file);
        let uploadedQuizData;

        try {
            uploadedQuizData = JSON.parse(fileContent);
        } catch (parseError) {
            console.error("Error parsing uploaded JSON file:", parseError);
            alert(`Error parsing JSON file: ${parseError.message}.\nPlease ensure the file contains valid JSON and matches the expected quiz structure.`);
            uploadJsonFileInput.value = '';
            return;
        }

        // Validate the structure of the uploaded JSON
        validateQuizJsonData(uploadedQuizData); // This will throw an error if invalid

        // If validation passes, proceed to practice
        const quizDataString = JSON.stringify(uploadedQuizData);
        const encodedQuizData = encodeURIComponent(quizDataString);
        window.location.href = `quiz_practice.html?quizData=${encodedQuizData}`;

    } catch (error) { // Catches errors from readFileAsText or validateQuizJsonData
        console.error("Error processing uploaded quiz file:", error);
        alert(`Error processing quiz file: ${error.message}`);
        uploadJsonFileInput.value = ''; // Clear the input on error
    }
});