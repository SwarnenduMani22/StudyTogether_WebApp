# 🤝 Contributing to StudyTogether

Thank you for your interest in contributing to StudyTogether! This guide will help you set up your development environment and guide you through the process of reporting bugs, proposing features, and submitting pull requests.

---

## 📋 Table of Contents

1. [Project Overview](#1-project-overview)
2. [Development Environment Setup](#2-development-environment-setup)
3. [Prerequisites](#3-prerequisites)
4. [Installation Steps](#4-installation-steps)
5. [Running Frontend](#5-running-frontend)
6. [Running Backend & Microservices](#6-running-backend--microservices)
7. [Environment Variables](#7-environment-variables)
8. [Branch Naming Convention](#8-branch-naming-convention)
9. [Commit Message Convention](#9-commit-message-convention)
10. [Pull Request Process](#10-pull-request-process)
11. [Coding Standards](#11-coding-standards)
12. [Folder Structure Guidelines](#12-folder-structure-guidelines)
13. [Testing Guidelines](#13-testing-guidelines)
14. [Reporting Bugs](#14-reporting-bugs)
15. [Suggesting Features](#15-suggesting-features)
16. [Code Review Process](#16-code-review-process)
17. [Security Reporting](#17-security-reporting)
18. [Community Guidelines](#18-community-guidelines)

---

## 1. Project Overview
StudyTogether is a MERN stack application (MongoDB, Express, React, Node.js) that helps students share peer-reviewed study papers, earn and spend Study Coins, rate study content, and progress through badges and leaderboard rankings.

---

## 2. Development Environment Setup
To contribute to the project, set up your workspace locally. We recommend:
*   **OS**: Windows, macOS, or Linux.
*   **Editor**: Visual Studio Code (VS Code) with ESLint and Prettier plugins installed.
*   **Shell**: bash, zsh, or powershell.

---

## 3. Prerequisites
Ensure you have the following installed on your machine:
*   **Node.js** (v18.x or higher)
*   **npm** (v9.x or higher)
*   **MongoDB** (running locally or a MongoDB Atlas Cloud URL)
*   **Git**

---

## 4. Installation Steps

1.  **Fork and Clone**: Fork the repository on GitHub and clone it:
    ```bash
    git clone https://github.com/your-username/StudyTogether.git
    cd StudyTogether
    ```
2.  **Install Root Workspace Dependencies**:
    ```bash
    npm install
    ```
3.  **Install Server Dependencies**:
    ```bash
    cd server
    npm install
    cd ..
    ```
4.  **Install Client Dependencies**:
    ```bash
    cd client
    npm install
    cd ..
    ```
5.  **Install AI Microservice Dependencies**:
    ```bash
    cd ai
    npm install
    cd ..
    ```

---

## 5. Running Frontend
To run the React (Vite) client development server locally:
```bash
cd client
npm run dev
```
The application will start on `http://localhost:5173`.

---

## 6. Running Backend & Microservices

### Option A: Run Full Stack Concurrently (Recommended)
From the project root:
```bash
npm run dev:all
```
This concurrently starts:
*   **React Frontend (Vite)** on `http://localhost:5173`
*   **Main Backend (Express)** on `http://localhost:5000`
*   **AI Copilot Microservice** on `http://localhost:5001`

To run standard web mode without the AI microservice:
```bash
npm run dev
```

### Option B: Run Services Individually
*   **Backend Server**: `cd server && npm run dev` (starts on `http://localhost:5000`)
*   **AI Microservice**: `npm run ai` or `cd ai && npm run dev` (starts on `http://localhost:5001`)

---

## 7. Environment Variables
You need to configure your environment variables:
1.  Copy `.env.example` in the project root to `.env` in the repository root:
    ```bash
    cp .env.example .env
    ```
    *Note: Both the main Backend Server (`server/config/env.js`) and the AI Copilot Microservice (`ai/server.js`) load from this root `.env` file.*
2.  Add your database credentials (`MONGODB_URI`), JWT secrets, Cloudinary credentials, and Razorpay API keys to `.env`.
3.  *(Optional)* If you need custom client API URLs, create `client/.env` and configure `VITE_API_URL` and `VITE_AI_API_URL` (defaults to port 5000 and 5001).

---

## 8. Branch Naming Convention
Use descriptive branch names prefixed with the action type:
*   `feature/` — for new features (e.g., `feature/saved-drafts-ui`)
*   `bugfix/` — for bug fixes (e.g., `bugfix/token-revocation`)
*   `docs/` — for documentation updates (e.g., `docs/contributing-guide`)
*   `refactor/` — for code cleanups/optimizations (e.g., `refactor/middleware-ordering`)

---

## 9. Commit Message Convention
We follow standard conventional commit naming rules:
*   `feat: <description>` — A new feature (e.g., `feat: add monthly contribution charts`)
*   `fix: <description>` — A bug fix (e.g., `fix: align profile password validations`)
*   `docs: <description>` — Documentation only (e.g., `docs: update readme API endpoints`)
*   `style: <description>` — Code style changes (whitespace, formatting, semicolons)
*   `refactor: <description>` — A code change that neither fixes a bug nor adds a feature

---

## 10. Pull Request Process
1.  Create a branch from `main`.
2.  Make your changes locally, adhering to the coding standards.
3.  Commit your changes following the commit message convention.
4.  Push your branch to your forked repository.
5.  Open a Pull Request (PR) against the `main` branch of the parent repository.
6.  Link any related issues in the PR description.

---

## 11. Coding Standards
*   **ES6+ JavaScript**: Use modern JavaScript syntaxes (const/let, arrow functions, promises).
*   **Variable Naming**: Use camelCase for variables/functions and PascalCase for React component files (e.g., `PublicProfile.jsx`).
*   **Asynchronous Code**: Prefer `async/await` syntax with try/catch blocks for error handling.
*   **Atomic Balances**: Write concurrent-safe database operations (e.g., use `$inc` with conditions rather than calculating inside code).

---

## 12. Folder Structure Guidelines
*   **Components**: Create reusable UI components inside `client/src/components/`.
*   **Pages**: Define full view layouts inside `client/src/pages/`.
*   **Routes**: Organize route directories in `server/routes/`.
*   **Models**: Declare Mongoose schemas inside `server/models/`.

---

## 13. Testing Guidelines
Before submitting a PR, ensure that:
*   **Run Automated Backend & AI Test Suites**: Execute `npm test` from the project root. All test suites under `server/test/` and `ai/test/` must pass cleanly without failures.
*   **Run Frontend Linter**: Execute `npm run lint` inside `client/` and ensure 0 errors and 0 warnings.
*   **Validate Production Build**: Execute `npm run build` inside `client/` to verify Vite bundle compilation without syntax or module resolution errors.
*   **Validation Rules**: Form fields and endpoints are verified with proper validation (e.g., semester between 1 and 8, allowed subjects, non-empty fields).
*   **Regression Tests**: New features and bug fixes must include corresponding regression tests in `server/test/` or `ai/test/` using Node's native test runner (`node:test`).

---

## 14. Reporting Bugs
If you find a bug:
1.  Search the GitHub Issues to check if it has already been reported.
2.  If not, open a new issue.
3.  Include a clear title, reproduction steps, expected behavior, and screenshot/log outputs.

---

## 15. Suggesting Features
To suggest enhancements:
1.  Check the existing features lists to avoid duplicates.
2.  Create a new feature proposal issue detailing the problem solved and design ideas.

---

## 16. Code Review Process
All pull requests must undergo review before merge:
*   At least one maintainer review is required.
*   Address any requested changes promptly by committing fixes directly to your PR branch.

---

## 17. Security Reporting
If you find a security vulnerability, **do not open a public issue**. Instead, report it privately to the maintainers at `swarnendu.mani@gmail.com` to ensure safe, coordinated disclosure.

---

## 18. Community Guidelines
Be respectful, welcoming, inclusive, and collaborative. Any abusive or harassing behavior will not be tolerated.
