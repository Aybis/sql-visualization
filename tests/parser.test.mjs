import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSqlToSchema } from '../src/parser/sqlParser.js';
import { SAMPLE_PRESETS } from '../src/samples/presets.js';

test('parses MySQL e-commerce dump with inline FKs, composite PK, 1:1, self-ref, and multi-action ALTER TABLE', () => {
  const schema = parseSqlToSchema(SAMPLE_PRESETS.ecommerce_mysql.sql);
  assert.equal(schema.dialect, 'MySQL / MariaDB');
  assert.equal(schema.stats.tableCount, 9);
  assert.equal(schema.stats.explicitRelationCount, 12);

  // 1:1 relation: user_profiles.user_id -> users.id (PK == FK)
  const profileRel = schema.relations.find(
    (r) => r.sourceTableId === 'user_profiles' && r.targetTableId === 'users'
  );
  assert.ok(profileRel);
  assert.equal(profileRel.cardinality, '1:1');
  assert.equal(profileRel.onDelete, 'CASCADE');

  // Self-reference: categories.parent_id -> categories.id
  const catRel = schema.relations.find(
    (r) => r.sourceTableId === 'categories' && r.targetTableId === 'categories'
  );
  assert.ok(catRel);
  assert.equal(catRel.isSelfReference, true);
  assert.equal(catRel.targetEnd, '0..1'); // nullable parent_id

  // Multi-action ALTER TABLE on orders
  const orderRels = schema.relations.filter((r) => r.sourceTableId === 'orders');
  assert.equal(orderRels.length, 2);

  // Junction table detection on order_items
  const orderItems = schema.tables.find((t) => t.name === 'order_items');
  assert.equal(orderItems.isJunctionTable, true);
  assert.deepEqual(orderItems.primaryKeys, ['order_id', 'product_id']);
});

test('parses PostgreSQL multi-schema pg_dump with COPY stdin, enums, comments, and ALTER TABLE ONLY', () => {
  const schema = parseSqlToSchema(SAMPLE_PRESETS.saas_postgres.sql);
  assert.equal(schema.dialect, 'PostgreSQL');
  assert.equal(schema.stats.tableCount, 8);
  assert.equal(schema.stats.explicitRelationCount, 13);
  assert.deepEqual(schema.schemas.sort(), ['auth', 'billing', 'workspace']);
  assert.equal(schema.enums.length, 2);

  // 1:1 unique FK: billing.subscriptions.organization_id -> workspace.organizations.id
  const subRel = schema.relations.find((r) => r.sourceTableId === 'billing.subscriptions');
  assert.ok(subRel);
  assert.equal(subRel.cardinality, '1:1');
  assert.equal(subRel.targetTableId, 'workspace.organizations');

  // Table comment parsed via COMMENT ON TABLE
  const subs = schema.tables.find((t) => t.id === 'billing.subscriptions');
  assert.match(subs.comment, /1:1 active billing subscription/);
});

test('parses SQLite schema with inline REFERENCES and composite primary keys', () => {
  const schema = parseSqlToSchema(SAMPLE_PRESETS.university_sqlite.sql);
  assert.equal(schema.dialect, 'SQLite');
  assert.equal(schema.stats.tableCount, 7);
  assert.equal(schema.stats.explicitRelationCount, 10);

  // prerequisites has 2 separate FKs to courses
  const prereqRels = schema.relations.filter((r) => r.sourceTableId === 'prerequisites');
  assert.equal(prereqRels.length, 2);
  assert.ok(prereqRels.every((r) => r.targetTableId === 'courses'));
});

test('parses SQL Server T-SQL with [dbo] brackets, GO batches, and WITH CHECK ADD CONSTRAINT', () => {
  const schema = parseSqlToSchema(SAMPLE_PRESETS.hr_sqlserver.sql);
  assert.equal(schema.dialect, 'SQL Server (T-SQL)');
  assert.equal(schema.stats.tableCount, 6);
  assert.equal(schema.stats.explicitRelationCount, 7);

  // Self-ref manager on dbo.Employees
  const mgr = schema.relations.find(
    (r) => r.sourceTableId === 'dbo.Employees' && r.targetTableId === 'dbo.Employees'
  );
  assert.ok(mgr);
  assert.equal(mgr.isSelfReference, true);
});

