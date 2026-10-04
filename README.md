# Exam Availability Portal

A centralized system for students to submit exam schedules and for faculty to verify exam availability efficiently.

## Prototype Mode

The app is currently in **Prototype Mode**. Firebase Authentication has been replaced with a custom, database-driven login system for easier testing and demonstration.

- **Student Login**: Use Register Number as both username and password. (Requires importing students first via Admin Panel).
- **Admin Login**: Use Email and Password. 
  - **Default Admin**: `admin@college.com` / `admin` (Use the "Seed Default Admin" button on the Admin Login page to create this).
- **Security**: Firestore rules are set to `allow read, write: if true;` for the prototype. **Do not use this in production.**

## Features

- **Student Panel**:
  - Login using Register Number.
  - Submit exam details (Subject, Date, Slot, FA Details).
  - View submission history.
  - Update existing submissions to avoid duplicates.
- **Admin Panel**:
  - Dashboard with summary statistics.
  - **Availability Checker**: Check if specific students have exams on a selected date and slot.
  - **Bulk Import**: Upload student master list from Excel/CSV.
  - **Reports**: Generate and download reports in Excel, CSV, and PDF formats.
  - **Filters & Search**: Powerful data management tools.

## Tech Stack

- **Frontend**: Next.js 15, React 19, Tailwind CSS 4
- **Backend**: Firebase (Firestore, Auth)
- **Libraries**: `framer-motion`, `lucide-react`, `xlsx`, `jspdf`, `zod`, `react-hook-form`

## Setup Instructions

1. **Firebase Configuration**:
   - The app is pre-configured with Firebase.
   - Ensure `firebase-applet-config.json` is present in the root directory.
2. **Admin Setup**:
   - The first admin is automatically set to `kakanurumidhunreddy@gmail.com`.
   - You can add more admins through the Firebase Console in the `admins` collection.
3. **Student Import**:
   - Log in as Admin.
   - Use the "Import Students" section to upload the `sample_students.csv` file.
   - Students can then log in using their Register Number as both username and password.

## Database Schema

### `students` Collection
- `name`: string
- `registerNumber`: string (Document ID)
- `password`: string
- `email`: string
- `department`: string
- `year`: string
- `section`: string
- `createdAt`: timestamp

### `submissions` Collection
- `studentName`: string
- `registerNumber`: string
- `email`: string
- `department`: string
- `subjectName`: string
- `examDate`: string
- `examSlot`: string (Morning/Afternoon)
- `faName`: string
- `faPhoneNumber`: string
- `faEmail`: string
- `submittedAt`: timestamp
- `updatedAt`: timestamp

### `admins` Collection
- `name`: string
- `email`: string
- `role`: string
- `createdAt`: timestamp
