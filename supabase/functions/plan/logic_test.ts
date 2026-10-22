import { assertEquals, assertThrows } from 'jsr:@std/assert@1';

import { buildUserMessage, InvalidRequestError, parsePlanRequest, sanitizePlan } from './logic.ts';

const validBody = {
  date: '2026-10-22',
  availableMinutes: 120,
  energy: 'normal',
  tasks: [
    { id: 'a', title: '企画書の構成を決める', dueDate: '2026-10-24', projectName: '仕事', plannedToday: true, createdAt: '2026-10-20T00:00:00Z' },
    { id: 'b', title: '歯医者に電話する', dueDate: null, projectName: null, plannedToday: false, createdAt: '2026-10-01T00:00:00Z' },
  ],
};

Deno.test('parsePlanRequest accepts a valid body', () => {
  const req = parsePlanRequest(validBody);
  assertEquals(req.tasks.length, 2);
  assertEquals(req.tasks[0].dueDate, '2026-10-24');
  assertEquals(req.tasks[1].createdAt, '2026-10-01');
});

Deno.test('parsePlanRequest rejects bad input', () => {
  assertThrows(() => parsePlanRequest(null), InvalidRequestError);
  assertThrows(() => parsePlanRequest({ ...validBody, date: 'today' }), InvalidRequestError);
  assertThrows(() => parsePlanRequest({ ...validBody, availableMinutes: 5 }), InvalidRequestError);
  assertThrows(() => parsePlanRequest({ ...validBody, energy: 'max' }), InvalidRequestError);
  assertThrows(() => parsePlanRequest({ ...validBody, tasks: [] }), InvalidRequestError);
  assertThrows(() => parsePlanRequest({ ...validBody, tasks: [{ id: 'x' }] }), InvalidRequestError);
});

Deno.test('parsePlanRequest drops malformed optional fields', () => {
  const req = parsePlanRequest({ ...validBody, tasks: [{ id: 'a', title: ' x ', dueDate: 'soon', projectName: 3 }] });
  assertEquals(req.tasks[0], { id: 'a', title: 'x', dueDate: null, projectName: null, plannedToday: false, createdAt: '' });
});

Deno.test('buildUserMessage includes the conditions and every task', () => {
  const message = buildUserMessage(parsePlanRequest(validBody));
  assertEquals(message.includes('今日使える時間: 120分'), true);
  assertEquals(message.includes('体力・気分: 普通'), true);
  assertEquals(message.includes('"id":"a"'), true);
  assertEquals(message.includes('"id":"b"'), true);
});

Deno.test('sanitizePlan keeps only known, unique tasks and clamps minutes', () => {
  const req = parsePlanRequest(validBody);
  const plan = sanitizePlan(
    {
      comment: ' いい一日に ',
      items: [
        { taskId: 'a', estimateMinutes: 45, reason: '金曜締切' },
        { taskId: 'zzz', estimateMinutes: 10, reason: '存在しない' },
        { taskId: 'a', estimateMinutes: 30, reason: '重複' },
        { taskId: 'b', estimateMinutes: 1, reason: 'すぐ終わる' },
      ],
    },
    req,
  );
  assertEquals(plan, {
    comment: 'いい一日に',
    items: [
      { taskId: 'a', estimateMinutes: 45, reason: '金曜締切' },
      { taskId: 'b', estimateMinutes: 5, reason: 'すぐ終わる' },
    ],
  });
});

Deno.test('sanitizePlan tolerates garbage', () => {
  assertEquals(sanitizePlan('nope', parsePlanRequest(validBody)), { comment: '', items: [] });
});
