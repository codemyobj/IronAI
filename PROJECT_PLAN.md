# IronAI — Workout & Diet AI App: Complete Learning Plan

## 🎯 What You'll Build

A full-stack fitness app where users can log in, manage training programs, track diet, and get AI-powered analysis & diet recommendations.

---

## 📐 Architecture Overview

```
┌─────────────────────┐     HTTP/REST      ┌─────────────────────┐
│   React (Vite)      │ ◄──────────────►   │   Express API       │
│   TypeScript        │     JSON + JWT     │   TypeScript        │
│   Port 5173         │                    │   Port 3000          │
└─────────────────────┘                    └──────────┬──────────┘
                                                      │
                                            ┌─────────▼──────────┐
                                            │   MySQL Database    │
                                            │   Port 3306         │
                                            └────────────────────┘
                                                      │
                                            ┌─────────▼──────────┐
                                            │   DeepSeek API     │
                                            │   (AI Analysis)    │
                                            └────────────────────┘
```

---

## 🗂️ Final Project Structure (for reference)

```
IronAI/
├── client/                     # React frontend
│   ├── index.html
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── api/                # API call functions
│       │   └── client.ts       # Axios instance + interceptors
│       ├── components/         # Reusable UI pieces
│       │   ├── Layout.tsx
│       │   ├── Navbar.tsx
│       │   └── ProtectedRoute.tsx
│       ├── pages/
│       │   ├── LoginPage.tsx
│       │   ├── RegisterPage.tsx
│       │   ├── DashboardPage.tsx
│       │   ├── TrainingPage.tsx
│       │   ├── DietPage.tsx
│       │   └── AIAnalysisPage.tsx
│       ├── hooks/              # Custom React hooks
│       │   ├── useAuth.ts
│       │   ├── useTraining.ts
│       │   └── useDiet.ts
│       └── types/              # TypeScript interfaces
│           └── index.ts
│
├── server/                     # Node.js backend
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts            # Entry point — starts the server
│       ├── config/
│       │   └── db.ts           # MySQL connection pool
│       ├── middleware/
│       │   └── auth.ts         # JWT verification middleware
│       ├── routes/
│       │   ├── auth.ts         # POST /register, /login
│       │   ├── training.ts     # CRUD for training programs
│       │   ├── diet.ts         # CRUD for diet records
│       │   └── ai.ts           # AI analysis & diet endpoints
│       ├── controllers/        # Business logic (one per route)
│       │   ├── authController.ts
│       │   ├── trainingController.ts
│       │   ├── dietController.ts
│       │   └── aiController.ts
│       └── types/
│           └── index.ts
│
└── database/
    └── schema.sql              # All table definitions
```

---

# 📅 Step-by-Step Learning Plan

---

## PHASE 1 — Foundation (Days 1–3)

### Step 1.1: Install Prerequisites

Make sure you have these installed on your Windows machine:

| Tool | Check command | Why you need it |
|------|--------------|-----------------|
| Node.js (v18+) | `node -v` | Runs JavaScript outside the browser |
| npm | `npm -v` | Installs packages |
| MySQL 8 | `mysql -V` | Your database |
| Git | `git --version` | Version control (optional but good practice) |

### Step 1.2: Initialize the Project

```powershell
# Create the root folder and enter it
mkdir IronAI
cd IronAI

# Initialize Git
git init

# Create a .gitignore
```

**What to learn here:** Understand what `package.json` is — it's the manifest file that lists your dependencies and scripts. Every Node project has one.

Create the `.gitignore`:
```
node_modules/
dist/
.env
```

### Step 1.3: Set Up the Database

Install MySQL, then create the database:

```sql
CREATE DATABASE ironai CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'ironai_user'@'localhost' IDENTIFIED BY 'your_password_here';
GRANT ALL PRIVILEGES ON ironai.* TO 'ironai_user'@'localhost';
FLUSH PRIVILEGES;
```

**Design the schema** — this is where you learn data modeling. Think about: "what does my app store?"

