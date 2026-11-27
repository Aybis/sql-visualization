-- SQLite Schema: University Academic Management
PRAGMA foreign_keys = ON;

CREATE TABLE departments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  building TEXT
);

CREATE TABLE instructors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  department_id INTEGER NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT 'Lecturer'
);

CREATE TABLE students (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,
  advisor_id INTEGER REFERENCES instructors(id) ON DELETE SET NULL,
  student_number TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  enrollment_year INTEGER NOT NULL
);

CREATE TABLE courses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  department_id INTEGER NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  credits INTEGER NOT NULL CHECK (credits > 0)
);

CREATE TABLE sections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  instructor_id INTEGER REFERENCES instructors(id) ON DELETE SET NULL,
  semester TEXT NOT NULL,
  room TEXT,
  capacity INTEGER NOT NULL DEFAULT 40
);

CREATE TABLE enrollments (
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  section_id INTEGER NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  enrolled_at TEXT NOT NULL DEFAULT (datetime('now')),
  grade TEXT,
  PRIMARY KEY (student_id, section_id)
);

CREATE TABLE prerequisites (
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  required_course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  PRIMARY KEY (course_id, required_course_id)
);
