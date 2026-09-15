import './Toast.css';

export interface ToastProps {
  message: string;
}

/**
 * A short-lived message that floats over whatever is on screen.
 *
 * It says what just happened without moving the page, so it reads the same
 * whether you are at the top of a list or scrolled to the end of it. It owns
 * no timer: the view that raises it decides how long it stays, because only
 * the view knows what replaces it.
 */
export function Toast({ message }: ToastProps) {
  return (
    <div className="toast" role="status">
      {message}
    </div>
  );
}
