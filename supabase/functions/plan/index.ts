// 今日のプラン提案 API。アプリから未完了タスクを受け取り、Claude に今日やるタスクを選ばせる
import Anthropic from 'npm:@anthropic-ai/sdk@1.1.0';

import {
  buildUserMessage,
  InvalidRequestError,
  parsePlanRequest,
  PLAN_SCHEMA,
  sanitizePlan,
  SYSTEM_PROMPT,
} from './logic.ts';

const client = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') });

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers });
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { headers });
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  let planRequest;
  try {
    planRequest = parsePlanRequest(await request.json());
  } catch (e) {
    const message = e instanceof InvalidRequestError ? e.message : 'invalid JSON';
    return json({ error: 'invalid_request', message }, 400);
  }

  try {
    const response = await client.beta.messages.create({
      model: 'claude-opus-5-5',
      max_tokens: 16000,
      output_config: {
        effort: 'medium',
        format: { type: 'json_schema', schema: PLAN_SCHEMA },
      },
      // 安全性の判定で断られたときは、Anthropic おすすめの別モデルで自動的にやり直す
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: buildUserMessage(planRequest) }],
    });

    if (response.stop_reason === 'refusal') {
      console.warn('plan refused', response.stop_details);
      return json({ error: 'refused', message: 'AI がこの内容での提案を断りました' }, 502);
    }
    if (response.stop_reason === 'max_tokens') {
      return json({ error: 'truncated', message: 'AI の回答が途中で切れました' }, 502);
    }

    const text = response.content.find((block) => block.type === 'text');
    if (!text || text.type !== 'text') return json({ error: 'empty_response' }, 502);

    const plan = sanitizePlan(JSON.parse(text.text), planRequest);
    console.log('plan ok', { tasks: planRequest.tasks.length, items: plan.items.length, usage: response.usage });
    return json(plan);
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) {
      console.error('Anthropic API key is missing or invalid');
      return json({ error: 'server_misconfigured', message: 'AI の設定（API キー）に問題があります' }, 500);
    }
    if (e instanceof Anthropic.RateLimitError) {
      return json({ error: 'rate_limited', message: 'AI が混み合っています。少し待ってから試してください' }, 429);
    }
    if (e instanceof Anthropic.APIError) {
      console.error('Anthropic API error', e.status, e.message);
      return json({ error: 'upstream_error', message: 'AI の呼び出しに失敗しました' }, 502);
    }
    if (e instanceof SyntaxError) {
      console.error('Claude returned invalid JSON', e.message);
      return json({ error: 'invalid_response', message: 'AI の回答を読み取れませんでした' }, 502);
    }
    console.error('unexpected error', e);
    return json({ error: 'internal_error' }, 500);
  }
});