test('handles composite foreign keys, quoted keyword column names, omitted target columns, and external stubs', () => {
  const sql = `
    CREATE TABLE tenants (
      id INT PRIMARY KEY,
      \`key\` VARCHAR(64) NOT NULL,
      index VARCHAR(32)
    );
    CREATE TABLE memberships (
      tenant_id INT NOT NULL,
      user_id INT NOT NULL,
      PRIMARY KEY (tenant_id, user_id),
      FOREIGN KEY (tenant_id) REFERENCES tenants
    );
    CREATE TABLE audit_logs (
      id BIGINT PRIMARY KEY,
      tenant_id INT NOT NULL,
      user_id INT NOT NULL,
      ext_org_id INT NOT NULL,
      CONSTRAINT fk_audit_membership FOREIGN KEY (tenant_id, user_id)
        REFERENCES memberships (tenant_id, user_id) ON DELETE CASCADE,
      CONSTRAINT fk_audit_external FOREIGN KEY (ext_org_id)
        REFERENCES external_orgs (org_id)
    );
  `;
  const schema = parseSqlToSchema(sql);
  // Quoted `key` and unquoted `index VARCHAR(32)` parsed as columns, NOT table constraints
  const tenants = schema.tables.find((t) => t.name === 'tenants');
  assert.deepEqual(
    tenants.columns.map((c) => c.name),
    ['id', 'key', 'index']
  );

  // Omitted target column resolved to tenants.id
  const memRel = schema.relations.find((r) => r.sourceTableId === 'memberships');
  assert.deepEqual(memRel.targetColumns, ['id']);

  // Composite FK resolved with both columns
  const compRel = schema.relations.find((r) => r.name === 'fk_audit_membership');
  assert.equal(compRel.isComposite, true);
  assert.deepEqual(compRel.sourceColumns, ['tenant_id', 'user_id']);
  assert.deepEqual(compRel.targetColumns, ['tenant_id', 'user_id']);

  // Missing referenced table creates an External stub table + warning
  const extStub = schema.tables.find((t) => t.name === 'external_orgs');
  assert.ok(extStub);
  assert.equal(extStub.isExternal, true);
  assert.equal(schema.warnings.length, 1);
});

test('infers implicit relations accurately when inferRelations is enabled', () => {
  const sql = `
    CREATE TABLE customers (id INT PRIMARY KEY, name TEXT);
    CREATE TABLE orders (id INT PRIMARY KEY, customer_id INT NOT NULL, parent_id INT);
    CREATE TABLE order_items (id INT PRIMARY KEY, order_id INT NOT NULL);
  `;
  const withoutInfer = parseSqlToSchema(sql, { inferRelations: false });
  assert.equal(withoutInfer.relations.length, 0);

  const withInfer = parseSqlToSchema(sql, { inferRelations: true });
  assert.equal(withInfer.inferredRelationCount, 3);
  assert.ok(withInfer.relations.every((r) => r.inferred === true));
  assert.ok(
    withInfer.relations.some(
      (r) => r.sourceTableId === 'orders' && r.targetTableId === 'customers' && r.sourceColumns[0] === 'customer_id'
    )
  );
  assert.ok(
    withInfer.relations.some(
      (r) => r.sourceTableId === 'orders' && r.targetTableId === 'orders' && r.sourceColumns[0] === 'parent_id'
    )
  );
  assert.ok(
    withInfer.relations.some(
      (r) => r.sourceTableId === 'order_items' && r.targetTableId === 'orders' && r.sourceColumns[0] === 'order_id'
    )
  );
});

test('handles Oracle DDL syntax (VARCHAR2, NUMBER, CREATE UNIQUE INDEX)', () => {
  const sql = `
    CREATE TABLE "EMPLOYEES" (
      "EMP_ID" NUMBER(10, 0) PRIMARY KEY,
      "BADGE_NO" VARCHAR2(20) NOT NULL,
      "DEPT_ID" NUMBER(10, 0) NOT NULL
    );
    CREATE TABLE "DEPARTMENTS" (
      "DEPT_ID" NUMBER(10, 0) PRIMARY KEY,
      "NAME" VARCHAR2(100) NOT NULL
    );
    CREATE UNIQUE INDEX "UK_EMP_DEPT" ON "EMPLOYEES" ("DEPT_ID");
    ALTER TABLE "EMPLOYEES" ADD CONSTRAINT "FK_EMP_DEPT" FOREIGN KEY ("DEPT_ID") REFERENCES "DEPARTMENTS" ("DEPT_ID");
  `;
  const schema = parseSqlToSchema(sql);
  assert.equal(schema.dialect, 'Oracle');
  assert.equal(schema.relations.length, 1);
  // Unique index makes DEPT_ID unique -> 1:1 cardinality!
  assert.equal(schema.relations[0].cardinality, '1:1');
});
