// Keep every response tied to the authentication session and latest request.
function createDiaryClient({ auth, fetchImpl = globalThis.fetch, onSessionChange = () => {} }) {
  let generation = 0;
  let controller;
  const cancel = () => { generation += 1; controller?.abort(); };
  const unsubscribe = auth.onAuthStateChanged(() => {
    cancel();
    onSessionChange();
  });

  return {
    async submit(diary, onResult, onSettled = () => {}) {
      cancel();
      const user = auth.currentUser;
      if (!user) { onSettled(); return; }
      const requestGeneration = generation;
      controller = new AbortController();
      const signal = controller.signal;
      const isCurrent = () => generation === requestGeneration
        && auth.currentUser === user && auth.currentUser?.uid === user.uid;
      try {
        const token = await user.getIdToken();
        if (!isCurrent()) return;
        const response = await fetchImpl('/api/diary', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ diary }),
          signal,
        });
        const data = await response.json();
        if (isCurrent()) {
          onResult(typeof data.text === 'string' ? data.text : '添削を完了できませんでした。');
        }
      } catch {
        if (isCurrent() && !signal.aborted) onResult('添削を完了できませんでした。もう一度お試しください。');
      } finally {
        if (isCurrent() && !signal.aborted) onSettled();
      }
    },
    dispose() { cancel(); unsubscribe(); },
  };
}

module.exports = { createDiaryClient };
