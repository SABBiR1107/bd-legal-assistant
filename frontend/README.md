# Bangladesh AI Legal Assistant - Frontend Service

This is the Next.js 15 App Router web client for the Bangladesh AI Legal Assistant.

## 🚀 Features
- **Modern Responsive Chat Interface**: Chat with the legal AI assistant, submit queries, and view local chat histories.
- **Citation Inspector panel**: Click citations in replies to open a details panel showing the exact PDF page, file source, and matching text fragment.
- **Admin Dashboard**: Upload new statutory PDF files, check index vector count, track storage health, and delete files.
- **Authentication**: Fully secured by Clerk auth providers with themed sign-in/up screens.

## 🛠️ Tech Stack
- **Framework**: Next.js 15 App Router (React 19)
- **Styling**: TailwindCSS
- **Icons**: Lucide-React
- **Authentication**: Clerk

## 📦 Getting Started

### 1. Environment Configurations
Create a `.env.local` file with Clerk developer keys:
```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### 2. Launch Development Server
```bash
npm install
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to view the application.
