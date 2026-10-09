import { ApiError, getToken } from '../sync/api';

export interface AdvisorMessage {
  role: 'user' | 'assistant';
  content: string;
  via?: string; // المحرك الذي أجاب (للعرض فقط، لا يُرسل)
}

export type AdvisorProvider = 'auto' | 'gemini' | 'workers' | 'claude';

export const PROVIDER_LABELS: Record<string, string> = {
  gemini: 'Google Gemini',
  workers: 'Cloudflare AI',
  claude: 'Claude',
};

export interface AdvisorHandlers {
  onThinking: (summary: string) => void;
  onText: (delta: string) => void;
}

const API_BASE: string = (import.meta as any).env?.VITE_API_BASE || '';

/**
 * يرسل السؤال للخادم ويقرأ البث (Server-Sent Events من Claude كما هي).
 * يعيد عدد الأسئلة المتبقية اليوم إن توفر.
 */
export async function askAdvisor(
  messages: AdvisorMessage[],
  context: string,
  handlers: AdvisorHandlers,
  signal?: AbortSignal,
  provider: AdvisorProvider = 'auto',
): Promise<{ remaining: number | null; stopReason: string | null; provider: string | null; model: string | null }> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/ai/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${getToken() || ''}` },
      body: JSON.stringify({ messages: messages.map(m => ({ role: m.role, content: m.content })), context, provider }),
      signal,
    });
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    throw new ApiError(0, 'لا يوجد اتصال بالخادم. المستشار يحتاج إلى الإنترنت.', true);
  }
  if (!res.ok || !res.body) {
    let msg = `خطأ من الخادم (${res.status})`;
    try { msg = (await res.json()).error || msg; } catch { /* ليس JSON */ }
    throw new ApiError(res.status, msg);
  }

  const remainingHeader = res.headers.get('x-advisor-remaining');
  const usedProvider = res.headers.get('x-advisor-provider');
  const usedModel = res.headers.get('x-advisor-model');
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = '';
  let stopReason: string | null = null;
  let streamError: string | null = null;

  // ثلاث صيغ بث: Claude (type)، Gemini (candidates)، Workers AI (response أو choices أو output_text)
  const handleEvent = (data: string) => {
    if (data === '[DONE]') return;
    let ev: any;
    try { ev = JSON.parse(data); } catch { return; }
    if (Array.isArray(ev.candidates)) {
      const cand = ev.candidates[0] || {};
      for (const part of cand.content?.parts || []) {
        if (typeof part.text !== 'string') continue;
        if (part.thought) handlers.onThinking(part.text); else handlers.onText(part.text);
      }
      if (cand.finishReason === 'MAX_TOKENS') stopReason = 'max_tokens';
      else if (cand.finishReason && /SAFETY|PROHIBITED|BLOCKLIST|RECITATION/.test(cand.finishReason)) stopReason = 'refusal';
      else if (cand.finishReason) stopReason = 'end_turn';
      if (ev.promptFeedback?.blockReason) stopReason = 'refusal';
      return;
    }
    if (typeof ev.response === 'string') { if (ev.response) handlers.onText(ev.response); return; }
    if (Array.isArray(ev.choices)) {
      const d = ev.choices[0]?.delta || {};
      if (typeof d.reasoning_content === 'string' && d.reasoning_content) handlers.onThinking(d.reasoning_content);
      if (typeof d.content === 'string' && d.content) handlers.onText(d.content);
      if (ev.choices[0]?.finish_reason === 'length') stopReason = 'max_tokens';
      return;
    }
    if (ev.type === 'response.output_text.delta' && typeof ev.delta === 'string') { handlers.onText(ev.delta); return; }
    if (ev.type === 'response.reasoning_text.delta' && typeof ev.delta === 'string') { handlers.onThinking(ev.delta); return; }
    switch (ev.type) {
      case 'content_block_delta':
        if (ev.delta?.type === 'text_delta') handlers.onText(ev.delta.text);
        else if (ev.delta?.type === 'thinking_delta') handlers.onThinking(ev.delta.thinking);
        break;
      case 'message_delta':
        if (ev.delta?.stop_reason) stopReason = ev.delta.stop_reason;
        break;
      case 'error':
        streamError = ev.error?.type === 'overloaded_error'
          ? 'خدمة الذكاء الاصطناعي مزدحمة الآن. حاول بعد قليل.'
          : 'انقطعت الإجابة بسبب خطأ في خدمة الذكاء الاصطناعي.';
        break;
    }
  };

  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    // Gemini يفصل الأحداث بـ \r\n\r\n؛ نوحّد نهايات الأسطر قبل التقسيم
    buffer = (buffer + value).replace(/\r\n/g, '\n');
    let idx: number;
    // أحداث SSE تفصلها سطر فارغ؛ نقرأ أسطر data: فقط
    while ((idx = buffer.indexOf('\n\n')) !== -1) {
      const chunk = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      const data = chunk.split('\n').filter(l => l.startsWith('data:')).map(l => l.slice(5).trimStart()).join('\n');
      if (data) handleEvent(data);
    }
  }
  if (streamError) throw new ApiError(502, streamError);
  return { remaining: remainingHeader ? Number(remainingHeader) : null, stopReason, provider: usedProvider, model: usedModel };
}