```sql
-- database/schema.sql

-- Stores user accounts
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(100) NOT NULL,
  age INT,
  height_cm DECIMAL(5,1),
  weight_kg DECIMAL(5,1),
  fitness_goal ENUM('lose_weight', 'build_muscle', 'endurance', 'general') DEFAULT 'general',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Stores training programs (templates)
CREATE TABLE training_programs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  difficulty ENUM('beginner', 'intermediate', 'advanced') DEFAULT 'beginner',
  target_muscle_group VARCHAR(100),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Individual exercises within a program
CREATE TABLE exercises (
  id INT AUTO_INCREMENT PRIMARY KEY,
  program_id INT NOT NULL,
  name VARCHAR(200) NOT NULL,
  sets INT DEFAULT 3,
  reps INT DEFAULT 10,
  weight_kg DECIMAL(6,1),
  rest_seconds INT DEFAULT 60,
  notes TEXT,
  sort_order INT DEFAULT 0,
  FOREIGN KEY (program_id) REFERENCES training_programs(id) ON DELETE CASCADE
);

-- Records of completed training sessions
CREATE TABLE training_sessions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  program_id INT,
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ended_at TIMESTAMP NULL,
  duration_minutes INT,
  perceived_effort INT CHECK (perceived_effort BETWEEN 1 AND 10),
  notes TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (program_id) REFERENCES training_programs(id) ON DELETE SET NULL
);

-- Daily diet/food records
CREATE TABLE diet_records (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  meal_type ENUM('breakfast', 'lunch', 'dinner', 'snack') NOT NULL,
  food_name VARCHAR(300) NOT NULL,
  calories INT,
  protein_grams DECIMAL(6,1),
  carbs_grams DECIMAL(6,1),
  fat_grams DECIMAL(6,1),
  portion_description VARCHAR(200),
  recorded_at DATE NOT NULL DEFAULT (CURRENT_DATE),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- AI analysis results (cached/saved)
CREATE TABLE ai_analyses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  analysis_type ENUM('training', 'diet') NOT NULL,
  request_data JSON,
  response_text TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

**What to learn here:**
- Primary keys, foreign keys, constraints
- ENUM types for fixed-choice fields
- JSON column for flexible AI data
- ON DELETE CASCADE — when a user is deleted, all their data goes too

### Step 1.4: Understand the Data Flow

Before writing code, trace through each feature in plain English:

**Login flow:**
1. User types email + password → React form
2. Form sends POST /api/auth/login with `{email, password}`
3. Server looks up user by email in MySQL
4. Server compares password hash with bcrypt
5. If match → server creates a JWT token, sends it back
6. React stores the token in localStorage
7. All future requests include the token in Authorization header
8. Server middleware verifies the token on protected routes

**AI analysis flow:**
1. User clicks "Analyze My Training" → React sends GET /api/ai/training-analysis
2. Server fetches user's recent training sessions from MySQL
3. Server sends that data + user profile to DeepSeek API with a prompt like "Analyze this training data and suggest improvements"
4. DeepSeek returns markdown text
5. Server saves the analysis, returns it to React
6. React renders the markdown

---

## PHASE 2 — Backend API (Days 4–8)

This is where you build the server first, because the frontend needs something to talk to.

### Step 2.1: Initialize the Server Project

```powershell
cd IronAI
mkdir server
cd server
npm init -y
npm install express cors dotenv mysql2 bcryptjs jsonwebtoken
npm install -D typescript @types/node @types/express @types/cors @types/bcryptjs @types/jsonwebtoken ts-node tsx
npx tsc --init
```

**Package explanations (learn what each does):**

| Package | Purpose |
|---------|---------|
| `express` | Web framework — handles HTTP requests/responses |
| `cors` | Allows your React app (different port) to call the API |
| `dotenv` | Loads `.env` file into `process.env` (secrets!) |
| `mysql2` | Connects to MySQL (promise-based, faster than `mysql`) |
| `bcryptjs` | Hashes passwords — never store plain text passwords |
| `jsonwebtoken` | Creates & verifies JWT tokens for authentication |
| `tsx` | Runs TypeScript directly without a compile step |

### Step 2.2: Configure TypeScript

Edit `server/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"]
}
```

### Step 2.3: Create the Environment File

`server/.env`:
```
PORT=3000
DB_HOST=localhost
DB_USER=ironai_user
DB_PASSWORD=your_password_here
DB_NAME=ironai
JWT_SECRET=your_super_secret_random_string_here
DEEPSEEK_API_KEY=your_deepseek_api_key_here
```

**Important:** The `.env` file contains secrets — NEVER commit it to Git. This is a fundamental security practice.

### Step 2.4: Build the Database Connection

`server/src/config/db.ts`:
- Create a MySQL connection pool (not a single connection — pools reuse connections, which is much faster)
- A pool manages multiple connections and hands them out as needed

```typescript
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
});

