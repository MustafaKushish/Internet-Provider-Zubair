import React, { useEffect, useRef, useState } from 'react';
import { CollectionAdapter, CollectionName, SyncEngine, SyncStatus } from './syncEngine';

const DEBOUNCE_MS = 1200;
const INTERVAL_MS = 15_000;

type Setter<T> = React.Dispatch<React.SetStateAction<T>>;

export interface CloudSyncSource<T extends { id: string }> {
  value: T[];
  set: Setter<T[]>;
  fromServer?: (data: any) => T;
}

/**
 * يربط حالة المنظومة بالخادم: يرفع التغييرات بعد ثانية تقريباً من آخر تعديل،
 * ويسحب تغييرات الأجهزة الأخرى كل 15 ثانية وعند العودة للنافذة أو للإنترنت.
 */
export function useCloudSync(options: {
  enabled: boolean;
  sources: Record<CollectionName, CloudSyncSource<any>>;
  onAuthError: () => void;
  onRejected: (messages: string[]) => void;
}) {
  const { enabled, sources } = options;
  const [status, setStatus] = useState<SyncStatus>({ phase: 'idle', lastSyncAt: null, pending: 0 });

  // أحدث قيم المصادر (تُحدَّث أيضاً فوراً عند تطبيق تغييرات الخادم)
  const valuesRef = useRef<Record<string, any[]>>({});
  const sourcesRef = useRef(sources);
  sourcesRef.current = sources;
  for (const [name, src] of Object.entries(sources)) valuesRef.current[name] = src.value;

  const callbacksRef = useRef(options);
  callbacksRef.current = options;

  const engineRef = useRef<SyncEngine | null>(null);
  if (!engineRef.current) {
    engineRef.current = new SyncEngine(
      () => {
        const out = {} as Record<CollectionName, CollectionAdapter>;
        for (const name of Object.keys(sourcesRef.current) as CollectionName[]) {
          const src = sourcesRef.current[name];
          out[name] = {
            get: () => valuesRef.current[name] || [],
            set: updater => {
              valuesRef.current[name] = updater(valuesRef.current[name] || []);
              src.set(prev => updater(prev));
            },
            fromServer: src.fromServer,
          };
        }
        return out;
      },
      s => setStatus(s),
      () => callbacksRef.current.onAuthError(),
      msgs => callbacksRef.current.onRejected(msgs),
    );
  }
  const engine = engineRef.current;

  // مزامنة فورية عند التفعيل، ثم دورياً وعند عودة الاتصال أو التركيز
  useEffect(() => {
    if (!enabled) return;
    const run = () => { void engine.sync(); };
    run();
    const interval = setInterval(run, INTERVAL_MS);
    const onVisible = () => { if (document.visibilityState === 'visible') run(); };
    window.addEventListener('online', run);
    window.addEventListener('focus', run);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(interval);
      window.removeEventListener('online', run);
      window.removeEventListener('focus', run);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [enabled, engine]);

  // رفع التغييرات المحلية بعد توقف التعديل لحظة
  const values = Object.values(sources).map(s => s.value);
  useEffect(() => {
    if (!enabled) return;
    const t = setTimeout(() => { void engine.sync(); }, DEBOUNCE_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, engine, ...values]);

  return { status, syncNow: () => engine.sync(), resetSync: () => engine.reset() };
}
