import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSqlToSchema } from '../src/parser/sqlParser.js';
import { computeErdLayout } from '../src/layout/erdLayout.js';
import { SAMPLE_PRESETS } from '../src/samples/presets.js';

function assertNoNodeOverlap(layout, label) {
  const list = [...layout.nodes.values()];
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i];
      const b = list[j];
      const overlapX = a.x < b.x + b.width && a.x + a.width > b.x;
      const overlapY = a.y < b.y + b.height && a.y + a.height > b.y;
      assert.equal(
        overlapX && overlapY,
        false,
        `${label}: nodes "${a.id}" and "${b.id}" overlap!`
      );
    }
  }
}

test('all three layout algorithms produce non-overlapping valid coordinates', () => {
  for (const [presetName, preset] of Object.entries(SAMPLE_PRESETS)) {
    const schema = parseSqlToSchema(preset.sql);
    for (const algorithm of ['hierarchical', 'clustered', 'grid']) {
      const layout = computeErdLayout(schema, { algorithm, detailMode: 'full' });
      assert.equal(layout.nodes.size, schema.tables.length);
      assertNoNodeOverlap(layout, `${presetName}/${algorithm}`);
      assert.ok(layout.bounds.width > 0 && layout.bounds.height > 0);
    }
  }
});

test('layout handles cyclic foreign keys and isolated tables cleanly', () => {
  const sql = `
    CREATE TABLE a (id INT PRIMARY KEY, b_id INT REFERENCES b(id));
    CREATE TABLE b (id INT PRIMARY KEY, a_id INT REFERENCES a(id));
    CREATE TABLE standalone_1 (id INT PRIMARY KEY);
    CREATE TABLE standalone_2 (id INT PRIMARY KEY);
  `;
  const schema = parseSqlToSchema(sql);
  const layout = computeErdLayout(schema, { algorithm: 'hierarchical' });
  assert.equal(layout.nodes.size, 4);
  assertNoNodeOverlap(layout, 'cyclic+isolated');
});

test('layout respects detailMode (full, keys, compact) card heights', () => {
  const schema = parseSqlToSchema(SAMPLE_PRESETS.ecommerce_mysql.sql);
  const full = computeErdLayout(schema, { detailMode: 'full' });
  const keys = computeErdLayout(schema, { detailMode: 'keys' });
  const compact = computeErdLayout(schema, { detailMode: 'compact' });

  const prodFull = full.nodes.get('products');
  const prodKeys = keys.nodes.get('products');
  const prodCompact = compact.nodes.get('products');

  assert.ok(prodFull.height > prodKeys.height);
  assert.ok(prodKeys.height > prodCompact.height);
});