export default pool;
```

**Concept to learn:** Connection pool vs single connection. A pool is like having 10 phone lines instead of 1 — multiple people can talk at once.

### Step 2.5: Build the Auth Middleware

`server/src/middleware/auth.ts`:

This is the gatekeeper. Every protected route calls this middleware first.

```typescript
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// Extend Express Request to include user info
export interface AuthRequest extends Request {
  userId?: number;
}

export const authMiddleware = (req: AuthRequest, res: Response, next: NextFunction) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = header.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: number };
    req.userId = decoded.userId;
    next(); // Pass control to the next handler
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
};
```

**Concept to learn:** Middleware pattern — functions that run in a chain. `next()` passes control to the next function. This is Express's most important concept.

### Step 2.6: Build Route: Auth (Register + Login)

`server/src/routes/auth.ts`:

**POST /api/auth/register:**
1. Validate input (email format, password length)
2. Check if email already exists
3. Hash password with bcrypt (salt rounds = 10)
4. INSERT user into MySQL
5. Return JWT token + user info

**POST /api/auth/login:**
1. Find user by email
2. Compare password with bcrypt
3. If match → create JWT, return it
4. If no match → return 401

**Concept to learn:**
- **Hashing vs Encryption:** Hashing is one-way (can't reverse). That's why even if your DB leaks, attackers can't read passwords.
- **JWT (JSON Web Token):** A signed token. The server can verify "yes, I created this token" without storing it. Structure: `header.payload.signature`. The payload contains `{ userId, exp }` (expiration).
- **Salt:** Random data added to password before hashing, so two users with the same password get different hashes.

### Step 2.7: Build Route: Training Programs (CRUD)

`server/src/routes/training.ts`:

| Method | Endpoint | What it does |
|--------|----------|--------------|
| GET | /api/training/programs | List user's programs |
| POST | /api/training/programs | Create a new program |
| GET | /api/training/programs/:id | Get one program (with exercises) |
| PUT | /api/training/programs/:id | Update a program |
| DELETE | /api/training/programs/:id | Delete a program |
| POST | /api/training/sessions | Log a completed session |
| GET | /api/training/sessions | List recent sessions |

All protected by `authMiddleware`. Each uses `req.userId` to scope data to the logged-in user.

**Concept to learn:** CRUD (Create, Read, Update, Delete) — the backbone of 90% of web apps. RESTful routing conventions.

### Step 2.8: Build Route: Diet Records (CRUD)

`server/src/routes/diet.ts`:

| Method | Endpoint | What it does |
|--------|----------|--------------|
| GET | /api/diet/records?date=2026-06-23 | Get records for a day |
| POST | /api/diet/records | Add a food entry |
| DELETE | /api/diet/records/:id | Delete a food entry |
| GET | /api/diet/summary?start=&end= | Calorie/macro summary for date range |

### Step 2.9: Build Route: AI Analysis

`server/src/routes/ai.ts`:

**POST /api/ai/training-analysis:**
1. Fetch user's training sessions (last 30 days)
2. Fetch user profile (age, weight, goal, etc.)
3. Construct a prompt for DeepSeek:

```
You are an expert fitness coach. Analyze this user's training data:

User Profile:
- Age: 28, Weight: 75kg, Height: 178cm, Goal: build_muscle

Training Sessions (last 30 days):
- June 20: Chest/Triceps, 45 min, effort 7/10
- June 22: Back/Biceps, 50 min, effort 8/10
...

Provide analysis in these sections:
1. Training frequency assessment
2. Volume & intensity evaluation
3. Muscle group balance
4. Specific improvements
5. Weekly plan suggestion
```

4. Call DeepSeek API (OpenAI-compatible endpoint)
5. Save analysis to `ai_analyses` table
6. Return the markdown text

**POST /api/diet/recommendation:**
1. Fetch user's diet records and profile
2. Send to DeepSeek with a dietitian prompt
3. Return AI-generated meal recommendations

**Concept to learn:**
- **Prompt Engineering:** The quality of AI output depends heavily on how you structure the prompt. Be specific about: role, context, format, and constraints.
- **API Integration:** Third-party APIs (like DeepSeek) are called just like any HTTP endpoint. You send data, you get data back.

### Step 2.10: Wire Everything Together

`server/src/index.ts`:

```typescript
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth';
import trainingRoutes from './routes/training';
import dietRoutes from './routes/diet';
import aiRoutes from './routes/ai';

