"use strict";

// ===== API KEYS & CONFIG (CLIENT-SIDE - SECURITY RISK FOR PRODUCTION!) =====
const CHATGPT_API_KEY = "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";
const COMPDFKIT_API_KEY = "secret_key_ca58ff6e816885bdcbde402f59aac5f7";
const COMPDFKIT_OCR_ENDPOINT_URL = "https://api.compdfkit.com/v1/ocr";

// ===== USER AUTH & DATA SCOPING (LocalStorage Based) =====
const AUTH_KEY = 'paperBuddyLoggedInUser';

function getCurrentUsername() {
    return localStorage.getItem(AUTH_KEY);
}

function isUserLoggedIn() {
    return !!getCurrentUsername();
}

function loginUser(usernameInput, passwordInput) {
    const username = usernameInput.trim();
    if (!username) {
        displayUserMessage("Username (Email for demo) is required.", "error");
        return false;
    }
    localStorage.setItem(AUTH_KEY, username);
    console.log(`User "${username}" logged in (localStorage).`);
    return true;
}

function logoutUser() {
    const username = getCurrentUsername();
    if (username) {
        localStorage.removeItem(AUTH_KEY);
        console.log(`User "${username}" logged out (localStorage).`);
    }
}

function getUserStorageKey(baseKey) {
    const username = getCurrentUsername();
    if (!username) {
        return null;
    }
    const sanitizedUsername = username.replace(/[^a-zA-Z0-9_-]/g, '');
    return `${baseKey}_user_${sanitizedUsername}`;
}

function getStorageItem(key, defaultValue = {}) {
    if (!key) return defaultValue;
    try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : defaultValue;
    } catch (e) {
        console.error(`Error reading/parsing localStorage key “${key}”. Defaulting.`, e);
        try { localStorage.removeItem(key); } catch (removeError) { /* Ignore */ }
        return defaultValue;
    }
}

function setStorageItem(key, value) {
    if (!key) {
        console.error("Error setting localStorage: Key is null/undefined.");
        return false;
    }
    try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
    } catch (e) {
        console.error(`Error setting localStorage key “${key}”. Data may not save.`, e);
        displayUserMessage(`Error saving preferences (${key}). LocalStorage might be full.`, 'error');
        return false;
    }
}

function getUserData(baseKey, defaultValue = {}) {
    const userKey = getUserStorageKey(baseKey);
    return getStorageItem(userKey, defaultValue);
}

function setUserData(baseKey, value) {
    const userKey = getUserStorageKey(baseKey);
    if (!userKey) {
        console.error(`Error saving user data (${baseKey}): User not logged in or key generation failed.`);
        return false;
    }
    return setStorageItem(userKey, value);
}

const BASE_STORAGE_KEYS = {
    USER_SUBJECTS: 'paperBuddyUserSubjects',
    PAPER_STATUSES: 'paperBuddyPaperStatuses',
    ATTEMPT_DURATIONS: 'paperBuddyAttemptDurations',
    ATTEMPT_DETAILS_PREFIX: 'attemptDetail_',
};

// ===== UTILITY FUNCTIONS =====
const formatTime = (totalSeconds) => {
    if (isNaN(totalSeconds) || totalSeconds < 0) return "00:00:00";
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const sec = Math.floor(totalSeconds % 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
};

function getPaperInfoFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    const attemptId = urlParams.get('attemptId');
    const paperId = urlParams.get('paperId');
    const validAttemptId = attemptId && typeof attemptId === 'string' && attemptId.trim() !== '';
    const validPaperId = paperId && typeof paperId === 'string' && paperId.trim() !== '' && paperId !== 'unknown' && paperId !== 'unknown-paper';
    return { attemptId: validAttemptId ? attemptId : null, paperId: validPaperId ? paperId : null, validAttemptId, validPaperId };
}

function formatPaperCode(paperId) {
    if (!paperId || typeof paperId !== 'string') return "Unknown Paper";
    const parts = paperId.split('-');
    if (parts.length >= 5) {
        const subjectCode = parts[1];
        const paperNumAndVariant = parts[2];
        const sessionCode = parts[3].toLowerCase();
        const yearShort = parts[4];
        return `${subjectCode}/${paperNumAndVariant}/${sessionCode}/${yearShort}`;
    }
    return paperId;
}

function paperIdToPdfFilename(paperId) {
    if (!paperId || typeof paperId !== 'string') {
        console.warn("[PDF Link] Invalid paperId provided for filename conversion:", paperId);
        return null;
    }
    const parts = paperId.split('-');
    if (parts.length >= 5) {
        const subjectCode = parts[1];
        const paperNumAndVariant = parts[2];
        const session = parts[3].toLowerCase();
        const yearShort = parts[4];
        return `${subjectCode}_${paperNumAndVariant}_${session}_${yearShort}.pdf`;
    } else {
        console.warn("[PDF Link] paperId format not recognized for filename conversion:", paperId, "Parts:", parts);
        return null;
    }
}

function displayUserMessage(message, type = 'info', duration = 3000) {
    // ... (no changes to this function body)
    const messageAreaId = 'user-message-area';
    let messageArea = document.getElementById(messageAreaId);
    if (!messageArea) {
        messageArea = document.createElement('div');
        messageArea.id = messageAreaId;
        Object.assign(messageArea.style, {
            position: 'fixed', top: '20px', left: '50%', transform: 'translateX(-50%)',
            padding: '10px 20px', borderRadius: '5px', color: 'white', zIndex: '2000',
            boxShadow: '0 2px 10px rgba(0,0,0,0.2)', transition: 'opacity 0.5s ease-in-out, top 0.5s ease-in-out', opacity: '0',
            minWidth: '250px', textAlign: 'center', pointerEvents: 'none'
        });
        if (document.body) {
            document.body.appendChild(messageArea);
        } else {
            console.warn("displayUserMessage: document.body not ready, message might not be visible immediately.");
            document.addEventListener('DOMContentLoaded', () => document.body.appendChild(messageArea));
        }
    }

    messageArea.textContent = message;
    messageArea.style.top = '-50px';
    requestAnimationFrame(() => {
        messageArea.style.opacity = '1';
        messageArea.style.top = '20px';
    });

    switch (type) {
        case 'error': messageArea.style.backgroundColor = 'var(--delete-color, #EF4444)'; break;
        case 'warning': messageArea.style.backgroundColor = '#F59E0B'; break;
        case 'success': messageArea.style.backgroundColor = '#10B981'; break;
        default: messageArea.style.backgroundColor = 'var(--primary-color, #3B82F6)';
    }

    if (messageArea.timerId) clearTimeout(messageArea.timerId);

    messageArea.timerId = setTimeout(() => {
        messageArea.style.opacity = '0';
        messageArea.style.top = '-50px';
    }, duration);

    if (type === 'error') console.error("User Message:", message);
    else if (type === 'warning') console.warn("User Message:", message);
    else console.log("User Message:", message);
}

