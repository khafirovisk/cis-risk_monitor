// Pub-sub simples para o toast global (um único <Toast/> montado em App.tsx
// escuta e exibe). Evita ter que passar um contexto/provider por toda a árvore
// só para uma notificação de canto de tela.
type Listener = (message: string) => void;
const listeners = new Set<Listener>();

export function showToast(message: string) {
  listeners.forEach((l) => l(message));
}

export function subscribeToast(listener: Listener) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
