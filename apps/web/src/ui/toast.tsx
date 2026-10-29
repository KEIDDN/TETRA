import { useEffect, useState } from 'react';

type Listener = (message: string) => void;
const listeners = new Set<Listener>();

/** Shows a short message at the bottom of the screen. */
export function toast(message: string): void {
  listeners.forEach((l) => l(message));
}

export function Toasts() {
  const [items, setItems] = useState<{ id: number; message: string }[]>([]);
  useEffect(() => {
    const listener: Listener = (message) => {
      const id = Date.now() + Math.random();
      setItems((list) => [...list, { id, message }]);
      setTimeout(() => setItems((list) => list.filter((i) => i.id !== id)), 2600);
    };
    listeners.add(listener);
    return () => void listeners.delete(listener);
  }, []);
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-8 z-[100] flex flex-col items-center gap-2">
      {items.map((item) => (
        <div key={item.id} className="toast glass-panel rounded-full px-5 py-2.5 text-[14px] font-medium">
          {item.message}
        </div>
      ))}
    </div>
  );
}
