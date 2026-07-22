import { useEffect, useRef, useState } from 'react';
import { subscribeToast } from '../lib/toast';

export function Toast() {
  const [message, setMessage] = useState('');
  const [show, setShow] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => subscribeToast((msg) => {
    setMessage(msg);
    setShow(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setShow(false), 1800);
  }), []);

  return (
    <div className={`toast${show ? ' show' : ''}`} role="status">{message}</div>
  );
}