dotenv.config();
const app = express();

app.use(cors({ origin: 'http://localhost:5173' })); // Allow React dev server
app.use(express.json()); // Parse JSON request bodies

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/training', trainingRoutes);
app.use('/api/diet', dietRoutes);
app.use('/api/ai', aiRoutes);

app.listen(process.env.PORT || 3000, () => {
  console.log(`Server running on port ${process.env.PORT}`);
});
```

### Step 2.11: Test the API

Use **Postman** or **Thunder Client** (VS Code extension) to test every endpoint:

1. POST /api/auth/register → get back a token
2. Copy token, add as `Authorization: Bearer <token>` header
3. Test each CRUD endpoint
4. Verify 401 when no token is sent
5. Verify data is scoped to the logged-in user

**This is a critical learning step** — don't skip it. Testing the API in isolation saves hours of debugging.

---

## PHASE 3 — Frontend (Days 9–14)

### Step 3.1: Initialize the React Project

```powershell
cd IronAI
npm create vite@latest client -- --template react-ts
cd client
npm install
npm install react-router-dom axios react-markdown
npm install -D @types/react-router-dom (if needed)
```

**Why Vite and not Create React App?** Vite is much faster (uses ES modules natively), and CRA is effectively deprecated. Vite is what the React team now recommends.

### Step 3.2: Understand the React File Structure

| File | Purpose |
|------|---------|
| `index.html` | The single HTML page — React mounts here |
| `src/main.tsx` | Entry point — renders `<App />` into the DOM |
| `src/App.tsx` | Root component — sets up routes |
| `vite.config.ts` | Vite configuration (proxy, plugins, etc.) |

### Step 3.3: Set Up the API Client

`client/src/api/client.ts`:

Create an Axios instance with:
- `baseURL: 'http://localhost:3000/api'`
- **Request interceptor:** Attach the JWT token from localStorage to every request
- **Response interceptor:** If you get a 401, redirect to login page

```typescript
import axios from 'axios';

const apiClient = axios.create({
  baseURL: 'http://localhost:3000/api',
});

// Attach token to every request
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 globally
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default apiClient;
```

**Concept to learn:** Axios interceptors — middleware for HTTP requests. They let you run code before every request (attach token) and after every response (check for errors).

### Step 3.4: Define TypeScript Types

`client/src/types/index.ts`:

```typescript
export interface User {
  id: number;
  email: string;
  name: string;
  age?: number;
  height_cm?: number;
  weight_kg?: number;
  fitness_goal?: 'lose_weight' | 'build_muscle' | 'endurance' | 'general';
}

export interface TrainingProgram {
  id: number;
  user_id: number;
  name: string;
  description: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  target_muscle_group: string;
  exercises: Exercise[];
}

export interface Exercise {
  id: number;
  program_id: number;
  name: string;
  sets: number;
  reps: number;
  weight_kg: number;
  rest_seconds: number;
}

export interface DietRecord {
  id: number;
  meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  food_name: string;
  calories: number;
  protein_grams: number;
  carbs_grams: number;
  fat_grams: number;
  recorded_at: string;
}

