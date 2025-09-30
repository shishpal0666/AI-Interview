# Swipe Internship Assignment — AI-Powered Interview Assistant (Crisp)

This repo sets up assignment for internship on Swipe: a small React app to be an AI interview assistant for Full Stack (React/Node) role.

Delivery includes live demo, video and instructions for submission.

## What the app does
- There are two primary tabs (views): Interviewee (chat) and Interviewer (dashboard). Both stay in sync using local persistence, along with an event broadcast helper.
- Interviewee Flow:
  - A candidate uploads a resume (PDF required; DOCX optional).
  - The app extracts Name, Email, Phone from the resume text. If any field is missing or invalid, the candidate is asked to provide or modify it before starting.
  - The interview is carried out as a timed chat: AI will generate 6 questions (2 Easy, 2 Medium, 2 Hard) about full stack topics concerning React/Node and evaluate answers post-completion. 
  - The questions are revealed one at a time. The timer assigned to each question varies (Easy 20s, Medium 60s, Hard 120s). When time expires, the answer is auto-submitted.
- Interviewer Flow: Dashboard
  - Candidates come in a descending order on the score list.
  - The candidate's question/answer pairs, AI feedback per question, and the final AI summary appears on a click. 
  - Search and sort are available in table view.
- Persistence: 
  - All data persistent in local (Redux store + localStorage snapshots); even if the candidate refreshes or closes the page, the session gets restored with display of ''Welcome Back!'' modal for unfinished sessions. 
- Friendly error handling, therefore, and toasts for invalid files, missing data, and AI failures. 

## Core Requirements (how this project fulfills) 

- Resume Upload: Accepts PDF and DOCX. Text data is extracted using PDF.js and mammoth, then run through a lightweight `extractFields` function to pull Name, Email, and Phone.
- Missing Fields: If any of the fields are missing or invalid, the UI prompts the candidate for editing those fields (with validation) before starting the interview.
- Interview Flow: AI generates questions from a `geminiClient` helper and evaluates answers. The app shows questions 1-by-1, enforces timers, auto-submits on timeout, and computes a final score + summary after all answers are submitted.
- Two Tabs- `Interviewee' (chat) and `Interviewer' (dashboard) are provided and wired into the app router.
- Persistence: It saves the unfinished session and can be restored with Redux (Redux Toolkit) for the state and local storage for snapshots.

## Tech stack and notable libraries

- React + Vite
- Redux Toolkit for state
- Ant Design for UI
- pdfjs-dist for PDF parsing
- mammoth for DOCX text extraction
- An AI client helper (`src/utils/geminiClient.js`) that talks to a Generative Language API (you must provide an API key via env var `VITE_GEMINI_API_KEY` if you want to enable AI calls)

## Local development

1. Install dependencies

```bash
npm install
```

2. Start the dev server

```bash
npm run dev
```

3. Open http://localhost:5173 (or the port printed by Vite).
In the notes: 
- If you do not have a Gemini/OpenAI key configured, the app will still run for most UI flows; AI question generation and evaluation will fail gracefully and show helpful messages. 
- This app keeps data on purpose in local storage so you can test pause-resume and reload restoring behaviors.

## Environment variables

- `VITE_GEMINI_API_KEY` — optional. If provided, the app will call the Generative Language API to generate questions and evaluate answers.

## Files of interest

- `src/pages/Interviewee.jsx` — landing page for candidates (upload resume) and starts the chat.
- `src/pages/Chat.jsx` — the chat UI and timed interview flow.
- `src/pages/Dashboard.jsx` — interviewer dashboard and per-candidate details.
- `src/components/DocExtractor.jsx` — resume upload, parsing, and candidate creation.
- `src/store/sessionSlice.js` — Redux slice that manages sessions, questions, and answers.
- `src/utils/geminiClient.js` — AI client used to generate questions and evaluate answers.
- `src/utils/extractFields.js` — simple heuristic parser to extract name/email/phone from text.

## How to test the core flows

1. Interviewee flow
   - Go to the Interviewee tab and upload a PDF resume (or DOCX). The app will attempt to extract name/email/phone.
   - If any field is missing or invalid, edit them in the UI and click "Start Chat".
   - The chat will present a timed question. Type an answer and click Send or wait for time to expire.
   - After 6 questions, the AI evaluation runs (if AI is available) and any summary + per-question feedback is shown.

2. Interviewer flow
   - Go to the Interviewer tab to see candidates and scores.
   - Click a candidate to open detailed session history and the final summary.

3. Persistence / Welcome back
   - Start a session and refresh the page or close the tab. When you reopen the app, a "Welcome back" modal should appear asking if you would like to resume.

## Assignment deliverables checklist

1. Public GitHub repo — https://github.com/shishpal0666/AI-Interview
2. Live demo — https://ai-interview-lake-xi.vercel.app/
3. 2–5 minute demo video — https://drive.google.com/drive/u/0/folders/1Zs5YTNjsnopEg24dn9Et_L-_qHQ7eRSA

## Notes & decisions 

- The app is using a pragmatic approach to resume parsing, that is, heuristic extraction. This is acceptable for a take-home test; but for production, you'd use a structured resume parser. 
- Errors and retry logic for AI calls are wrapped with user-friendly messages when a failure is detected due to network or server issues.

## Known issues / To Do 

- Small UX polishing (animations, focus/keyboard access) can improve further. 

## Contact

Should you have any questions or want me to modify the behavior (different timers, more/less questions, or stricter validation), open an issue or contact the repo owner:

- Email: shishpalpolampally@gmail.com
- Website: https://shishpal-portfolio.vercel.app/

---

Good luck, and thanks for reviewing this submission!