// ===== AI & OCR HELPER FUNCTIONS =====
async function getOcrTextFromImageOrPdf(file) { /* ... (no changes to this function body) ... */
    console.log("[API_OCR] Attempting OCR with Compdfkit for file:", file.name, "Type:", file.type, "Size:", file.size);
    displayUserMessage("OCR processing started...", "info", 7000);

    if (!COMPDFKIT_API_KEY) {
        console.error("[API_OCR] Compdfkit API Key is missing.");
        displayUserMessage("OCR configuration error. Cannot process file.", "error");
        return Promise.reject("OCR API Key missing.");
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
        console.log("[API_OCR] Sending request to Compdfkit endpoint:", COMPDFKIT_OCR_ENDPOINT_URL);
        const response = await fetch(COMPDFKIT_OCR_ENDPOINT_URL, {
            method: 'POST',
            headers: { 'Authorization': COMPDFKIT_API_KEY, },
            body: formData
        });

        const responseStatus = response.status;
        const responseStatusText = response.statusText;
        const responseContentType = response.headers.get("content-type");
        console.log("[API_OCR] Response Status:", responseStatus, responseStatusText);
        console.log("[API_OCR] Response Content-Type:", responseContentType);

        let responseDataText = "";
        try {
            responseDataText = await response.text();
            console.log("[API_OCR] Raw Response Text:", responseDataText.substring(0, 500) + (responseDataText.length > 500 ? "..." : ""));
        } catch (textError) {
            console.error("[API_OCR] Error getting raw response text:", textError);
        }

        if (!response.ok) {
            let errorJson = null;
            if (responseDataText && responseContentType && responseContentType.includes("application/json")) {
                try { errorJson = JSON.parse(responseDataText); } catch (e) { console.warn("[API_OCR] Failed to parse error response as JSON", e); }
            }
            const errorMessage = errorJson?.msg || errorJson?.message || responseDataText || responseStatusText || "Unknown OCR error";
            console.error("[API_OCR] Compdfkit OCR API Error:", responseStatus, errorMessage, errorJson);
            displayUserMessage(`OCR failed: ${errorMessage} (Status: ${responseStatus})`, "error");
            return Promise.reject(`OCR API Error: ${errorMessage}`);
        }

        let responseData;
        if (responseDataText && responseContentType && responseContentType.includes("application/json")) {
            try {
                responseData = JSON.parse(responseDataText);
                console.log("[API_OCR] Parsed JSON Response:", responseData);
            } catch (parseError) {
                console.error("[API_OCR] Error parsing successful OCR response as JSON:", parseError, "\nRaw Text was:", responseDataText);
                displayUserMessage("OCR response format error. Check console.", "warning");
                return Promise.reject("OCR response format error.");
            }
        } else if (responseDataText) {
            console.warn("[API_OCR] Response was OK but not JSON. Assuming raw text is OCR result:", responseDataText.substring(0,100)+"...");
            displayUserMessage("OCR processing complete (raw text).", "success");
            return responseDataText;
        } else {
            console.error("[API_OCR] Response was OK but no parsable content (JSON or text).");
            displayUserMessage("OCR completed but no content found.", "warning");
            return "";
        }

        if (responseData && responseData.data && typeof responseData.data.content === 'string') {
            displayUserMessage("OCR processing complete.", "success");
            return responseData.data.content;
        } else if (responseData && typeof responseData.content === 'string') {
            displayUserMessage("OCR processing complete (alt structure).", "success");
            return responseData.content;
        } else if (typeof responseData === 'string') {
             displayUserMessage("OCR processing complete (direct text).", "success");
            return responseData;
        }
        else {
            console.warn("[API_OCR] OCR success, but 'data.content' or 'content' string not found in response:", responseData);
            displayUserMessage("OCR success, but text extraction path unclear. Check console.", "warning");
            return "";
        }

    } catch (error) {
        console.error("[API_OCR] Error during fetch/call to Compdfkit OCR API:", error);
        displayUserMessage("OCR request failed. Check network or console.", "error");
        return Promise.reject(error.message || "Network error during OCR.");
    }
}
async function getAiFeedbackAndGrade(paperContext, userAnswer, paperTotalMarks = 25) { /* ... (no changes to this function body, ensure mark scheme part is placeholder or ready) ... */
    console.log("[API] Requesting AI feedback from ChatGPT...");
    displayUserMessage("Getting AI feedback... This may take a moment.", "info", 10000);

    if (!CHATGPT_API_KEY) {
        console.error("[API] ChatGPT API Key is missing.");
        displayUserMessage("AI feedback configuration error.", "error");
        return Promise.resolve({ score: 0, totalMarks: paperTotalMarks, grade: "U", feedback: "AI configuration error. Feedback unavailable.", outline: "AI configuration error. Outline unavailable.", highlight_references: [] });
    }

    let markSchemeText = "Mark scheme not explicitly loaded for this version. Future enhancement: Load relevant MS here.";
    // TODO: Implement loading markSchemeText from a file based on paperContext.id
    // const msFilename = paperIdToPdfFilename(paperContext.id).replace('.pdf', '_ms.txt');
    // try {
    //     const msResponse = await fetch(`markschemes/${msFilename}`);
    //     if (msResponse.ok) markSchemeText = await msResponse.text();
    //     else console.warn(`Mark scheme file not found: markschemes/${msFilename}`);
    // } catch (e) { console.warn("Could not load mark scheme for AI prompt", e); }


    const prompt = `
        You are an expert A-Level exam marker for ${paperContext.subjectName || 'the relevant subject'}.
        Paper: ${formatPaperCode(paperContext.id)}. Total Marks for this section/question: ${paperTotalMarks}.

        MARK SCHEME (use for guidance if provided, otherwise use general A-Level marking principles):
        ---
        ${markSchemeText}
        ---

        Student's Answer:
        ---
        ${userAnswer}
        ---

        Assessment Guidelines:
        1.  **Score:** Award an integer score out of ${paperTotalMarks}. Base this on typical A-Level criteria and the provided mark scheme if available.
        2.  **Grade:** Calculate a letter grade (A, B, C, D, E, or U) based on the percentage of the score against totalMarks. (A >= 80%, B >= 70%, C >= 60%, D >= 50%, E >= 40%).
        3.  **Feedback (Detailed):** Provide constructive feedback (150-350 words).
            *   Identify strengths in the student's answer.
            *   Identify specific weaknesses or areas for improvement.
            *   If possible, refer to concepts that should have been included or elaborated upon.
            *   Quote short phrases from the student's answer to illustrate your points.
            *   Offer actionable advice.
        4.  **Highlight References (Conceptual):** As a placeholder for future PDF highlighting, list up to 5 key phrases from the student's answer and briefly state why they are significant (e.g., "correctly identified X concept", "missed crucial detail Y"). Format as: "highlight_references": [{"student_phrase": "...", "significance": "..."}]. If no specific phrases stand out, provide an empty array [].
        5.  **Outline:** Provide a concise model answer outline (3-5 key bullet points or steps) that a model answer should include to achieve high marks for this type of question.

        Output ONLY a single valid JSON object with keys: "score", "totalMarks", "grade", "feedback", "highlight_references", "outline".
    `;

    try {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${CHATGPT_API_KEY}`
            },
            body: JSON.stringify({
                model: "gpt-3.5-turbo-0125",
                messages: [{ role: "user", content: prompt }],
                response_format: { type: "json_object" },
                temperature: 0.6
            })
        });

        const responseDataText = await response.text();

        if (!response.ok) {
            let errorData = { message: "Unknown AI error" };
            try { errorData = JSON.parse(responseDataText); } catch (e) { /* ignore */ }
            console.error("[API] ChatGPT API Error:", response.status, errorData, "\nRaw Response:", responseDataText);
            displayUserMessage(`AI feedback failed: ${errorData.error?.message || response.statusText}`, "error");
            return Promise.resolve({ score: 0, totalMarks: paperTotalMarks, grade: "U", feedback: `AI Error: ${errorData.error?.message || response.statusText}`, outline: "Could not generate outline due to AI error.", highlight_references: [] });
        }

        console.log("[API] ChatGPT API Raw Response:", responseDataText);
        const data = JSON.parse(responseDataText);
        const aiResponseContent = data.choices?.[0]?.message?.content;

        if (aiResponseContent) {
            try {
                const parsedResponse = JSON.parse(aiResponseContent);
                parsedResponse.score = parseInt(parsedResponse.score) || 0;
                parsedResponse.totalMarks = parseInt(parsedResponse.totalMarks) || paperTotalMarks;
                if (parsedResponse.score > parsedResponse.totalMarks) parsedResponse.score = parsedResponse.totalMarks;
                if (parsedResponse.score < 0) parsedResponse.score = 0;
                if (!Array.isArray(parsedResponse.highlight_references)) parsedResponse.highlight_references = [];


                displayUserMessage("AI feedback and grade received.", "success");
                return parsedResponse;
            } catch (parseError) {
                console.error("[API] Error parsing ChatGPT JSON content:", parseError, "\nRaw content:", aiResponseContent);
                displayUserMessage("AI response format error. Using partial data. Check console.", "warning");
                return { score: 0, totalMarks: paperTotalMarks, grade: "U", feedback: "Error parsing AI response. Raw: " + aiResponseContent, outline: "Outline unavailable due to parsing error.", highlight_references: [] };
            }
        } else {
            console.error("[API] No content in ChatGPT response choice. Full response:", data);
            displayUserMessage("AI returned an empty response content.", "error");
            return { score: 0, totalMarks: paperTotalMarks, grade: "U", feedback: "AI returned an empty response.", outline: "Outline unavailable.", highlight_references: [] };
        }

    } catch (error) {
        console.error("[API] Error calling ChatGPT API:", error);
        displayUserMessage("AI feedback request failed. Check network or console.", "error");
        return { score: 0, totalMarks: paperTotalMarks, grade: "U", feedback: "Could not connect to AI service.", outline: "Outline unavailable.", highlight_references: [] };
    }
}

// ===== GLOBAL DATA SOURCE =====
const ALL_PAPER_DATA_SOURCE = [
    // Economics 9708 - Years 2023, 2024
    // Paper 2, Variant 1
    { id: 'econ-9708-21-mj-23', subjectId: 'economics-9708', subjectCode: '9708', subjectName: 'Economics', paperNumber: '2', variant: '1', sessionCode: 'MJ', year: 2023, shortYear: '23', sessionLabel: 'May/June', totalMarks: 60 },
    { id: 'econ-9708-21-on-23', subjectId: 'economics-9708', subjectCode: '9708', subjectName: 'Economics', paperNumber: '2', variant: '1', sessionCode: 'ON', year: 2023, shortYear: '23', sessionLabel: 'Oct/Nov', totalMarks: 60 },
    { id: 'econ-9708-21-mj-24', subjectId: 'economics-9708', subjectCode: '9708', subjectName: 'Economics', paperNumber: '2', variant: '1', sessionCode: 'MJ', year: 2024, shortYear: '24', sessionLabel: 'May/June', totalMarks: 60 },
    { id: 'econ-9708-21-on-24', subjectId: 'economics-9708', subjectCode: '9708', subjectName: 'Economics', paperNumber: '2', variant: '1', sessionCode: 'ON', year: 2024, shortYear: '24', sessionLabel: 'Oct/Nov', totalMarks: 60 },

    // Paper 2, Variant 2
    { id: 'econ-9708-22-mj-23', subjectId: 'economics-9708', subjectCode: '9708', subjectName: 'Economics', paperNumber: '2', variant: '2', sessionCode: 'MJ', year: 2023, shortYear: '23', sessionLabel: 'May/June', totalMarks: 60 },
    { id: 'econ-9708-22-on-23', subjectId: 'economics-9708', subjectCode: '9708', subjectName: 'Economics', paperNumber: '2', variant: '2', sessionCode: 'ON', year: 2023, shortYear: '23', sessionLabel: 'Oct/Nov', totalMarks: 60 },
    { id: 'econ-9708-22-mj-24', subjectId: 'economics-9708', subjectCode: '9708', subjectName: 'Economics', paperNumber: '2', variant: '2', sessionCode: 'MJ', year: 2024, shortYear: '24', sessionLabel: 'May/June', totalMarks: 60 },
    { id: 'econ-9708-22-on-24', subjectId: 'economics-9708', subjectCode: '9708', subjectName: 'Economics', paperNumber: '2', variant: '2', sessionCode: 'ON', year: 2024, shortYear: '24', sessionLabel: 'Oct/Nov', totalMarks: 60 },
    { id: 'econ-9708-22-fm-24', subjectId: 'economics-9708', subjectCode: '9708', subjectName: 'Economics', paperNumber: '2', variant: '2', sessionCode: 'FM', year: 2024, shortYear: '24', sessionLabel: 'Feb/March', totalMarks: 60 }, // from screenshot

    // Paper 2, Variant 3
    { id: 'econ-9708-23-mj-23', subjectId: 'economics-9708', subjectCode: '9708', subjectName: 'Economics', paperNumber: '2', variant: '3', sessionCode: 'MJ', year: 2023, shortYear: '23', sessionLabel: 'May/June', totalMarks: 60 },
    { id: 'econ-9708-23-on-23', subjectId: 'economics-9708', subjectCode: '9708', subjectName: 'Economics', paperNumber: '2', variant: '3', sessionCode: 'ON', year: 2023, shortYear: '23', sessionLabel: 'Oct/Nov', totalMarks: 60 },
    { id: 'econ-9708-23-mj-24', subjectId: 'economics-9708', subjectCode: '9708', subjectName: 'Economics', paperNumber: '2', variant: '3', sessionCode: 'MJ', year: 2024, shortYear: '24', sessionLabel: 'May/June', totalMarks: 60 },
    { id: 'econ-9708-23-on-24', subjectId: 'economics-9708', subjectCode: '9708', subjectName: 'Economics', paperNumber: '2', variant: '3', sessionCode: 'ON', year: 2024, shortYear: '24', sessionLabel: 'Oct/Nov', totalMarks: 60 },

    // Paper 4, Variant 1
    { id: 'econ-9708-41-mj-23', subjectId: 'economics-9708', subjectCode: '9708', subjectName: 'Economics', paperNumber: '4', variant: '1', sessionCode: 'MJ', year: 2023, shortYear: '23', sessionLabel: 'May/June', totalMarks: 60 },
    { id: 'econ-9708-41-on-23', subjectId: 'economics-9708', subjectCode: '9708', subjectName: 'Economics', paperNumber: '4', variant: '1', sessionCode: 'ON', year: 2023, shortYear: '23', sessionLabel: 'Oct/Nov', totalMarks: 60 },
    { id: 'econ-9708-41-mj-24', subjectId: 'economics-9708', subjectCode: '9708', subjectName: 'Economics', paperNumber: '4', variant: '1', sessionCode: 'MJ', year: 2024, shortYear: '24', sessionLabel: 'May/June', totalMarks: 60 },
    { id: 'econ-9708-41-on-24', subjectId: 'economics-9708', subjectCode: '9708', subjectName: 'Economics', paperNumber: '4', variant: '1', sessionCode: 'ON', year: 2024, shortYear: '24', sessionLabel: 'Oct/Nov', totalMarks: 60 },

    // Paper 4, Variant 2
    { id: 'econ-9708-42-mj-23', subjectId: 'economics-9708', subjectCode: '9708', subjectName: 'Economics', paperNumber: '4', variant: '2', sessionCode: 'MJ', year: 2023, shortYear: '23', sessionLabel: 'May/June', totalMarks: 60 },
    { id: 'econ-9708-42-on-23', subjectId: 'economics-9708', subjectCode: '9708', subjectName: 'Economics', paperNumber: '4', variant: '2', sessionCode: 'ON', year: 2023, shortYear: '23', sessionLabel: 'Oct/Nov', totalMarks: 60 },
    { id: 'econ-9708-42-mj-24', subjectId: 'economics-9708', subjectCode: '9708', subjectName: 'Economics', paperNumber: '4', variant: '2', sessionCode: 'MJ', year: 2024, shortYear: '24', sessionLabel: 'May/June', totalMarks: 60 },
    { id: 'econ-9708-42-on-24', subjectId: 'economics-9708', subjectCode: '9708', subjectName: 'Economics', paperNumber: '4', variant: '2', sessionCode: 'ON', year: 2024, shortYear: '24', sessionLabel: 'Oct/Nov', totalMarks: 60 },
    { id: 'econ-9708-42-fm-24', subjectId: 'economics-9708', subjectCode: '9708', subjectName: 'Economics', paperNumber: '4', variant: '2', sessionCode: 'FM', year: 2024, shortYear: '24', sessionLabel: 'Feb/March', totalMarks: 60 }, // from screenshot

    // Paper 4, Variant 3
    { id: 'econ-9708-43-mj-23', subjectId: 'economics-9708', subjectCode: '9708', subjectName: 'Economics', paperNumber: '4', variant: '3', sessionCode: 'MJ', year: 2023, shortYear: '23', sessionLabel: 'May/June', totalMarks: 60 },
    { id: 'econ-9708-43-on-23', subjectId: 'economics-9708', subjectCode: '9708', subjectName: 'Economics', paperNumber: '4', variant: '3', sessionCode: 'ON', year: 2023, shortYear: '23', sessionLabel: 'Oct/Nov', totalMarks: 60 },
    { id: 'econ-9708-43-mj-24', subjectId: 'economics-9708', subjectCode: '9708', subjectName: 'Economics', paperNumber: '4', variant: '3', sessionCode: 'MJ', year: 2024, shortYear: '24', sessionLabel: 'May/June', totalMarks: 60 },
    { id: 'econ-9708-43-on-24', subjectId: 'economics-9708', subjectCode: '9708', subjectName: 'Economics', paperNumber: '4', variant: '3', sessionCode: 'ON', year: 2024, shortYear: '24', sessionLabel: 'Oct/Nov', totalMarks: 60 },

    // You might have other subjects like Business (9609) - add them if PDFs are available
    // { id: 'biz-9609-11-mj-23', subjectId: 'business-9609', subjectCode: '9609', subjectName: 'Business', paperNumber: '1', variant: '1', sessionCode: 'MJ', year: 2023, shortYear: '23', sessionLabel: 'May/June', totalMarks: 40 },
];

// ===== DOMContentLoaded =====
document.addEventListener('DOMContentLoaded', () => {
    console.log("PaperBuddy Script Loaded. DOMContentLoaded fired. Using localStorage for Auth/Data.");
    updateHeaderUI();
    setupHeaderScroll();
    setupLoginModal();

    const pathname = window.location.pathname.split('/').pop() || 'index.html';
    console.log("Initial page path on DOMContentLoaded:", pathname);

    if (pathname !== 'index.html' && !isUserLoggedIn()) {
        console.log(`User not logged in on protected page ${pathname}. Redirecting to landing page.`);
        if (['attempt.html', 'test.html', 'result.html'].includes(pathname)) {
             alert(`Please log in to access ${pathname.split('.')[0]}.`);
        }
        window.location.href = 'index.html';
        return;
    }
    initializePage(pathname);
});

function initializePage(pathname) {
    console.log(`Initializing page specific content for: ${pathname}`);
    setupLoginRequiredChecks();

    switch (pathname) {
        case 'index.html': break;
        case 'dashboard.html': if (isUserLoggedIn()) setupDashboardPage(); else console.log("User not logged in, skipping dashboard setup."); break;
        case 'papers.html': if (isUserLoggedIn()) setupPapersPage_Dynamic(); else console.log("User not logged in, skipping papers page setup."); break;
        case 'attempt.html': if (isUserLoggedIn()) setupAttemptContentViewer(); else console.log("User not logged in, skipping attempt page setup."); break;
        case 'test.html': if (isUserLoggedIn()) setupTestPage(); else console.log("User not logged in, skipping test page setup."); break;
        case 'result.html': if (isUserLoggedIn()) setupResultPage(); else console.log("User not logged in, skipping result page setup."); break;
        default: console.warn(`No specific setup found for page: ${pathname}`);
    }
}

// ===== GENERAL FUNCTIONS (Modal, Header UI, etc.) =====
// ... (No changes to setupHeaderScroll, trapFocus, openModal, closeModal, updateHeaderUI, setupLoginModal, triggerLoginModal, setupLoginRequiredChecks from the previous full script)
// ... (No changes to setupDashboardPage, setupPapersPage_Dynamic from the previous full script, they use the updated ALL_PAPER_DATA_SOURCE and paperIdToPdfFilename)

// (Make sure to copy the full bodies of these functions from the previous complete script if you are replacing wholesale)
function setupHeaderScroll() { /* ... Full function body ... */
    const header = document.querySelector('.header');
    if (!header) return;
    const scrollThreshold = 50;
    const addHeaderShadow = () => header.classList.toggle('header--scrolled', window.scrollY >= scrollThreshold);
    window.addEventListener('scroll', addHeaderShadow, { passive: true });
    addHeaderShadow();
}
function trapFocus(event, modalElement) { /* ... Full function body ... */
    if (!modalElement || !modalElement.classList.contains('is-visible') || event.key !== 'Tab') return;
    const focusableElements = Array.from(modalElement.querySelectorAll(
        'button:not([disabled]), [href], input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )).filter(el => el.offsetWidth > 0 || el.offsetHeight > 0 || el === document.activeElement);

    if (focusableElements.length === 0) { event.preventDefault(); return; }
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (event.shiftKey) { if (document.activeElement === firstElement) { lastElement.focus(); event.preventDefault(); } }
    else { if (document.activeElement === lastElement) { firstElement.focus(); event.preventDefault(); } }
}
let activeModal = null;
function openModal(modalElement, focusElement) { /* ... Full function body ... */
    if (!modalElement) return null;
    if (activeModal && activeModal !== modalElement) closeModal(activeModal, activeModal._focusRestoreElement);

    const previouslyFocused = document.activeElement;
    modalElement.hidden = false;
    void modalElement.offsetWidth;
    modalElement.classList.add('is-visible');
    modalElement.setAttribute('aria-hidden', 'false');
    activeModal = modalElement;
    activeModal._focusRestoreElement = previouslyFocused;

    const elementToFocus = focusElement && modalElement.contains(focusElement) && !focusElement.disabled
        ? focusElement
        : modalElement.querySelector('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])');
    elementToFocus?.focus();

    if (modalElement._trapFocusListener) document.removeEventListener('keydown', modalElement._trapFocusListener);
    modalElement._trapFocusListener = (e) => trapFocus(e, modalElement);
    document.addEventListener('keydown', modalElement._trapFocusListener);

    return previouslyFocused;
}
function closeModal(modalElementToClose, previouslyFocusedElementOverride) { /* ... Full function body ... */
    if (!modalElementToClose || !modalElementToClose.classList.contains('is-visible')) return;

    modalElementToClose.classList.remove('is-visible');
    modalElementToClose.setAttribute('aria-hidden', 'true');
    if (activeModal === modalElementToClose) activeModal = null;

    if (modalElementToClose._trapFocusListener) {
        document.removeEventListener('keydown', modalElementToClose._trapFocusListener);
        delete modalElementToClose._trapFocusListener;
    }

    const focusRestoreTarget = previouslyFocusedElementOverride || modalElementToClose._focusRestoreElement || document.body;

    const transitionCallback = () => {
        modalElementToClose.hidden = true;
        modalElementToClose.removeEventListener('transitionend', transitionCallback);
        if (focusRestoreTarget && typeof focusRestoreTarget.focus === 'function' && document.body.contains(focusRestoreTarget)) {
             const style = window.getComputedStyle(focusRestoreTarget);
            if (style.display !== 'none' && style.visibility !== 'hidden' && !focusRestoreTarget.disabled && focusRestoreTarget.tabIndex !== -1) {
                 focusRestoreTarget.focus({ preventScroll: true });
            }
        }
        if (modalElementToClose._focusRestoreElement) delete modalElementToClose._focusRestoreElement;
    };

    const transitionDuration = parseFloat(getComputedStyle(modalElementToClose).transitionDuration) * 1000;
    if (transitionDuration > 0) {
        modalElementToClose.addEventListener('transitionend', transitionCallback);
        setTimeout(() => {
            if (!modalElementToClose.hidden && modalElementToClose.getAttribute('aria-hidden') === 'true') {
                transitionCallback();
            }
        }, transitionDuration + 100);
    } else {
        transitionCallback();
    }
}
function updateHeaderUI() { /* ... Full function body ... */
    const loggedIn = isUserLoggedIn();
    const currentUsername = getCurrentUsername();
    const loginBtn = document.getElementById('login-trigger-btn');
    const joinBtn = document.getElementById('join-trigger-btn');
    const userInfoDiv = document.getElementById('user-info');
    const usernameDisplay = document.getElementById('nav-username-display');
    const logoutBtn = document.getElementById('logout-btn');

    if (loginBtn) loginBtn.style.display = loggedIn ? 'none' : '';
    if (joinBtn) joinBtn.style.display = loggedIn ? 'none' : '';
    if (userInfoDiv) userInfoDiv.style.display = loggedIn ? 'flex' : 'none';

    if (loggedIn && usernameDisplay && currentUsername) {
        usernameDisplay.textContent = currentUsername.includes('@') ? currentUsername.split('@')[0] : currentUsername;
    } else if (usernameDisplay) {
        usernameDisplay.textContent = "Guest";
    }

    if (logoutBtn) {
        if (logoutBtn._logoutHandler) logoutBtn.removeEventListener('click', logoutBtn._logoutHandler);
        if (loggedIn) {
            logoutBtn._logoutHandler = (e) => {
                e.preventDefault();
                console.log("Logout button clicked");
                logoutUser();
                updateHeaderUI();
                window.location.href = 'index.html';
            };
            logoutBtn.addEventListener('click', logoutBtn._logoutHandler);
        }
    }
}
function setupLoginModal() { /* ... Full function body ... */
    const loginModal = document.getElementById('login-modal');
    if (!loginModal) { console.error("Login modal element (#login-modal) not found!"); return; }

    const openModalTriggers = document.querySelectorAll('[data-open-modal="login-modal"]');
    openModalTriggers.forEach(trigger => {
        trigger.addEventListener('click', (event) => triggerLoginModal(event, trigger));
    });

    const closeModalElements = loginModal.querySelectorAll('[data-close-modal], .modal__close-btn');
    const loginForm = document.getElementById('login-form');
    const emailInput = document.getElementById('login-username');
    const passwordInput = document.getElementById('login-password');
    const errorMessage = document.getElementById('login-error-message');
    const submitButton = loginForm ? loginForm.querySelector('button[type="submit"]') : null;


    if (!loginForm || !emailInput || !passwordInput || !errorMessage || !submitButton) {
        console.error("Required elements within the login modal are missing."); return;
    }

    const closeLoginModalInstance = () => closeModal(loginModal);

    closeModalElements.forEach(el => el.addEventListener('click', closeLoginModalInstance));
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && loginModal.classList.contains('is-visible')) closeLoginModalInstance();
    });

    loginForm.addEventListener('submit', (event) => {
        event.preventDefault();
        errorMessage.hidden = true;
        const email = emailInput.value.trim();
        const password = passwordInput.value;
        console.log("Login form submitted. Email (as username):", email, "Password entered:", password ? "Yes" : "No");

        if (!email) { errorMessage.textContent = "Email (for username) is required."; errorMessage.hidden = false; emailInput.focus(); return; }

        submitButton.disabled = true; submitButton.textContent = "Processing...";
        displayUserMessage("Attempting to log in / sign up (demo)...", "info");

        const success = loginUser(email, password);

        submitButton.disabled = false; submitButton.textContent = "Log In / Sign Up";

        if (success) {
            closeLoginModalInstance();
            updateHeaderUI();
            const currentPathname = window.location.pathname.split('/').pop() || 'index.html';
            if (currentPathname === 'index.html') {
                 console.log("Login successful on index page, redirecting to dashboard.");
                 window.location.href = 'dashboard.html';
            } else {
                console.log("Login successful on non-index page. Reloading page.");
                window.location.reload();
            }
        } else {
            emailInput.focus();
        }
    });
}
function triggerLoginModal(event, triggerElement) { /* ... Full function body ... */
    if (event) event.preventDefault();
    const loginModal = document.getElementById('login-modal');
    const emailInput = document.getElementById('login-username');
    if (!loginModal || !emailInput) { displayUserMessage("Login component error.", "error"); return; }
    const loginForm = document.getElementById('login-form');
    if (loginForm) loginForm.reset();
    const errorMessage = document.getElementById('login-error-message');
    if(errorMessage) errorMessage.hidden = true;

    const oldFocus = openModal(loginModal, emailInput);
    if(triggerElement && loginModal) loginModal._focusRestoreElement = triggerElement;
    else if (loginModal) loginModal._focusRestoreElement = oldFocus;
}
function setupLoginRequiredChecks() { /* ... Full function body ... */
    const requiresLoginSelectors = [
        '.nav__list a[href="dashboard.html"]', '.nav__list a[href="papers.html"]',
        '.hero__search-button', '.hero__search-form',
        '.subjects__item', '.cta__container a.button',
    ];

    document.querySelectorAll(requiresLoginSelectors.join(', ')).forEach(element => {
        const newElement = element.cloneNode(true);
        element.parentNode.replaceChild(newElement, element);

        const handler = (event) => {
            if (!isUserLoggedIn()) {
                const trigger = (newElement.tagName === 'FORM') ? newElement.querySelector('button[type="submit"], input[type="submit"]') : event.currentTarget;
                triggerLoginModal(event, trigger || newElement);
            }
        };

        if (newElement.tagName === 'FORM') newElement.addEventListener('submit', handler);
        else if (newElement.tagName === 'A' || newElement.tagName === 'BUTTON') newElement.addEventListener('click', handler);
    });
}
function setupDashboardPage() { /* ... Full function body from previous localStorage version... */
    console.log("Setting up Dashboard Page (localStorage mode)...");
    const currentUsername = getCurrentUsername();

    const modal = document.getElementById('subject-modal');
    const openModalBtn = document.getElementById('edit-subjects-btn');
    const closeModalElements = modal?.querySelectorAll('[data-close-modal], .modal__close-btn');
    const subjectForm = document.getElementById('subject-selection-form');
    const subjectsListWrapper = document.getElementById('subjects-list-wrapper');
    const noSubjectsMessage = document.getElementById('no-subjects-message');
    const welcomeTitle = document.querySelector('.welcome__title');

    if (!modal || !openModalBtn || !subjectForm || !subjectsListWrapper || !noSubjectsMessage || !welcomeTitle) {
        console.warn("Dashboard page missing essential elements.");
        if(subjectsListWrapper) subjectsListWrapper.innerHTML = '<p class="no-results-message">Error loading dashboard components.</p>';
        return;
    }

    welcomeTitle.textContent = `Hi, ${currentUsername ? (currentUsername.includes('@') ? currentUsername.split('@')[0] : currentUsername) : 'Guest'}`;

    let currentUserSubjects = getUserData(BASE_STORAGE_KEYS.USER_SUBJECTS, []);
    const paperStatuses = getUserData(BASE_STORAGE_KEYS.PAPER_STATUSES, {});

    function calculateSubjectStats(subjectId) {
        if (typeof ALL_PAPER_DATA_SOURCE === 'undefined' || !Array.isArray(ALL_PAPER_DATA_SOURCE)) return { progress: 0, grade: 'N/A' };
        const subjectPapers = ALL_PAPER_DATA_SOURCE.filter(p => p.subjectId === subjectId);
        const totalPapers = subjectPapers.length;
        if (totalPapers === 0) return { progress: 0, grade: 'N/A' };
        let doneCount = 0;
        const validPaperStatuses = typeof paperStatuses === 'object' && paperStatuses !== null ? paperStatuses : {};
        subjectPapers.forEach(paper => { if (validPaperStatuses[paper.id]?.status === 'done') { doneCount++; } });
        const progress = totalPapers > 0 ? Math.round((doneCount / totalPapers) * 100) : 0;
        let grade = 'N/A';
        if (doneCount > 0) {
             if (progress >= 80) grade = 'A'; else if (progress >= 65) grade = 'B'; else if (progress >= 50) grade = 'C'; else if (progress >= 40) grade = 'D'; else grade = 'E';
        }
        return { progress, grade };
    }
    const createSubjectRow = (subjectData) => {
        if (!subjectData?.id) return null;
        const stats = calculateSubjectStats(subjectData.id);
        const subjectLabel = subjectData.label || subjectData.id;
        const article = document.createElement('article'); article.className = 'subjects-list__item'; article.role = 'row'; article.dataset.subjectId = subjectData.id;
        const subjectCell = document.createElement('div'); subjectCell.className = 'subjects-list__cell'; subjectCell.dataset.label = 'Subject'; subjectCell.textContent = subjectLabel;
        const papersCell = document.createElement('div'); papersCell.className = 'subjects-list__cell'; papersCell.dataset.label = 'Past Papers';
        const progressBar = document.createElement('div'); progressBar.className = 'progress-bar'; progressBar.setAttribute('aria-label', `Progress for ${subjectLabel}`);
        const progressBarInner = document.createElement('div'); progressBarInner.className = 'progress-bar__inner'; progressBarInner.style.width = `${stats.progress}%`; progressBarInner.role = 'progressbar'; progressBarInner.ariaValueNow = stats.progress; progressBarInner.ariaValueMin = '0'; progressBarInner.ariaValueMax = '100'; progressBar.appendChild(progressBarInner); papersCell.appendChild(progressBar);
        const gradeCell = document.createElement('div'); gradeCell.className = 'subjects-list__cell'; gradeCell.dataset.label = 'Predicted grade'; gradeCell.textContent = stats.grade;
        const actionCell = document.createElement('div'); actionCell.className = 'subjects-list__cell subjects-list__cell--action';
        const link = document.createElement('a'); link.href = `papers.html?subject=${subjectData.id}`; link.className = 'subjects-list__link'; link.setAttribute('aria-label', `View ${subjectLabel} papers`); link.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>`; actionCell.appendChild(link); article.append(subjectCell, papersCell, gradeCell, actionCell); return article;
    };
    const renderSubjectsList = (subjectsDataToRender) => {
        const items = subjectsListWrapper.querySelectorAll('.subjects-list__item');
        items.forEach(item => item.remove());
        const validSubjectsData = Array.isArray(subjectsDataToRender) ? subjectsDataToRender : [];
        noSubjectsMessage.hidden = validSubjectsData.length > 0;
        if (validSubjectsData.length > 0) {
            validSubjectsData.forEach(subject => { const row = createSubjectRow(subject); if(row) subjectsListWrapper.appendChild(row); });
        }
        subjectForm.querySelectorAll('input[type="checkbox"]').forEach(cb => { cb.checked = validSubjectsData.some(s => s.id === cb.value); });
    };

    const openSubjectModal = () => {
        const validSubjectsData = Array.isArray(currentUserSubjects) ? currentUserSubjects : [];
        subjectForm.querySelectorAll('input[type="checkbox"]').forEach(cb => { cb.checked = validSubjectsData.some(s => s.id === cb.value); });
        const focusTarget = subjectForm.querySelector('input[type="checkbox"]:not([disabled])') || subjectForm.querySelector('button[type="submit"]');
        openModal(modal, focusTarget);
    };
    const closeSubjectModalInstance = () => closeModal(modal);

    openModalBtn.addEventListener('click', openSubjectModal);
    if (closeModalElements) closeModalElements.forEach(el => el.addEventListener('click', closeSubjectModalInstance));
    document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && modal?.classList.contains('is-visible')) closeSubjectModalInstance(); });

    subjectForm.addEventListener('submit', (event) => {
        event.preventDefault();
        const checked = subjectForm.querySelectorAll('input[name="subjects"]:checked');
        const newData = Array.from(checked).map(cb => ({ id: cb.value, label: cb.dataset.label || cb.value }));
        const success = setUserData(BASE_STORAGE_KEYS.USER_SUBJECTS, newData);
        if (success) {
            currentUserSubjects = newData;
            renderSubjectsList(currentUserSubjects);
            displayUserMessage("Subject preferences saved.", "success");
        }
        closeSubjectModalInstance();
    });
    renderSubjectsList(currentUserSubjects);
}
function setupPapersPage_Dynamic() { /* ... Full function body from previous localStorage version ... */
    const papersListContainer = document.getElementById('papers-list-container');
    const noPapersMessage = document.getElementById('no-papers-message');
    const filterForm = document.getElementById('paper-filter-form');
    const applyFiltersBtn = document.getElementById('apply-filters-btn');
    const mainTitle = document.getElementById('papers-main-title');

    if (!papersListContainer || !noPapersMessage || !filterForm || !applyFiltersBtn || !mainTitle) {
        console.warn("Papers page dynamic elements missing."); return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const subjectFilterFromUrl = urlParams.get('subject');
    const paperStatuses = getUserData(BASE_STORAGE_KEYS.PAPER_STATUSES, {});

    function createPaperCard(paper) {
        if (!paper?.id) return null;
        const link = document.createElement('a');
        const validPaperStatuses = typeof paperStatuses === 'object' && paperStatuses !== null ? paperStatuses : {};
        const statusInfo = validPaperStatuses[paper.id] || { status: 'not_done', linkAttemptId: null };
        link.className = `paper-card ${statusInfo.status === 'done' ? 'paper-card--done' : 'paper-card--not-done'}`;
        link.dataset.paperId = paper.id; link.dataset.subject = paper.subjectId || 'unknown'; link.dataset.year = paper.year || 'unknown'; link.dataset.paperNumber = paper.paperNumber || 'unknown'; link.dataset.status = statusInfo.status;

        if (statusInfo.status === 'done' && statusInfo.linkAttemptId) {
            link.href = `attempt.html?attemptId=${encodeURIComponent(statusInfo.linkAttemptId)}&paperId=${encodeURIComponent(paper.id)}`;
        } else {
            link.href = `test.html?paperId=${encodeURIComponent(paper.id)}`;
        }
        const displayCode = formatPaperCode(paper.id);
        link.innerHTML = `<span class="paper-card__name">${displayCode}</span> <span class="paper-card__status">${statusInfo.status === 'done' ? 'Done' : 'Not Done'}</span>`;
        return link;
    }
    function renderPapers(papersToRender) {
        papersListContainer.innerHTML = '';
        papersListContainer.appendChild(noPapersMessage);
        noPapersMessage.hidden = true;

        if (!Array.isArray(papersToRender) || papersToRender.length === 0) {
            noPapersMessage.textContent = "No past papers found matching your filters.";
            noPapersMessage.hidden = false;
            return;
        }

        const papersByYear = papersToRender.reduce((acc, paper) => {
            const year = paper.year || 'Unknown Year'; if (!acc[year]) acc[year] = []; acc[year].push(paper); return acc;
        }, {});

        const sortedYears = Object.keys(papersByYear).sort((a, b) => {
            const yearA = parseInt(a); const yearB = parseInt(b);
            if (isNaN(yearA) && isNaN(yearB)) return 0; if (isNaN(yearA)) return 1; if (isNaN(yearB)) return -1; return yearB - yearA;
        });

        let papersFound = false;
        sortedYears.forEach(year => {
            const yearGroupSection = document.createElement('section'); yearGroupSection.className = 'papers-year-group'; yearGroupSection.dataset.year = year;
            const yearTitle = document.createElement('h3'); yearTitle.className = 'year-group__title'; yearTitle.textContent = year;
            const papersGridDiv = document.createElement('div'); papersGridDiv.className = 'papers-grid';
            papersByYear[year].sort((a, b) => {
                 const sessionOrder = { 'FM': 1, 'MJ': 2, 'ON': 3 };
                 const sessionA = (a.sessionCode || '').toUpperCase();
                 const sessionB = (b.sessionCode || '').toUpperCase();
                 if (sessionOrder[sessionA] !== sessionOrder[sessionB]) return (sessionOrder[sessionA] || 99) - (sessionOrder[sessionB] || 99);
                 const paperNumA = parseInt(a.paperNumber) || 99;
                 const paperNumB = parseInt(b.paperNumber) || 99;
                 if (paperNumA !== paperNumB) return paperNumA - paperNumB;
                 const variantA = a.variant || '';
                 const variantB = b.variant || '';
                 return variantA.localeCompare(variantB);
            }).forEach(paper => {
                const paperCard = createPaperCard(paper); if (paperCard) { papersGridDiv.appendChild(paperCard); papersFound = true; }
            });
            if (papersGridDiv.hasChildNodes()) { yearGroupSection.appendChild(yearTitle); yearGroupSection.appendChild(papersGridDiv); papersListContainer.appendChild(yearGroupSection); }
        });
        noPapersMessage.hidden = papersFound;
        if (!papersFound) { noPapersMessage.textContent = "No past papers found matching your filters."; }
    }

    function applyFiltersAndRender() {
        if (typeof ALL_PAPER_DATA_SOURCE === 'undefined' || !Array.isArray(ALL_PAPER_DATA_SOURCE)) { renderPapers([]); return; }
        const formData = new FormData(filterForm);
        const statusFilter = formData.get('status');
        const yearFilter = formData.get('year');
        const paperFilter = formData.get('paper');

        let filteredData = ALL_PAPER_DATA_SOURCE.filter(paper => {
            if (subjectFilterFromUrl && paper.subjectId !== subjectFilterFromUrl) return false;
            if (statusFilter) { const currentStatus = paperStatuses[paper.id]?.status || 'not_done'; if (currentStatus !== statusFilter) return false; }
            if (yearFilter && paper.year && paper.year.toString() !== yearFilter) return false;
            if (paperFilter) { // Compare just the paper number part
                const paperIdParts = paper.id.split('-'); // econ-9708-21-mj-24
                const paperNumFromId = paperIdParts.length >=3 ? paperIdParts[2].charAt(0) : null; // '2' from '21'
                if (paperNumFromId !== paperFilter) return false;
            }
            return true;
        });
        renderPapers(filteredData);
    }

    if (subjectFilterFromUrl) {
        const subjectData = ALL_PAPER_DATA_SOURCE.find(p => p.subjectId === subjectFilterFromUrl);
        mainTitle.textContent = subjectData ? `${subjectData.subjectName || 'Subject'} (${subjectData.subjectCode || 'Code'}) Papers` : `Papers (Unknown Subject)`;
    } else {
        mainTitle.textContent = `All Past Papers`;
    }

    applyFiltersBtn.addEventListener('click', applyFiltersAndRender);
    applyFiltersAndRender();
}
// ... (setupAttemptContentViewer, setupTestPage, setupResultPage functions are below, ensure they match the corrected full versions)

function setupAttemptContentViewer() {
    console.log("Setting up Attempt Page Content Viewer...");
    const viewer = document.getElementById('paper-viewer-content');
    const paperV = document.getElementById('past-paper-view');
    const feedV = document.getElementById('feedback-view');
    const outV = document.getElementById('outline-view');
    const paperB = document.getElementById('view-paper-btn');
    const feedB = document.getElementById('view-feedback-btn');
    const outB = document.getElementById('view-outline-btn');
    const retakeButton = document.querySelector('.retake-button');
    const paperCodeHeading = document.getElementById('paper-code');
    const gradeValueElement = document.getElementById('attempt-grade');
    const durationValueElement = document.getElementById('attempt-duration');
    const rawScoreValueElement = document.getElementById('attempt-raw-score');
    const retakeModal = document.getElementById('confirm-retake-modal');
    const confirmRetakeBtn = document.getElementById('confirm-retake-action-btn');

    if (!viewer || !paperV || !feedV || !outV || !paperB || !feedB || !outB || !retakeButton || !paperCodeHeading || !gradeValueElement || !durationValueElement || !rawScoreValueElement || !retakeModal || !confirmRetakeBtn) {
        console.warn("Attempt page elements missing."); return;
    }

    const { attemptId, paperId, validAttemptId, validPaperId } = getPaperInfoFromUrl();
    let displayCode = "Attempt Details"; let retakePaperId = "unknown-paper";
    let actualPaperIdForContent = paperId;

    if (validAttemptId && !validPaperId) {
        const attemptDataKeyForPaperId = getUserStorageKey(`${BASE_STORAGE_KEYS.ATTEMPT_DETAILS_PREFIX}${attemptId}`);
        const tempAttemptData = getStorageItem(attemptDataKeyForPaperId, {});
        if (tempAttemptData.paperId) {
            actualPaperIdForContent = tempAttemptData.paperId;
        } else {
            const parts = attemptId.split('_');
            if (parts.length >= 2 && parts[1].includes('-')) {
                actualPaperIdForContent = parts[1];
            }
        }
    }

    retakePaperId = actualPaperIdForContent || (validPaperId ? paperId : "unknown-paper");
    displayCode = actualPaperIdForContent ? formatPaperCode(actualPaperIdForContent) : (validAttemptId ? attemptId : "Attempt Details");

    paperCodeHeading.textContent = displayCode;
    document.title = `${displayCode} - Attempt Details - PaperBuddy`;
    retakeButton.href = `test.html?paperId=${encodeURIComponent(retakePaperId)}`;

    const displayPdfInView = (targetViewElement, pdfPaperId, viewTitle) => {
        if (pdfPaperId) {
            const pdfFilename = paperIdToPdfFilename(pdfPaperId);
            if (pdfFilename) {
                const pdfPath = `papers/${pdfFilename}`; // Path relative to HTML file
                // Check if file exists (simple check, might not work reliably for all local setups without a server)
                // For a more robust check, you'd use a server to verify file existence.
                // This basic check attempts to see if an image with the PDF name (swapped to .png) loads, as a proxy.
                // It's not perfect. The iframe will show its own error if PDF is not found.
                console.log(`[PDF_VIEW] Attempting to display PDF: ${pdfPath}`);
                targetViewElement.innerHTML = `<iframe src="${pdfPath}" width="100%" height="100%" style="border: none;" title="${viewTitle} for ${formatPaperCode(pdfPaperId)}">
                                                <p>Your browser does not support PDFs or the PDF could not be found at ${pdfPath}. Please download the PDF to view it: <a href="${pdfPath}" download>Download PDF</a>.</p>
                                               </iframe>`;
            } else {
                targetViewElement.innerHTML = `<p style="padding: 1rem; text-align: center;"><i>Could not determine PDF filename for ${formatPaperCode(pdfPaperId)}. Ensure paper ID in data source is correct.</i></p>`;
            }
        } else {
            targetViewElement.innerHTML = `<p style="padding: 1rem; text-align: center;"><i>Paper ID not available to load document.</i></p>`;
        }
    };

    displayPdfInView(paperV, actualPaperIdForContent, "Past Paper Document");

    if (validAttemptId) {
        const attemptDataKey = getUserStorageKey(`${BASE_STORAGE_KEYS.ATTEMPT_DETAILS_PREFIX}${attemptId}`);
        const attemptData = getStorageItem(attemptDataKey, {});

        durationValueElement.textContent = attemptData.duration ? formatTime(attemptData.duration) : '--';
        gradeValueElement.textContent = attemptData.grade || '--';
        rawScoreValueElement.textContent = (attemptData.score !== undefined && attemptData.totalMarks !== undefined) ? `${attemptData.score} / ${attemptData.totalMarks}` : '-- / --';

        feedB.addEventListener('click', (e) => {
            e.preventDefault();
            setActiveButton(feedB);
            if (attemptData.feedback && typeof jsPDF !== 'undefined') {
                const { jsPDF } = window.jspdf; const doc = new jsPDF({unit:'pt', format:'a4'});
                doc.setFont("helvetica", "normal"); let currentY = 40; const pageHeight = doc.internal.pageSize.getHeight(); const pageWidth = doc.internal.pageSize.getWidth(); const margin = 40; const maxLineWidth = pageWidth - (margin * 2);
                const addHeaderFooter = (pageNum) => { doc.setFontSize(10); doc.text(`Feedback: ${displayCode}`, margin, 25); doc.text(`Page ${pageNum}`, pageWidth - margin - 10, 25, { align: 'right' }); doc.line(margin, pageHeight - 30, pageWidth - margin, pageHeight - 30); doc.text(`PaperBuddy Attempt ${attemptId.substring(0,8)}`, margin, pageHeight - 15);};
                let pageNum = 1; addHeaderFooter(pageNum);
                doc.setFontSize(14); doc.setFont("helvetica", "bold"); doc.text("Attempt Feedback", margin, currentY); currentY += 20;
                doc.setFontSize(10); doc.setFont("helvetica", "normal"); doc.text(`Paper: ${displayCode}`, margin, currentY); currentY += 15;
                doc.text(`Score: ${attemptData.score || '--'} / ${attemptData.totalMarks || '--'} | Grade: ${attemptData.grade || '--'}`, margin, currentY); currentY += 25;
                doc.setFontSize(12); doc.setFont("helvetica", "bold"); doc.text("Student's Answer (Snippet):", margin, currentY); currentY += 18;
                doc.setFontSize(10); doc.setFont("helvetica", "normal"); const studentAnswerLines = doc.splitTextToSize(attemptData.answerText ? attemptData.answerText.substring(0, 1000) + (attemptData.answerText.length > 1000 ? "..." : "") : "N/A", maxLineWidth);
                studentAnswerLines.forEach(line => { if (currentY > pageHeight - margin - 15) { doc.addPage(); pageNum++; addHeaderFooter(pageNum); currentY = margin; } doc.text(line, margin, currentY); currentY += 12; }); currentY += 10;
                doc.setFontSize(12); doc.setFont("helvetica", "bold"); doc.text("AI Feedback:", margin, currentY); currentY += 18;
                doc.setFontSize(10); doc.setFont("helvetica", "normal"); const feedbackLines = doc.splitTextToSize(attemptData.feedback.replace(/<br>/g, '\n'), maxLineWidth);
                feedbackLines.forEach(line => { if (currentY > pageHeight - margin - 15) { doc.addPage(); pageNum++; addHeaderFooter(pageNum); currentY = margin; } doc.text(line, margin, currentY); currentY += 12; });
                if (attemptData.highlight_references && attemptData.highlight_references.length > 0) { if (currentY > pageHeight - margin - 40) { doc.addPage(); pageNum++; addHeaderFooter(pageNum); currentY = margin; } else { currentY += 10; } doc.setFontSize(12); doc.setFont("helvetica", "bold"); doc.text("Key Points Noted:", margin, currentY); currentY += 18; doc.setFontSize(9); doc.setFont("helvetica", "normal"); attemptData.highlight_references.forEach(ref => { if (currentY > pageHeight - margin - 15) { doc.addPage(); pageNum++; addHeaderFooter(pageNum); currentY = margin; } const refText = `- "${ref.student_phrase}" (${ref.significance || 'N/A'})`; const refLines = doc.splitTextToSize(refText, maxLineWidth); refLines.forEach(line => { if (currentY > pageHeight - margin -15) {doc.addPage(); pageNum++; addHeaderFooter(pageNum); currentY = margin;} doc.text(line, margin + 5, currentY); currentY+=10; }); });}

                feedV.innerHTML = `<iframe src="${doc.output('datauristring')}" width="100%" height="100%" style="border:none;" title="Feedback PDF"></iframe>`;
            } else { feedV.innerHTML = "<p><i>Feedback PDF cannot be generated or no feedback data.</i></p>"; }
            views.forEach(v => v.hidden = true); feedV.hidden = false; viewer.scrollTop = 0;
        });

        outB.addEventListener('click', (e) => {
            e.preventDefault();
            setActiveButton(outB);
             if (attemptData.outline && typeof jsPDF !== 'undefined') {
                const { jsPDF } = window.jspdf; const doc = new jsPDF({unit:'pt', format:'a4'});
                doc.setFont("helvetica", "normal"); let currentY = 40; const pageHeight = doc.internal.pageSize.getHeight(); const pageWidth = doc.internal.pageSize.getWidth(); const margin = 40; const maxLineWidth = pageWidth - (margin * 2);
                const addHeaderFooter = (pageNum) => { doc.setFontSize(10); doc.text(`Outline: ${displayCode}`, margin, 25); doc.text(`Page ${pageNum}`, pageWidth - margin - 10, 25, { align: 'right' }); doc.line(margin, pageHeight - 30, pageWidth - margin, pageHeight - 30); doc.text(`PaperBuddy Attempt ${attemptId.substring(0,8)}`, margin, pageHeight - 15);};
                let pageNum = 1; addHeaderFooter(pageNum);
                doc.setFontSize(14); doc.setFont("helvetica", "bold"); doc.text("Model Answer Outline", margin, currentY); currentY += 25;
                doc.setFontSize(10); doc.setFont("helvetica", "normal");
                const outlineLines = doc.splitTextToSize(attemptData.outline.replace(/<br>/g, '\n'), maxLineWidth);
                outlineLines.forEach(line => { if (currentY > pageHeight - margin - 15) { doc.addPage(); pageNum++; addHeaderFooter(pageNum); currentY = margin; } doc.text(line, margin, currentY); currentY += 12; });
                outV.innerHTML = `<iframe src="${doc.output('datauristring')}" width="100%" height="100%" style="border:none;" title="Outline PDF"></iframe>`;
            } else { outV.innerHTML = "<p><i>Outline PDF cannot be generated or no outline data.</i></p>"; }
            views.forEach(v => v.hidden = true); outV.hidden = false; viewer.scrollTop = 0;
        });
    } else { /* ... (clear fields if no validAttemptId) ... */ }

    const views = [paperV, feedV, outV]; const buttons = [paperB, feedB, outB];
    const showView = (viewToShow) => { views.forEach(view => view.hidden = (view !== viewToShow)); viewer.scrollTop = 0; };
    const setActiveButton = (buttonToActivate) => buttons.forEach(btn => btn.setAttribute('aria-current', btn === buttonToActivate ? 'page' : 'false'));

    paperB.addEventListener('click', (e) => {
        e.preventDefault();
        setActiveButton(paperB);
        displayPdfInView(paperV, actualPaperIdForContent, "Past Paper Document");
        views.forEach(v => v.hidden = true); paperV.hidden = false; viewer.scrollTop = 0;
    });

    showView(paperV); setActiveButton(paperB);

    const retakeModalCloseElements = retakeModal.querySelectorAll('[data-close-modal], .modal__close-btn');
    let targetRetakeUrl = '';
    const openRetakeModalInstance = () => { /* ... (no changes) ... */ };
    const closeRetakeModalInstance = () => closeModal(retakeModal);
    retakeButton.addEventListener('click', (event) => { /* ... (no changes) ... */ });
    confirmRetakeBtn.addEventListener('click', () => { /* ... (no changes) ... */ });
    if(retakeModalCloseElements) retakeModalCloseElements.forEach(el => el.addEventListener('click', closeRetakeModalInstance));
    document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && retakeModal.classList.contains('is-visible')) closeRetakeModalInstance(); });
}