export interface AIAnalysis {
  id: number;
  analysis_type: 'training' | 'diet';
  response_text: string;
  created_at: string;
}
```

**Concept to learn:** TypeScript interfaces define the shape of data. They catch bugs at compile time — if you try to access `user.nickname`, TypeScript will error because the `User` interface only has `name`.

### Step 3.5: Build the Auth Context

`client/src/hooks/useAuth.ts`:

This is the heart of your auth system on the frontend.

```typescript
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import apiClient from '../api/client';
import { User } from '../types';

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // On page load, check if there's a stored token and fetch user
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      apiClient.get('/auth/me').then(res => setUser(res.data)).catch(() => {
        localStorage.removeItem('token');
      }).finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email: string, password: string) => {
    const res = await apiClient.post('/auth/login', { email, password });
    localStorage.setItem('token', res.data.token);
    setUser(res.data.user);
  };

  const register = async (data: RegisterData) => {
    const res = await apiClient.post('/auth/register', data);
    localStorage.setItem('token', res.data.token);
    setUser(res.data.user);
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext)!;
```

**Concept to learn:** React Context — a way to share state across many components without passing props down through every level ("prop drilling"). The Provider wraps your app; any child can call `useAuth()` to get the user and auth functions.

### Step 3.6: Build the Protected Route Component

`client/src/components/ProtectedRoute.tsx`:

```typescript
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function ProtectedRoute({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth();

  if (loading) return <div>Loading...</div>;
  if (!user) return <Navigate to="/login" />;

  return children;
}
```

This wraps any page that requires login. If not logged in → redirect to /login.

### Step 3.7: Set Up React Router

`client/src/App.tsx`:

```typescript
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import TrainingPage from './pages/TrainingPage';
import DietPage from './pages/DietPage';
import AIAnalysisPage from './pages/AIAnalysisPage';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* Protected routes — wrapped in Layout with navbar */}
          <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/training" element={<TrainingPage />} />
            <Route path="/diet" element={<DietPage />} />
            <Route path="/ai-analysis" element={<AIAnalysisPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/dashboard" />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
```

**Concept to learn:** Nested routes — the `<Layout>` component renders a `<Outlet />` where child route content goes. This is how you keep the navbar consistent across all pages.

### Step 3.8: Build Each Page

**LoginPage:** Email + password form. On submit → call `login()` from useAuth. On success → navigate to /dashboard. Show error messages.

**RegisterPage:** Name + email + password + fitness goal form. Same pattern as login.

**DashboardPage:** Welcome message with user name. Quick stats (training sessions this week, today's calories). Links to other pages.

**TrainingPage:** The most complex page. Features to build:
- List of training programs (cards)
- "Create New Program" button → modal or form page
- Click a program → see its exercises
- "Log Session" button → records a completed workout
- Session history section

**DietPage:**
- Date picker to select a day
- Table of meals for that day
- "Add Food" form (meal type, food name, calories, macros)
- Calorie/macro summary bar
- Delete button per entry

**AIAnalysisPage:**
- "Analyze My Training" button → loading spinner → rendered markdown
- "Get Diet Recommendations" button → same pattern
- History of past analyses

### Step 3.9: Custom Hooks for Data Fetching

`client/src/hooks/useTraining.ts`:
```typescript
// Encapsulates all training API calls and state
// - programs: TrainingProgram[]
// - loading: boolean
// - fetchPrograms(), createProgram(), deleteProgram(), logSession()
```

`client/src/hooks/useDiet.ts`:
```typescript
// Encapsulates all diet API calls and state
// - records: DietRecord[]
// - selectedDate: string
// - fetchRecords(date), addRecord(), deleteRecord()
```

**Concept to learn:** Custom hooks — extract reusable logic (API calls + state) into functions. Keeps your components clean and focused on rendering.

### Step 3.10: Vite Proxy (Avoid CORS in Development)

`client/vite.config.ts`:
```typescript
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
});
```

This makes your dev server forward /api requests to the backend. You can then use relative URLs (`/api/auth/login`) instead of `http://localhost:3000/api/auth/login`. This also solves CORS issues during development.

---

## PHASE 4 — AI Integration Deep Dive (Days 15–16)

### Step 4.1: Create the DeepSeek Service

`server/src/services/deepseek.ts`:

```typescript
// DeepSeek's API is OpenAI-compatible
const DEEPSEEK_BASE = 'https://api.deepseek.com/v1';

export async function chatCompletion(prompt: string, systemPrompt: string): Promise<string> {
  const response = await fetch(`${DEEPSEEK_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 2000,
    }),
  });

  const data = await response.json();
  return data.choices[0].message.content;
}
```

**Concept to learn:**
- **System prompt:** Sets the AI's persona and constraints. "You are an expert fitness coach. Be specific and evidence-based."
- **User prompt:** The actual question/data to analyze.
- **Temperature:** 0 = deterministic, 1 = creative. 0.7 is balanced.
- **Max tokens:** Limits response length (controls cost).

### Step 4.2: Design the Training Analysis Prompt

```typescript
const TRAINING_SYSTEM_PROMPT = `You are an expert fitness coach with 15 years of experience. 
You analyze training data and provide actionable, science-based recommendations. 
Be specific — reference exact exercises, sets, reps, and frequency. 
Always structure your response with clear headings. 
If you notice red flags (overtraining, imbalances), flag them prominently.`;

