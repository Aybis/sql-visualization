/**
 * Built-in Realistic Multi-Dialect SQL Sample Schemas
 * Allows immediate offline exploration across MySQL, PostgreSQL, SQLite, and SQL Server.
 */

export const SAMPLE_PRESETS = {
  ecommerce_mysql: {
    name: 'E-Commerce Store (MySQL Dump)',
    dialect: 'MySQL',
    sql: `-- MySQL Dump: E-Commerce Platform
/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET NAMES utf8mb4 */;

CREATE TABLE \`users\` (
  \`id\` bigint unsigned NOT NULL AUTO_INCREMENT,
  \`email\` varchar(255) NOT NULL,
  \`full_name\` varchar(120) NOT NULL,
  \`phone\` varchar(32) DEFAULT NULL,
  \`role\` enum('customer','vendor','admin') NOT NULL DEFAULT 'customer',
  \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id\`),
  UNIQUE KEY \`uk_users_email\` (\`email\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Registered platform accounts';

CREATE TABLE \`user_profiles\` (
  \`user_id\` bigint unsigned NOT NULL,
  \`avatar_url\` varchar(500) DEFAULT NULL,
  \`bio\` text,
  \`locale\` varchar(16) NOT NULL DEFAULT 'en-US',
  \`loyalty_points\` int unsigned NOT NULL DEFAULT 0,
  PRIMARY KEY (\`user_id\`),
  CONSTRAINT \`fk_profiles_user\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\` (\`id\`) ON DELETE CASCADE
) ENGINE=InnoDB COMMENT='1:1 extended user profile';

CREATE TABLE \`addresses\` (
  \`id\` bigint unsigned NOT NULL AUTO_INCREMENT,
  \`user_id\` bigint unsigned NOT NULL,
  \`label\` varchar(40) NOT NULL DEFAULT 'Home',
  \`street\` varchar(255) NOT NULL,
  \`city\` varchar(100) NOT NULL,
  \`postal_code\` varchar(20) NOT NULL,
  \`country_code\` char(2) NOT NULL,
  \`is_default\` tinyint(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (\`id\`),
  KEY \`idx_addresses_user\` (\`user_id\`),
  CONSTRAINT \`fk_addresses_user\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\` (\`id\`) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE \`categories\` (
  \`id\` int unsigned NOT NULL AUTO_INCREMENT,
  \`parent_id\` int unsigned DEFAULT NULL,
  \`slug\` varchar(120) NOT NULL,
  \`name\` varchar(120) NOT NULL,
  PRIMARY KEY (\`id\`),
  UNIQUE KEY \`uk_categories_slug\` (\`slug\`),
  CONSTRAINT \`fk_categories_parent\` FOREIGN KEY (\`parent_id\`) REFERENCES \`categories\` (\`id\`) ON DELETE SET NULL
) ENGINE=InnoDB COMMENT='Self-referencing category tree';

CREATE TABLE \`products\` (
  \`id\` bigint unsigned NOT NULL AUTO_INCREMENT,
  \`category_id\` int unsigned NOT NULL,
  \`vendor_id\` bigint unsigned NOT NULL,
  \`sku\` varchar(64) NOT NULL,
  \`name\` varchar(200) NOT NULL,
  \`price\` decimal(12,2) NOT NULL,
  \`stock_qty\` int NOT NULL DEFAULT 0,
  \`is_active\` tinyint(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (\`id\`),
  UNIQUE KEY \`uk_products_sku\` (\`sku\`),
  CONSTRAINT \`fk_products_category\` FOREIGN KEY (\`category_id\`) REFERENCES \`categories\` (\`id\`) ON DELETE RESTRICT,
  CONSTRAINT \`fk_products_vendor\` FOREIGN KEY (\`vendor_id\`) REFERENCES \`users\` (\`id\`) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE \`orders\` (
  \`id\` bigint unsigned NOT NULL AUTO_INCREMENT,
  \`user_id\` bigint unsigned NOT NULL,
  \`shipping_address_id\` bigint unsigned DEFAULT NULL,
  \`order_number\` varchar(40) NOT NULL,
  \`status\` enum('pending','paid','shipped','delivered','cancelled') NOT NULL DEFAULT 'pending',
  \`total_amount\` decimal(12,2) NOT NULL,
  \`ordered_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id\`),
  UNIQUE KEY \`uk_orders_number\` (\`order_number\`)
) ENGINE=InnoDB;

CREATE TABLE \`order_items\` (
  \`order_id\` bigint unsigned NOT NULL,
  \`product_id\` bigint unsigned NOT NULL,
  \`quantity\` int unsigned NOT NULL,
  \`unit_price\` decimal(12,2) NOT NULL,
  PRIMARY KEY (\`order_id\`, \`product_id\`),
  CONSTRAINT \`fk_order_items_order\` FOREIGN KEY (\`order_id\`) REFERENCES \`orders\` (\`id\`) ON DELETE CASCADE,
  CONSTRAINT \`fk_order_items_product\` FOREIGN KEY (\`product_id\`) REFERENCES \`products\` (\`id\`) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE \`payments\` (
  \`id\` bigint unsigned NOT NULL AUTO_INCREMENT,
  \`order_id\` bigint unsigned NOT NULL,
  \`provider\` varchar(40) NOT NULL,
  \`transaction_ref\` varchar(128) NOT NULL,
  \`amount\` decimal(12,2) NOT NULL,
  \`status\` enum('authorized','captured','refunded','failed') NOT NULL,
  \`paid_at\` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (\`id\`),
  UNIQUE KEY \`uk_payments_tx\` (\`transaction_ref\`),
  CONSTRAINT \`fk_payments_order\` FOREIGN KEY (\`order_id\`) REFERENCES \`orders\` (\`id\`) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE \`reviews\` (
  \`id\` bigint unsigned NOT NULL AUTO_INCREMENT,
  \`product_id\` bigint unsigned NOT NULL,
  \`user_id\` bigint unsigned NOT NULL,
  \`rating\` tinyint unsigned NOT NULL,
  \`body\` text,
  \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id\`),
  UNIQUE KEY \`uk_reviews_product_user\` (\`product_id\`, \`user_id\`)
) ENGINE=InnoDB;

-- Post-table ALTER TABLE constraints (just like real mysqldump exports)
ALTER TABLE \`orders\`
  ADD CONSTRAINT \`fk_orders_user\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\` (\`id\`) ON DELETE RESTRICT,
  ADD CONSTRAINT \`fk_orders_address\` FOREIGN KEY (\`shipping_address_id\`) REFERENCES \`addresses\` (\`id\`) ON DELETE SET NULL;

ALTER TABLE \`reviews\`
  ADD CONSTRAINT \`fk_reviews_product\` FOREIGN KEY (\`product_id\`) REFERENCES \`products\` (\`id\`) ON DELETE CASCADE,
  ADD CONSTRAINT \`fk_reviews_user\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\` (\`id\`) ON DELETE CASCADE;
`,
  },

  saas_postgres: {
    name: 'Multi-Tenant SaaS (PostgreSQL pg_dump)',
    dialect: 'PostgreSQL',
    sql: `-- PostgreSQL multi-schema dump (auth, workspace, billing)
SET statement_timeout = 0;
SET standard_conforming_strings = on;

CREATE TYPE billing.plan_tier AS ENUM ('free', 'pro', 'enterprise');
CREATE TYPE workspace.task_status AS ENUM ('backlog', 'in_progress', 'review', 'done');

CREATE TABLE auth.accounts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email character varying(255) NOT NULL,
    password_hash text NOT NULL,
    full_name character varying(120) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE workspace.organizations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    slug character varying(80) NOT NULL,
    name character varying(160) NOT NULL,
    owner_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE workspace.memberships (
    organization_id uuid NOT NULL,
    account_id uuid NOT NULL,
    role character varying(32) DEFAULT 'member'::character varying NOT NULL,
    joined_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE workspace.projects (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    key character varying(16) NOT NULL,
    name character varying(140) NOT NULL,
    lead_id uuid,
    archived boolean DEFAULT false NOT NULL
);

CREATE TABLE workspace.tasks (
    id bigserial NOT NULL,
    project_id uuid NOT NULL,
    parent_task_id bigint,
    assignee_id uuid,
    reporter_id uuid NOT NULL,
    title character varying(240) NOT NULL,
    status workspace.task_status DEFAULT 'backlog' NOT NULL,
    priority smallint DEFAULT 2 NOT NULL,
    due_date date
);

CREATE TABLE workspace.comments (
    id bigserial NOT NULL,
    task_id bigint NOT NULL,
    author_id uuid NOT NULL,
    body text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE billing.subscriptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    tier billing.plan_tier DEFAULT 'free' NOT NULL,
    seats integer DEFAULT 5 NOT NULL,
    renews_at timestamp with time zone
);

CREATE TABLE billing.invoices (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    subscription_id uuid NOT NULL,
    amount_cents integer NOT NULL,
    currency char(3) DEFAULT 'USD' NOT NULL,
    status character varying(24) NOT NULL,
    issued_at timestamp with time zone DEFAULT now() NOT NULL
);

-- pg_dump COPY data section (automatically skipped!)
COPY auth.accounts (id, email, password_hash, full_name, created_at) FROM stdin;
11111111-1111-1111-1111-111111111111	ada@example.com	hash	Ada Lovelace	2026-01-01 00:00:00+00
\\.

-- Constraints at bottom (standard pg_dump layout)
ALTER TABLE ONLY auth.accounts ADD CONSTRAINT accounts_pkey PRIMARY KEY (id);
ALTER TABLE ONLY auth.accounts ADD CONSTRAINT accounts_email_key UNIQUE (email);

ALTER TABLE ONLY workspace.organizations ADD CONSTRAINT organizations_pkey PRIMARY KEY (id);
ALTER TABLE ONLY workspace.organizations ADD CONSTRAINT organizations_slug_key UNIQUE (slug);
ALTER TABLE ONLY workspace.organizations ADD CONSTRAINT organizations_owner_fkey FOREIGN KEY (owner_id) REFERENCES auth.accounts(id) ON DELETE RESTRICT;

ALTER TABLE ONLY workspace.memberships ADD CONSTRAINT memberships_pkey PRIMARY KEY (organization_id, account_id);
ALTER TABLE ONLY workspace.memberships ADD CONSTRAINT memberships_org_fkey FOREIGN KEY (organization_id) REFERENCES workspace.organizations(id) ON DELETE CASCADE;
ALTER TABLE ONLY workspace.memberships ADD CONSTRAINT memberships_acc_fkey FOREIGN KEY (account_id) REFERENCES auth.accounts(id) ON DELETE CASCADE;

ALTER TABLE ONLY workspace.projects ADD CONSTRAINT projects_pkey PRIMARY KEY (id);
ALTER TABLE ONLY workspace.projects ADD CONSTRAINT projects_org_fkey FOREIGN KEY (organization_id) REFERENCES workspace.organizations(id) ON DELETE CASCADE;
ALTER TABLE ONLY workspace.projects ADD CONSTRAINT projects_lead_fkey FOREIGN KEY (lead_id) REFERENCES auth.accounts(id) ON DELETE SET NULL;

ALTER TABLE ONLY workspace.tasks ADD CONSTRAINT tasks_pkey PRIMARY KEY (id);
ALTER TABLE ONLY workspace.tasks ADD CONSTRAINT tasks_project_fkey FOREIGN KEY (project_id) REFERENCES workspace.projects(id) ON DELETE CASCADE;
ALTER TABLE ONLY workspace.tasks ADD CONSTRAINT tasks_parent_fkey FOREIGN KEY (parent_task_id) REFERENCES workspace.tasks(id) ON DELETE SET NULL;
ALTER TABLE ONLY workspace.tasks ADD CONSTRAINT tasks_assignee_fkey FOREIGN KEY (assignee_id) REFERENCES auth.accounts(id) ON DELETE SET NULL;
ALTER TABLE ONLY workspace.tasks ADD CONSTRAINT tasks_reporter_fkey FOREIGN KEY (reporter_id) REFERENCES auth.accounts(id) ON DELETE RESTRICT;

ALTER TABLE ONLY workspace.comments ADD CONSTRAINT comments_pkey PRIMARY KEY (id);
ALTER TABLE ONLY workspace.comments ADD CONSTRAINT comments_task_fkey FOREIGN KEY (task_id) REFERENCES workspace.tasks(id) ON DELETE CASCADE;
ALTER TABLE ONLY workspace.comments ADD CONSTRAINT comments_author_fkey FOREIGN KEY (author_id) REFERENCES auth.accounts(id) ON DELETE CASCADE;

ALTER TABLE ONLY billing.subscriptions ADD CONSTRAINT subscriptions_pkey PRIMARY KEY (id);
ALTER TABLE ONLY billing.subscriptions ADD CONSTRAINT subscriptions_org_unique UNIQUE (organization_id);
ALTER TABLE ONLY billing.subscriptions ADD CONSTRAINT subscriptions_org_fkey FOREIGN KEY (organization_id) REFERENCES workspace.organizations(id) ON DELETE CASCADE;

ALTER TABLE ONLY billing.invoices ADD CONSTRAINT invoices_pkey PRIMARY KEY (id);
ALTER TABLE ONLY billing.invoices ADD CONSTRAINT invoices_sub_fkey FOREIGN KEY (subscription_id) REFERENCES billing.subscriptions(id) ON DELETE CASCADE;

COMMENT ON TABLE billing.subscriptions IS '1:1 active billing subscription per organization';
`,
  },

  university_sqlite: {
    name: 'University System (SQLite)',
    dialect: 'SQLite',
    sql: `-- SQLite Schema: University Academic Management
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
`,
  },

  hr_sqlserver: {
    name: 'Enterprise HR & Payroll (SQL Server)',
    dialect: 'SQL Server',
    sql: `-- SQL Server (T-SQL) Enterprise HR Schema
CREATE TABLE [dbo].[Locations] (
    [LocationId] INT IDENTITY(1,1) NOT NULL,
    [City] NVARCHAR(100) NOT NULL,
    [Country] NVARCHAR(80) NOT NULL,
    [Timezone] NVARCHAR(50) NOT NULL,
    CONSTRAINT [PK_Locations] PRIMARY KEY CLUSTERED ([LocationId])
);
GO

CREATE TABLE [dbo].[Departments] (
    [DepartmentId] INT IDENTITY(1,1) NOT NULL,
    [LocationId] INT NOT NULL,
    [Name] NVARCHAR(120) NOT NULL,
    [CostCenter] NVARCHAR(32) NOT NULL UNIQUE,
    CONSTRAINT [PK_Departments] PRIMARY KEY CLUSTERED ([DepartmentId])
);
GO

CREATE TABLE [dbo].[JobTitles] (
    [JobTitleId] INT IDENTITY(1,1) NOT NULL,
    [Title] NVARCHAR(120) NOT NULL,
    [MinSalary] DECIMAL(12,2) NOT NULL,
    [MaxSalary] DECIMAL(12,2) NOT NULL,
    CONSTRAINT [PK_JobTitles] PRIMARY KEY CLUSTERED ([JobTitleId])
);
GO

CREATE TABLE [dbo].[Employees] (
    [EmployeeId] INT IDENTITY(1,1) NOT NULL,
    [DepartmentId] INT NOT NULL,
    [JobTitleId] INT NOT NULL,
    [ManagerId] INT NULL,
    [Email] NVARCHAR(200) NOT NULL UNIQUE,
    [FirstName] NVARCHAR(80) NOT NULL,
    [LastName] NVARCHAR(80) NOT NULL,
    [HireDate] DATE NOT NULL,
    [Salary] DECIMAL(12,2) NOT NULL,
    CONSTRAINT [PK_Employees] PRIMARY KEY CLUSTERED ([EmployeeId])
);
GO

CREATE TABLE [dbo].[Payrolls] (
    [PayrollId] BIGINT IDENTITY(1,1) NOT NULL,
    [EmployeeId] INT NOT NULL,
    [PayPeriodStart] DATE NOT NULL,
    [PayPeriodEnd] DATE NOT NULL,
    [GrossPay] DECIMAL(12,2) NOT NULL,
    [NetPay] DECIMAL(12,2) NOT NULL,
    CONSTRAINT [PK_Payrolls] PRIMARY KEY CLUSTERED ([PayrollId])
);
GO

CREATE TABLE [dbo].[LeaveRequests] (
    [LeaveRequestId] BIGINT IDENTITY(1,1) NOT NULL,
    [EmployeeId] INT NOT NULL,
    [ApproverId] INT NULL,
    [StartDate] DATE NOT NULL,
    [EndDate] DATE NOT NULL,
    [Status] NVARCHAR(24) NOT NULL DEFAULT N'Pending',
    CONSTRAINT [PK_LeaveRequests] PRIMARY KEY CLUSTERED ([LeaveRequestId])
);
GO

ALTER TABLE [dbo].[Departments] WITH CHECK ADD CONSTRAINT [FK_Departments_Locations]
    FOREIGN KEY([LocationId]) REFERENCES [dbo].[Locations]([LocationId]);
GO

ALTER TABLE [dbo].[Employees] WITH CHECK ADD CONSTRAINT [FK_Employees_Departments]
    FOREIGN KEY([DepartmentId]) REFERENCES [dbo].[Departments]([DepartmentId]);
GO

ALTER TABLE [dbo].[Employees] WITH CHECK ADD CONSTRAINT [FK_Employees_JobTitles]
    FOREIGN KEY([JobTitleId]) REFERENCES [dbo].[JobTitles]([JobTitleId]);
GO

ALTER TABLE [dbo].[Employees] WITH CHECK ADD CONSTRAINT [FK_Employees_Manager]
    FOREIGN KEY([ManagerId]) REFERENCES [dbo].[Employees]([EmployeeId]);
GO

ALTER TABLE [dbo].[Payrolls] WITH CHECK ADD CONSTRAINT [FK_Payrolls_Employees]
    FOREIGN KEY([EmployeeId]) REFERENCES [dbo].[Employees]([EmployeeId]) ON DELETE CASCADE;
GO

ALTER TABLE [dbo].[LeaveRequests] WITH CHECK ADD CONSTRAINT [FK_LeaveRequests_Employee]
    FOREIGN KEY([EmployeeId]) REFERENCES [dbo].[Employees]([EmployeeId]) ON DELETE CASCADE;
GO

ALTER TABLE [dbo].[LeaveRequests] WITH CHECK ADD CONSTRAINT [FK_LeaveRequests_Approver]
    FOREIGN KEY([ApproverId]) REFERENCES [dbo].[Employees]([EmployeeId]);
GO
`,
  },
};