async function setupTestPage() { /* ... (PDF linking + OCR/AI fixes from previous version) ... */
    const timerDisplay = document.getElementById('timer-display');
    const timerButton = document.getElementById('timer-button');
    const confirmModal = document.getElementById('confirm-submit-modal');
    const confirmSubmitBtn = document.getElementById('confirm-submit-btn');
    const paperCodeHeading = document.getElementById('paper-code-heading');
    const answerTextarea = document.getElementById('answer-textarea');
    const fileUploadInput = document.getElementById('file-upload-input');
    const fileUploadFilename = document.getElementById('file-upload-filename');
    const paperViewerScroll = document.getElementById('paper-viewer-scroll');

    if (!timerDisplay || !timerButton || !confirmModal || !confirmSubmitBtn || !paperCodeHeading || !answerTextarea || !fileUploadInput || !fileUploadFilename || !paperViewerScroll) {
        console.warn("Test page elements missing."); return;
    }

    const { paperId, validPaperId } = getPaperInfoFromUrl();
    let displayCode = "Unknown Paper";
    let currentPaperData = null;

    if (validPaperId) {
        currentPaperData = ALL_PAPER_DATA_SOURCE.find(p => p.id === paperId);
        if (currentPaperData) {
            displayCode = formatPaperCode(paperId);
            paperCodeHeading.textContent = displayCode;
            document.title = `${displayCode} - Test - PaperBuddy`;

            const pdfFilename = paperIdToPdfFilename(paperId);
            if (pdfFilename) {
                const pdfPath = `papers/${pdfFilename}`;
                paperViewerScroll.innerHTML = `<iframe src="${pdfPath}" width="100%" height="100%" style="border: none;" title="Past Paper Document ${displayCode}">
                                                <p>Your browser does not support PDFs or the PDF could not be found at ${pdfPath}. Please download the PDF to view it: <a href="${pdfPath}" download>Download PDF</a>.</p>
                                              </iframe>`;
                console.log("[TestPage] Attempting to load PDF:", pdfPath);
            } else {
                paperViewerScroll.innerHTML = `<p style="padding: 1rem; text-align:center;"><i>Could not determine PDF filename for ${displayCode}. Ensure paper ID in data source is correct and matches file naming.</i></p>`;
            }
        } else {
            paperCodeHeading.textContent = "Invalid Paper ID"; document.title = `Test Error - PaperBuddy`;
            displayUserMessage("The paper ID is invalid or the paper data could not be found.", "error");
            paperViewerScroll.innerHTML = `<p style="padding: 1rem; text-align:center;"><i>Paper data not found for ID: ${paperId}.</i></p>`;
            timerButton.disabled = true; timerButton.textContent = "Error"; return;
        }
    } else {
         paperCodeHeading.textContent = displayCode; document.title = `Take Test - PaperBuddy`;
         displayUserMessage("Paper ID is missing. Cannot start test.", "error");
         paperViewerScroll.innerHTML = `<p style="padding: 1rem; text-align:center;"><i>No Paper ID provided. Cannot load paper.</i></p>`;
         timerButton.disabled = true; timerButton.textContent = "Invalid Paper"; return;
    }

    let timerInterval = null; let secondsElapsed = 0; let isTimerRunning = false;
    const updateDisplay = () => timerDisplay.textContent = formatTime(secondsElapsed);
    const startTimer = () => {
        if (isTimerRunning || !validPaperId) return;
        isTimerRunning = true; secondsElapsed = 0; updateDisplay();
        timerInterval = setInterval(() => { secondsElapsed++; updateDisplay(); }, 1000);
        timerButton.textContent = 'Submit'; timerButton.dataset.action = 'submit';
        answerTextarea.disabled = false; fileUploadInput.disabled = false;
        answerTextarea.placeholder = fileUploadInput.files[0] ? "File selected. Clear selection to type answer." : "Type your final answer here...";
    };
    const stopTimer = () => { clearInterval(timerInterval); isTimerRunning = false; };
    const openTestModalInstance = () => {
        const answerText = answerTextarea.value.trim(); const uploadedFile = fileUploadInput.files[0];
        if (!answerText && !uploadedFile) { displayUserMessage("Please enter an answer or upload a file before submitting.", "warning"); answerTextarea.focus(); return; }
        const focusTarget = confirmSubmitBtn || confirmModal.querySelector('button');
        openModal(confirmModal, focusTarget);
    };
    const closeTestModalInstance = () => closeModal(confirmModal);

    timerButton.addEventListener('click', () => {
        const action = timerButton.dataset.action;
        if (action === 'start') startTimer();
        else if (action === 'submit') openTestModalInstance();
    });

    fileUploadInput.addEventListener('change', () => { /* ... (no changes) ... */ });
    const modalCloseElements = confirmModal.querySelectorAll('[data-close-modal], .modal__close-btn');
    if(modalCloseElements) modalCloseElements.forEach(el => el.addEventListener('click', closeTestModalInstance));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && confirmModal.classList.contains('is-visible')) closeTestModalInstance(); });

    confirmSubmitBtn.addEventListener('click', async () => { /* ... (Same as previous full script with OCR/AI fixes and highlight_references storage) ... */
        const currentUsername = getCurrentUsername();
        if (!currentUsername || !validPaperId || !currentPaperData) {
             displayUserMessage("Submission error: User/Paper invalid or data missing.", "error");
             closeTestModalInstance(); return;
        }

        confirmSubmitBtn.disabled = true;
        confirmSubmitBtn.textContent = "Submitting...";
        let processingMessageTimer = setTimeout(() => {
            displayUserMessage("Still processing... AI feedback can take up to a minute.", "info", 15000);
        }, 10000);

        let userAnswer = answerTextarea.value.trim();
        const uploadedFile = fileUploadInput.files[0];
        let ocrAttempted = false;

        if (uploadedFile && !userAnswer) {
            ocrAttempted = true;
            displayUserMessage("Processing uploaded file with OCR...", "info", 7000);
            try {
                userAnswer = await getOcrTextFromImageOrPdf(uploadedFile);
                if (!userAnswer) {
                    displayUserMessage("OCR could not extract text. Please type your answer or try a different file.", "warning");
                    answerTextarea.disabled = false;
                    answerTextarea.placeholder = "OCR failed. Please type your answer here.";
                    answerTextarea.focus();
                    confirmSubmitBtn.disabled = false;
                    confirmSubmitBtn.textContent = "Confirm Submit";
                    clearTimeout(processingMessageTimer);
                    return;
                }
                displayUserMessage("File processed with OCR.", "success");
            } catch (ocrError) {
                displayUserMessage(`OCR Error: ${ocrError}. Please type your answer.`, "error");
                answerTextarea.disabled = false;
                answerTextarea.placeholder = "OCR failed. Please type your answer here.";
                answerTextarea.focus();
                confirmSubmitBtn.disabled = false;
                confirmSubmitBtn.textContent = "Confirm Submit";
                clearTimeout(processingMessageTimer);
                return;
            }
        }

        if (!userAnswer) {
            displayUserMessage("No answer provided (typed or from file). Please enter or upload an answer.", "warning");
            if (ocrAttempted) {
                answerTextarea.disabled = false;
                answerTextarea.placeholder = "Please type your answer here.";
                answerTextarea.focus();
            }
            confirmSubmitBtn.disabled = false;
            confirmSubmitBtn.textContent = "Confirm Submit";
            clearTimeout(processingMessageTimer);
            return;
        }

        if (isTimerRunning) stopTimer();
        clearTimeout(processingMessageTimer);
        displayUserMessage("Answer captured. Getting AI feedback...", "info", 25000);

        let aiResult;
        try {
            aiResult = await getAiFeedbackAndGrade(currentPaperData, userAnswer, currentPaperData.totalMarks);
        } catch (aiErrorReceived) {
            aiResult = aiErrorReceived;
            displayUserMessage("AI feedback generation encountered an issue. Result may be incomplete.", "warning");
        }

        const timestamp = Date.now();
        const sanitizedUsernamePart = currentUsername.replace(/[^a-zA-Z0-9_-]/g, '').substring(0,8);
        const newAttemptId = `${sanitizedUsernamePart}_${paperId.replace(/[^a-zA-Z0-9]/g, "")}_${timestamp}`;

        const attemptDataToSave = {
            paperId: paperId,
            timestamp: timestamp,
            duration: secondsElapsed,
            answerText: userAnswer.substring(0, 20000),
            fileName: uploadedFile ? uploadedFile.name : null,
            grade: aiResult.grade || "N/A",
            score: aiResult.score === undefined ? null : aiResult.score,
            totalMarks: aiResult.totalMarks === undefined ? (currentPaperData.totalMarks || null) : aiResult.totalMarks,
            feedback: aiResult.feedback || "Feedback not generated.",
            outline: aiResult.outline || "Outline not generated.",
            highlight_references: aiResult.highlight_references || []
        };

        const attemptDataKey = getUserStorageKey(`${BASE_STORAGE_KEYS.ATTEMPT_DETAILS_PREFIX}${newAttemptId}`);
        const savedAttempt = setStorageItem(attemptDataKey, attemptDataToSave);

        const userStatuses = getUserData(BASE_STORAGE_KEYS.PAPER_STATUSES, {});
        userStatuses[paperId] = { status: 'done', linkAttemptId: newAttemptId };
        setUserData(BASE_STORAGE_KEYS.PAPER_STATUSES, userStatuses);

        confirmSubmitBtn.disabled = false;
        confirmSubmitBtn.textContent = "Confirm Submit";
        closeTestModalInstance();

        if (savedAttempt) {
            displayUserMessage("Attempt submitted successfully!", "success");
            const resultUrl = `result.html?attemptId=${encodeURIComponent(newAttemptId)}&paperId=${encodeURIComponent(paperId)}`;
            setTimeout(() => { window.location.href = resultUrl; }, 1000);
        }
    });

    updateDisplay();
    answerTextarea.disabled = true; fileUploadInput.disabled = true;
    answerTextarea.placeholder = "Start the exam to type or upload.";
}