function buildTrainingPrompt(userProfile, sessions): string {
  return `
## User Profile
- Age: ${userProfile.age}
- Weight: ${userProfile.weight_kg}kg
- Height: ${userProfile.height_cm}cm
- Goal: ${userProfile.fitness_goal}

## Recent Training Sessions
${sessions.map(s => `
### ${s.started_at}
- Duration: ${s.duration_minutes} min
- Perceived Effort: ${s.perceived_effort}/10
- Notes: ${s.notes || 'None'}
  `).join('\n')}

## Instructions
Please analyze this training data and provide:
1. **Frequency Assessment** — Are they training enough? Too much?
2. **Volume & Intensity** — Sets, reps, weight progression evaluation
3. **Muscle Balance** — Are any groups neglected?
4. **Specific Improvements** — 3-5 concrete changes
5. **Weekly Plan Suggestion** — A sample week of training
  `;
}
```

### Step 4.3: Design the Diet Recommendation Prompt

Similar structure but framed as a dietitian:

```
You are a registered dietitian. Based on the user's profile and recent food logs, 
recommend 3 days of meals with specific foods, portions, and calorie/macro estimates. 
Consider their fitness goal. Always prefer whole foods.
```

### Step 4.4: Connect to the AI Controller

`server/src/controllers/aiController.ts`:
1. Fetch relevant data from MySQL
2. Build the prompt
3. Call DeepSeek service
4. Save the response
5. Return to client

---

## PHASE 5 — Polish & Learn (Days 17–20)

### Step 5.1: Error Handling

- Backend: Consistent error format `{ error: string }`
- Frontend: Show error toasts/messages, not just console.log
- Try/catch around all API calls
- Loading states for every async operation

### Step 5.2: Form Validation

- Frontend: Validate before sending (email format, required fields, password length)
- Backend: Validate again (never trust client input — security principle)

### Step 5.3: Loading & Empty States

Every page should handle:
- **Loading:** Spinner or skeleton while data fetches
- **Empty:** "You haven't created any training programs yet. Create your first one!"
- **Error:** "Something went wrong. Try again."
- **Data:** The actual content

### Step 5.4: Responsive Design

Use CSS media queries or a utility framework (Tailwind CSS is popular):
- Desktop: Sidebar + wide content
- Mobile: Bottom nav + stacked content
- Minimum touch target size: 44×44px

### Step 5.5: Security Checklist

- [ ] Passwords hashed with bcrypt (never plain text)
- [ ] JWT with expiration (e.g., 7 days)
- [ ] SQL injection protection (parameterized queries via mysql2)
- [ ] Input validation on all endpoints
- [ ] CORS configured to allow only your frontend
- [ ] `.env` in `.gitignore`
- [ ] Rate limiting on auth endpoints (prevent brute force)

---

## 📚 Key Concepts You'll Learn

| Concept | Where you learn it |
|---------|-------------------|
| REST API design | Backend routes |
| Authentication (JWT) | Auth middleware + useAuth hook |
| Password hashing (bcrypt) | Auth controller |
| SQL joins & data modeling | Database schema + queries |
| React state management | useAuth, useTraining, useDiet hooks |
| React Context API | AuthProvider |
| React Router (nested routes) | App.tsx + Layout |
| Axios interceptors | api/client.ts |
| TypeScript generics & interfaces | types/index.ts |
| Prompt engineering | AI controller + DeepSeek service |
| Third-party API integration | DeepSeek service |
| Environment variables | .env + dotenv |
| CORS & security | Express cors middleware |

---

## 🚀 How to Actually Build This (Learning Strategy)

1. **Build in phases, not all at once.** Get the server running first, test it with Postman, THEN build the frontend.

2. **Test every endpoint before moving on.** If POST /register works in Postman, you know any frontend issues are React problems, not server problems.

3. **Commit after each step.** Small commits make it easy to undo mistakes.

4. **Read error messages carefully.** They tell you exactly what's wrong. The stack trace line number is your best friend.

5. **Use console.log / console.table liberally** while learning. See what your data looks like at each step.

6. **The AI part comes LAST.** Make sure CRUD works perfectly before adding the LLM layer.

---

## 🔧 Recommended VS Code Extensions

- **Thunder Client** — Test APIs inside VS Code (like Postman but lighter)
- **ES7+ React snippets** — Shortcuts for React components
- **Prettier** — Auto-format code
- **MySQL** (by cweijan) — Browse your database inside VS Code
- **GitLens** — Better Git integration

---

This plan is your roadmap. Start from Phase 1 and work through each step. The goal is understanding *why* you're doing each thing, not just copying code. When you finish, you'll have built a production-style full-stack app with AI integration.
