# StudySync

StudySync is a collaborative study platform where students can create groups, share resources, and work together in real time.

## Features

- **Study groups** with invite links and member management.
- **Live study rooms** with Socket.IO chat and a shared whiteboard.
- **Resource hub** with PDF and image uploads to AWS S3 and group-restricted downloads.
- **Quizzes and flashcards** for group practice.
- **Tutor marketplace** with session booking.

## Tech stack

React, Vite, Node.js, Express, MongoDB, Mongoose, Socket.IO, and AWS S3.

## Run locally

You’ll need Node.js, npm, and a running MongoDB instance. Configure the backend’s local `.env` before starting it. The resource hub also requires access to a private S3 bucket.

From the repository root, start the backend in one terminal:

```powershell
cd backend
npm ci
npm run dev
```

From the repository root, start the frontend in another terminal:

```powershell
cd frontend
npm ci
npm run dev
```

- Frontend: http://localhost:5173
- API health check: http://localhost:5000/api/health

## Try the shared whiteboard

Sign in with two accounts in separate browser windows. Join the same study group, open its live room in both windows, and draw in one window. The strokes should appear in the other window.
