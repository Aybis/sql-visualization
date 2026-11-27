-- PostgreSQL multi-schema dump (auth, workspace, billing)
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
\.

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
