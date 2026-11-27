import test from 'node:test';
import assert from 'node:assert/strict';
import { TokenType, tokenizeSql, splitStatements, stripPostgresCopyData } from '../src/parser/tokenizer.js';

test('strips comments across dialects (--, #, /* */ including nested & MySQL conditional)', () => {
  const sql = `
    -- line comment
    # mysql comment
    /* outer /* nested */ comment */
    /*!40101 SET NAMES utf8mb4 */;
    CREATE TABLE users (id INT);
  `;
  const tokens = tokenizeSql(sql);
  const words = tokens.filter((t) => t.type === TokenType.WORD).map((t) => t.upper);
  assert.deepEqual(words, ['CREATE', 'TABLE', 'USERS', 'ID', 'INT']);
});

test('handles all identifier quoting styles (backticks, double quotes, SQL Server brackets)', () => {
  const sql = 'CREATE TABLE `my_db`.`users` ("full_name" TEXT, [Order Id] INT, tags TEXT[]);';
  const tokens = tokenizeSql(sql);
  const quoted = tokens.filter((t) => t.type === TokenType.QUOTED_IDENT).map((t) => t.value);
  assert.deepEqual(quoted, ['my_db', 'users', 'full_name', 'Order Id']);
  assert.ok(tokens.some((t) => t.type === TokenType.SYMBOL && t.value === '[]'));
});

test('strips PostgreSQL COPY ... FROM stdin blocks while keeping subsequent ALTER TABLE', () => {
  const sql = `
CREATE TABLE public.users (id int);
COPY public.users (id) FROM stdin;
1
2
3
\\.
ALTER TABLE ONLY public.users ADD CONSTRAINT users_pkey PRIMARY KEY (id);
`;
  const stripped = stripPostgresCopyData(sql);
  assert.ok(!stripped.includes('COPY public.users'));
  assert.ok(stripped.includes('ALTER TABLE ONLY public.users'));

  const stmts = splitStatements(tokenizeSql(sql));
  assert.equal(stmts.length, 2);
});

test('splits T-SQL GO batch separators cleanly', () => {
  const sql = `
CREATE TABLE [dbo].[A] ([Id] INT)
GO
CREATE TABLE [dbo].[B] ([Id] INT, [AId] INT)
GO
ALTER TABLE [dbo].[B] ADD FOREIGN KEY ([AId]) REFERENCES [dbo].[A]([Id])
GO
`;
  const stmts = splitStatements(tokenizeSql(sql));
  assert.equal(stmts.length, 3);
});

test('handles PostgreSQL dollar-quoted strings and escaped single quotes', () => {
  const sql = `
    CREATE FUNCTION foo() RETURNS void AS $$
      BEGIN
        PERFORM 'it''s fine';
      END;
    $$ LANGUAGE plpgsql;
    CREATE TABLE items (id INT DEFAULT 1);
  `;
  const stmts = splitStatements(tokenizeSql(sql));
  assert.equal(stmts.length, 2);
  assert.equal(stmts[1][0].upper, 'CREATE');
  assert.equal(stmts[1][1].upper, 'TABLE');
});
