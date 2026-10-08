import { ApiError, getToken } from '../sync/api';

export interface AdvisorMessage {
  role: 'user' | 'assistant';
  content: string;
}

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
): Promise<{ remaining: number | null; stopReason: string | null }> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/ai/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${getToken() || ''}` },
      body: JSON.stringify({ messages, context }),
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
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = '';
  let stopReason: string | null = null;
  let streamError: string | null = null;

  const handleEvent = (data: string) => {
    let ev: any;
    try { ev = JSON.parse(data); } catch { return; }
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
    buffer += value;
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
  return { remaining: remainingHeader ? Number(remainingHeader) : null, stopReason };
}

