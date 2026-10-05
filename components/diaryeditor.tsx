import { useEffect, useRef, useState } from 'react';
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import { createDiaryClient } from '../lib/diary-client';

export default function DiaryEditor() {
  const [diary, setDiary] = useState('');
  const [result, setResult] = useState('');
  const [busy, setBusy] = useState(false);
  const client = useRef<ReturnType<typeof createDiaryClient> | null>(null);
  useEffect(() => {
    const session = createDiaryClient({
      auth: firebase.auth(),
      onSessionChange() { setDiary(''); setResult(''); setBusy(false); },
    });
    client.current = session;
    return () => { client.current = null; session.dispose(); };
  }, []);

  async function submit() {
    const session = client.current;
    if (!session || busy) return;
    setBusy(true);
    await session.submit(diary, setResult, () => setBusy(false));
  }

  return <>
    <section><h1>英語の日記添削君</h1></section>
    <section>
      <h2>英語で日記を書いてみよう</h2>
      <textarea id="diaryInput" name="diary" rows={20} cols={150}
        maxLength={6000} value={diary} onChange={(event) => setDiary(event.target.value)} />
      <button disabled={busy || !diary.trim()} onClick={submit}>添削する</button>
    </section>
    <section>
      <textarea id="diaryOutput" name="diary" rows={80} cols={150} value={result} onChange={(event) => setResult(event.target.value)} />
    </section>
  </>;
}