function setupResultPage() { /* ... (jsPDF download logic is here from previous version) ... */
    const deleteButton = document.getElementById('delete-attempt-btn');
    const deleteModal = document.getElementById('confirm-delete-modal');
    const confirmDeleteBtn = document.getElementById('confirm-delete-action-btn');
    const paperCodeHeading = document.getElementById('result-paper-code');
    const gradeElement = document.getElementById('result-grade');
    const durationElement = document.getElementById('result-duration');
    const rawScoreElement = document.getElementById('result-raw-score');
    const sectionAElement = document.getElementById('result-section-a');
    const sectionBElement = document.getElementById('result-section-b');
    const sectionCElement = document.getElementById('result-section-c');
    const downloadFeedbackBtn = document.getElementById('download-feedback-btn');
    const downloadOutlineBtn = document.getElementById('download-outline-btn');


    if (!deleteButton || !deleteModal || !confirmDeleteBtn || !paperCodeHeading || !gradeElement || !durationElement || !rawScoreElement || !downloadFeedbackBtn || !downloadOutlineBtn) {
        console.warn("Result page elements missing."); return;
    }

    const { attemptId, paperId, validAttemptId, validPaperId } = getPaperInfoFromUrl();
    let displayCode = "Result";
    let actualPaperIdForResult = paperId;
    let attemptData = {};

    if (validAttemptId && !validPaperId) {
        const attemptDataKeyForPaperId = getUserStorageKey(`${BASE_STORAGE_KEYS.ATTEMPT_DETAILS_PREFIX}${attemptId}`);
        const tempAttemptData = getStorageItem(attemptDataKeyForPaperId, {});
        if (tempAttemptData.paperId) {
            actualPaperIdForResult = tempAttemptData.paperId;
        } else {
            const parts = attemptId.split('_');
            if (parts.length >= 2 && parts[1].includes('-')) actualPaperIdForResult = parts[1];
        }
    }

    displayCode = actualPaperIdForResult ? formatPaperCode(actualPaperIdForResult) : (validAttemptId ? attemptId : "Result");
    paperCodeHeading.textContent = displayCode;
    document.title = `${displayCode} - Result - PaperBuddy`;

    if (validAttemptId) {
        const attemptDataKey = getUserStorageKey(`${BASE_STORAGE_KEYS.ATTEMPT_DETAILS_PREFIX}${attemptId}`);
        attemptData = getStorageItem(attemptDataKey, {});

        gradeElement.textContent = attemptData.grade || '--';
        durationElement.textContent = attemptData.duration ? formatTime(attemptData.duration) : '--:--:--';
        rawScoreElement.textContent = (attemptData.score !== undefined && attemptData.totalMarks !== undefined) ? `${attemptData.score} / ${attemptData.totalMarks}` : '-- / --';

        const paperInfoForTotalMarks = ALL_PAPER_DATA_SOURCE.find(p => p.id === (attemptData.paperId || actualPaperIdForResult));
        const totalMarksForPaper = paperInfoForTotalMarks?.totalMarks || (attemptData.totalMarks || 0);

        if (sectionAElement) sectionAElement.textContent = attemptData.sectionAScore !== undefined ? `${attemptData.sectionAScore} / ${Math.floor(totalMarksForPaper/3)}` : `-- / ${Math.floor(totalMarksForPaper/3) || '--'}`;
        if (sectionBElement) sectionBElement.textContent = attemptData.sectionBScore !== undefined ? `${attemptData.sectionBScore} / ${Math.floor(totalMarksForPaper/3)}` : `-- / ${Math.floor(totalMarksForPaper/3) || '--'}`;
        if (sectionCElement) sectionCElement.textContent = attemptData.sectionCScore !== undefined ? `${attemptData.sectionCScore} / ${totalMarksForPaper - 2*Math.floor(totalMarksForPaper/3)}` : `-- / ${totalMarksForPaper - 2*Math.floor(totalMarksForPaper/3) || '--'}`;

    } else {
        gradeElement.textContent = '--'; durationElement.textContent = '--:--:--'; rawScoreElement.textContent = '-- / --';
        if (sectionAElement) sectionAElement.textContent = "-- / --";
        if (sectionBElement) sectionBElement.textContent = "-- / --";
        if (sectionCElement) sectionCElement.textContent = "-- / --";
        displayUserMessage("Could not load result details: Invalid attempt ID.", "error");
    }

    if (downloadFeedbackBtn) {
        if (attemptData.feedback) {
            downloadFeedbackBtn.addEventListener('click', (e) => {
                e.preventDefault();
                if (typeof jsPDF !== 'undefined') {
                    const { jsPDF } = window.jspdf; const doc = new jsPDF({ unit: 'pt', format: 'a4' });
                    doc.setFont("helvetica", "normal");

                    let currentY = 40;
                    const pageHeight = doc.internal.pageSize.getHeight();
                    const pageWidth = doc.internal.pageSize.getWidth();
                    const margin = 40;
                    const maxLineWidth = pageWidth - (margin * 2);

                    const addHeaderFooter = (pageNum) => { doc.setFontSize(10); doc.text(`Feedback: ${displayCode}`, margin, 25); doc.text(`Page ${pageNum}`, pageWidth - margin - 10, 25, { align: 'right' }); doc.line(margin, pageHeight - 30, pageWidth - margin, pageHeight - 30); doc.text(`PaperBuddy Attempt ${attemptId.substring(0,8)}`, margin, pageHeight - 15);};
                    let pageNum = 1; addHeaderFooter(pageNum);

                    doc.setFontSize(14); doc.setFont("helvetica", "bold"); doc.text("Attempt Details", margin, currentY); currentY += 20;
                    doc.setFontSize(10); doc.setFont("helvetica", "normal"); doc.text(`Paper: ${displayCode}`, margin, currentY); currentY += 15;
                    doc.text(`Score: ${attemptData.score || '--'} / ${attemptData.totalMarks || '--'} | Grade: ${attemptData.grade || '--'} | Duration: ${formatTime(attemptData.duration || 0)}`, margin, currentY); currentY += 25;
                    doc.setFontSize(12); doc.setFont("helvetica", "bold"); doc.text("Student's Answer (Snippet):", margin, currentY); currentY += 18;
                    doc.setFontSize(10); doc.setFont("helvetica", "normal"); const studentAnswerLines = doc.splitTextToSize(attemptData.answerText ? attemptData.answerText.substring(0, 2000) + (attemptData.answerText.length > 2000 ? "..." : "") : "N/A", maxLineWidth);
                    studentAnswerLines.forEach(line => { if (currentY > pageHeight - margin - 15) { doc.addPage(); pageNum++; addHeaderFooter(pageNum); currentY = margin; } doc.text(line, margin, currentY); currentY += 12; }); currentY += 10;
                    doc.setFontSize(12); doc.setFont("helvetica", "bold"); doc.text("AI Feedback:", margin, currentY); currentY += 18;
                    doc.setFontSize(10); doc.setFont("helvetica", "normal"); const feedbackLines = doc.splitTextToSize(attemptData.feedback.replace(/<br>/g, '\n'), maxLineWidth);
                    feedbackLines.forEach(line => { if (currentY > pageHeight - margin - 15) { doc.addPage(); pageNum++; addHeaderFooter(pageNum); currentY = margin; } doc.text(line, margin, currentY); currentY += 12; });
                    if (attemptData.highlight_references && attemptData.highlight_references.length > 0) { if (currentY > pageHeight - margin - 40) { doc.addPage(); pageNum++; addHeaderFooter(pageNum); currentY = margin; } else { currentY += 10; } doc.setFontSize(12); doc.setFont("helvetica", "bold"); doc.text("Key Points Noted (from Mark Scheme perspective):", margin, currentY); currentY += 18; doc.setFontSize(9); doc.setFont("helvetica", "normal"); attemptData.highlight_references.forEach(ref => { if (currentY > pageHeight - margin - 15) { doc.addPage(); pageNum++; addHeaderFooter(pageNum); currentY = margin; } const refText = `- "${ref.student_phrase}" (${ref.significance || 'N/A'})`; const refLines = doc.splitTextToSize(refText, maxLineWidth); refLines.forEach(line => { if (currentY > pageHeight - margin -15) {doc.addPage(); pageNum++; addHeaderFooter(pageNum); currentY = margin;} doc.text(line, margin + 5, currentY); currentY+=10; }); });}

                    doc.save(`feedback_${(actualPaperIdForResult || 'attempt').replace(/[^a-zA-Z0-9]/g, "_")}_${attemptId.substring(0,5)}.pdf`);
                    displayUserMessage("Feedback PDF downloading...", "success");
                } else { displayUserMessage("PDF generation library not loaded.", "error"); }
            });
        } else { downloadFeedbackBtn.disabled = true; downloadFeedbackBtn.title = "No feedback available."; }
    }

    if (downloadOutlineBtn) {
        if (attemptData.outline) {
            downloadOutlineBtn.addEventListener('click', (e) => {
                e.preventDefault();
                if (typeof jsPDF !== 'undefined') {
                    const { jsPDF } = window.jspdf; const doc = new jsPDF({ unit: 'pt', format: 'a4' });
                    doc.setFont("helvetica", "normal");
                    let currentY = 40; const pageHeight = doc.internal.pageSize.getHeight(); const pageWidth = doc.internal.pageSize.getWidth(); const margin = 40; const maxLineWidth = pageWidth - (margin * 2);
                    const addHeaderFooter = (pageNum) => { doc.setFontSize(10); doc.text(`Outline: ${displayCode}`, margin, 25); doc.text(`Page ${pageNum}`, pageWidth - margin - 10, 25, { align: 'right' }); doc.line(margin, pageHeight - 30, pageWidth - margin, pageHeight - 30); doc.text(`PaperBuddy Attempt ${attemptId.substring(0,8)}`, margin, pageHeight - 15);};
                    let pageNum = 1; addHeaderFooter(pageNum);
                    doc.setFontSize(14); doc.setFont("helvetica", "bold"); doc.text("Model Answer Outline", margin, currentY); currentY += 25;
                    doc.setFontSize(10); doc.setFont("helvetica", "normal");
                    const outlineLines = doc.splitTextToSize(attemptData.outline.replace(/<br>/g, '\n'), maxLineWidth);
                     outlineLines.forEach(line => { if (currentY > pageHeight - margin - 15) { doc.addPage(); pageNum++; addHeaderFooter(pageNum); currentY = margin; } doc.text(line, margin, currentY); currentY += 12; });
                    doc.save(`outline_${(actualPaperIdForResult || 'attempt').replace(/[^a-zA-Z0-9]/g, "_")}_${attemptId.substring(0,5)}.pdf`);
                    displayUserMessage("Outline PDF downloading...", "success");
                } else { displayUserMessage("PDF generation library not loaded.", "error"); }
            });
        } else { downloadOutlineBtn.disabled = true; downloadOutlineBtn.title = "No outline available."; }
    }

    const modalCloseElements = deleteModal.querySelectorAll('[data-close-modal], .modal__close-btn');
    const openDeleteModalInstance = () => { /* ... (no changes) ... */ };
    const closeDeleteModalInstance = () => closeModal(deleteModal);
    deleteButton.addEventListener('click', () => { /* ... (no changes) ... */ });
    confirmDeleteBtn.addEventListener('click', () => { /* ... (no changes) ... */ });
    if(modalCloseElements) modalCloseElements.forEach(el => el.addEventListener('click', closeDeleteModalInstance));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && deleteModal.classList.contains('is-visible')) closeDeleteModalInstance(); });
}