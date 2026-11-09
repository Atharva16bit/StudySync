# StudySync

StudySync is a full-stack collaborative study platform. Students can create study groups, invite classmates, share notes, and work through problems together in a live room with chat and a shared whiteboard. The platform also supports group quizzes, flashcards, and tutor booking.

**[Open the live app](https://studysync-3eyn.onrender.com/)** · **[Watch the demo](YOUR_DEMO_VIDEO_URL)** · **[Check API health](https://studysync-3eyn.onrender.com/api/health)**

The live demo runs on a free Render instance. The first request after a period of inactivity may take about a minute.

## Features

| Feature | What you can do |
|---|---|
| Study groups | Create a group, invite classmates with a link, and manage group membership. |
| Live study rooms | Chat and draw on a shared canvas. Connected group members see whiteboard strokes as they happen. |
| Resource hub | Upload PDFs and images, find shared files, and download them as a group member. |
| Quizzes and flashcards | Create group study material, practice with multiple-choice questions or flashcards, and track quiz scores. |
| Tutor marketplace | Browse verified tutors, book an available session, and view your bookings. |

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React, Vite, JavaScript, CSS, HTML5 Canvas |
| Backend | Node.js, Express |
| Real-time communication | Socket.IO |
| Database | MongoDB and Mongoose |
| File storage | Amazon S3, AWS SDK for JavaScript, Multer |
| Deployment | Render Web Service and MongoDB Atlas |

## How it works

- **HTTP and sessions.** The React client sends requests to Express under `/api`. The backend handles authentication and uses session cookies to identify signed-in users.
- **Live collaboration.** The canvas draws strokes locally for immediate feedback. Socket.IO sends drawing coordinates to the server, which relays them to the other clients in the study room.
- **Private resources.** MongoDB stores resource metadata, and S3 stores the uploaded files. The backend checks group membership before issuing a short-lived download URL.
- **Deployment.** In development, Vite proxies API and Socket.IO traffic to Express. In production, Express serves the Vite build, the API, and Socket.IO from the same public origin. Refreshing a React route loads the app, while an unknown API path returns a JSON `404`.

## Repository structure

| Path | Purpose |
|---|---|
| `frontend/src/` | React pages, UI components, and API client |
| `frontend/src/Room.jsx` | Live room, chat, and collaborative canvas |
| `frontend/vite.config.js` | Local development server and proxy configuration |
| `backend/src/app.js` | Express middleware, API routes, and production frontend serving |
| `backend/src/server.js` | MongoDB startup and HTTP server initialization |
| `backend/src/routes/` | Authentication, groups, resources, quizzes, and tutor endpoints |
| `backend/src/models/` | Mongoose schemas and indexes |
| `backend/src/socket/` | Socket.IO connection and room event handlers |
| `backend/.env.example` | Backend environment variable template |

## Run locally

### Prerequisites

- Node.js and npm. Node.js 26 was used to build and run the project.
- A running local MongoDB instance or a MongoDB Atlas cluster.
- A private S3 bucket and AWS credentials for testing resource uploads and downloads.

### 1. Clone and configure

```powershell
git clone https://github.com/Atharva16bit/StudySync.git
cd StudySync
Copy-Item .\backend\.env.example .\backend\.env
```

Open `backend/.env` and fill in the values for your environment.

| Variable | Local value or purpose |
|---|---|
| `PORT` | `5000` |
| `MONGODB_URI` | `mongodb://127.0.0.1:27017/studysync` for local MongoDB, or your Atlas connection string |
| `APP_ORIGIN` | `http://localhost:5173` for Vite development. Optional when using this default. |
| `AWS_REGION` | Region where your S3 bucket was created |
| `S3_BUCKET` | Name of your private bucket |
| `AWS_ACCESS_KEY_ID` | Access key ID for the AWS identity used by the backend |
| `AWS_SECRET_ACCESS_KEY` | Matching secret access key |

Keep `backend/.env` private. Commit `backend/.env.example` with placeholders only.

### 2. Start the backend

From the repository root, run:

```powershell
npm ci --prefix backend
npm run dev --prefix backend
```

The backend health endpoint is at <http://localhost:5000/api/health>.

### 3. Start the frontend

Open a second terminal at the repository root and run:

```powershell
npm ci --prefix frontend --include=dev
npm run dev --prefix frontend
```

Open <http://localhost:5173/> in your browser.

## Deploy on Render

Create a **Node Web Service** from this repository’s `main` branch.

| Setting | Value |
|---|---|
| Root Directory | Leave blank to build from the repository root |
| Build Command | `npm ci --prefix backend && npm ci --prefix frontend --include=dev && npm run build --prefix frontend` |
| Start Command | `node backend/src/server.js` |
| Health Check Path | `/api/health` |

Set the backend environment variables in Render. Use the Atlas URI for `MONGODB_URI`, the public app URL without a trailing slash for `APP_ORIGIN`, and your private S3 configuration for the AWS variables. Render supplies `PORT`. Add the service’s outbound IP ranges to the Atlas project’s IP access list before deploying.

After the service is live, verify that `/` loads the app, `/login` works on refresh, and `/api/health` returns `{"status":"ok","service":"studysync-api"}`.

## Demo walkthrough

1. Open the app in a normal browser window and an incognito window. Sign in with a different account in each.
2. Create a study group with the first account. Use its invite link to join with the second account.
3. Open the same study room in both windows. Send a chat message and draw a stroke. Confirm both appear in the other window.
4. Upload a sample PDF in one window and download it in the other.
5. Open a group quiz or flashcard set and complete a practice attempt.

## Author

Built by [Atharva Patankar](https://github.com/Atharva16bit).
