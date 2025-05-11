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
            // event.target.result is a data URL (e.g., "data:image/png;base64,iVBORw0K...")
            // We need to extract just the base64 part.
            const result = event.target.result;
            const base64Data = result.split(',')[1];
            resolve({ base64Data, mimeType: file.type });
        };
        reader.onerror = (error) => reject(error);
        reader.readAsDataURL(file); // Reads the file as a data URL (base64 encoded)
    });
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

    // --- Prepare parts for the API request ---
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

    // --- Enhanced Prompt ---
    const promptText = `
You are an expert MCQ (Multiple Choice Question) quiz generator AI. Your primary goal is to create high-quality, accurate, and engaging quizzes.

Your task is to generate a Multiple Choice Question (MCQ) quiz based on the provided context (from an uploaded file, if any) and specific user instructions.

The output MUST be a single, valid JSON object. Do not include any explanatory text, comments, or markdown backticks (like \`\`\`json or \`\`\`) before or after the JSON block. Ensure the JSON is perfectly parsable.

The JSON structure MUST be exactly as follows:
{
  "quizTitle": "Quiz based on [Source/Topic derived from context or instructions]",
  "questions": [
    {
      "id": 1, // Integer ID
      "questionText": "What is the core concept discussed in section X?",
      "options": [
        { "id": "a", "text": "Plausible but incorrect option A" },
        { "id": "b", "text": "Correct Option B" },
        { "id": "c", "text": "Plausible but incorrect option C" },
        { "id": "d", "text": "Another plausible distractor D" }
      ],
      "correctOptionId": "b", // The 'id' of the correct option
      "explanation": "A brief, clear explanation for why the answer is correct, and optionally why other options might be incorrect. This should reinforce learning."
    }
    // Add more question objects here as needed
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
5.  **Number of Questions:** Adhere to the number of questions specified in user instructions. If not specified, generate 3-5 questions.
6.  **Explanations:** Provide concise and informative explanations for each correct answer. This is crucial.
7.  **JSON Format:** Strictly adhere to the specified JSON format. No extra text outside the JSON block.

Generate the quiz now. Output ONLY the single, valid JSON object as specified.
`;

    apiParts.unshift({ text: promptText }); // Add the main prompt text as the first part

    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [{ parts: apiParts }], // Send the combined parts array
                generationConfig: {
                    responseMimeType: "application/json", // Crucial for getting JSON directly
                    temperature: 0.5, // Adjust for creativity vs. predictability
                    maxOutputTokens: 8192, // Max tokens for the response
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

            // The AI should directly return JSON because of responseMimeType,
            // but we'll still handle if it's wrapped in text or is an object.
            if (typeof aiOutputPart.text === 'string') {
                jsonString = aiOutputPart.text;
            } else if (typeof aiOutputPart === 'object' && aiOutputPart.text === undefined) {
                 // If responseMimeType: "application/json" is honored, the part itself might be the JSON object.
                jsonString = JSON.stringify(aiOutputPart);
            }
             else {
                // Fallback for unexpected structure
                console.warn("AI response part was not a direct string or expected object, attempting to stringify candidate content:", data.candidates[0].content);
                jsonString = JSON.stringify(data.candidates[0].content.parts[0]); // Best guess
            }


            // Clean potential markdown backticks just in case
            jsonString = jsonString.replace(/^```json\s*/, '').replace(/\s*```$/, '').trim();

            try {
                generatedJsonData = JSON.parse(jsonString);
                // Validate basic structure
                if (!generatedJsonData.quizTitle || !Array.isArray(generatedJsonData.questions)) {
                    throw new Error("Generated JSON is missing 'quizTitle' or 'questions' array.");
                }
                generatedJsonData.questions.forEach((q, index) => {
                    if (typeof q.id === 'undefined' || !q.questionText || !Array.isArray(q.options) || q.options.length === 0 || !q.correctOptionId || typeof q.explanation === 'undefined') {
                        throw new Error(`Question at index ${index} is malformed (missing id, questionText, options, correctOptionId, or explanation).`);
                    }
                    q.options.forEach((opt, optIndex) => {
                        if (typeof opt.id === 'undefined' || typeof opt.text === 'undefined') {
                            throw new Error(`Option at index ${optIndex} for question ${index} is malformed (missing id or text).`);
                        }
                    });
                     // Check if correctOptionId exists in options
                    if (!q.options.some(opt => opt.id === q.correctOptionId)) {
                        throw new Error(`correctOptionId '${q.correctOptionId}' for question ${index} does not match any available option IDs.`);
                    }
                });

                jsonOutput.value = JSON.stringify(generatedJsonData, null, 2);
                outputBlock.style.display = 'block';
                downloadBtn.disabled = false;
                copyBtn.disabled = false;
                practiceQuizBtn.disabled = false;
            } catch (parseError) {
                console.error("Error parsing JSON from AI or validating structure:", parseError);
                jsonOutput.value = "Error: AI did not return valid/expected JSON format.\n\nRaw AI output (check for issues):\n" + jsonString;
                alert("Error: AI response was not valid JSON or had an unexpected structure. Check the console and the raw output text area for details.");
                generatedJsonData = null;
            }
        } else if (data.promptFeedback && data.promptFeedback.blockReason) {
            const blockReason = data.promptFeedback.blockReason;
            const safetyRatingsDetails = data.promptFeedback.safetyRatings ? data.promptFeedback.safetyRatings.map(r => `${r.category}: ${r.probability}`).join(', ') : 'No specific safety rating details.';
            jsonOutput.value = `Error: Prompt was blocked by the API.\nReason: ${blockReason}.\nDetails: ${safetyRatingsDetails}`;
            alert(`Error: Prompt was blocked by the API. Reason: ${blockReason}.`);
            console.log("Prompt Feedback:", data.promptFeedback);
        }
         else {
            console.error("Unexpected API response structure:", data);
            jsonOutput.value = "Error: Unexpected response structure from AI. Check console for the full API response.";
            alert("Error: Unexpected response structure from AI. The AI might not have generated any content.");
        }

    } catch (error) {
        console.error("Error during API call or processing:", error);
        jsonOutput.value = `An error occurred: ${error.message}\nCheck the browser console for more details.`;
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
    // Sanitize quizTitle for filename
    let filename = 'ai_generated_quiz.json';
    if (generatedJsonData.quizTitle) {
        filename = generatedJsonData.quizTitle.replace(/[^a-z0-9_-\s]/gi, '').replace(/\s+/g, '_').toLowerCase() + '_quiz.json';
        if (filename.length < 10 || filename.length > 100) { // Basic sanity check for filename length
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
    jsonOutput.setSelectionRange(0, 99999); // For mobile devices
    try {
        const successful = document.execCommand('copy');
        if (successful) {
            alert('Successfully copied to clipboard!');
        } else {
            alert('Oops, unable to copy. Your browser might not support this action or there was an issue.');
            // Fallback for older browsers or if execCommand fails (e.g. try navigator.clipboard)
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(jsonOutput.value).then(() => {
                    alert('Successfully copied to clipboard using modern API!');
                }).catch(err => {
                    console.error('Fallback copy to clipboard failed: ', err);
                    alert('Oops, unable to copy using fallback method.');
                });
            }
        }
    } catch (err) {
        console.error('Copy to clipboard failed: ', err);
        alert('Oops, unable to copy.');
    }
    window.getSelection().removeAllRanges(); // Deselect
});

practiceQuizBtn.addEventListener('click', () => {
    if (!generatedJsonData) {
        alert("No quiz data available to practice. Please generate a quiz first.");
        return;
    }
    try {
        const quizDataString = JSON.stringify(generatedJsonData);
        const encodedQuizData = encodeURIComponent(quizDataString);
        // Navigate to the practice page, passing data via URL parameter
        window.location.href = `quiz_practice.html?quizData=${encodedQuizData}`;
    } catch (error) {
        alert("Error preparing quiz data for practice. " + error.message);
        console.error("Error stringifying or encoding quiz data:", error);
    }
});