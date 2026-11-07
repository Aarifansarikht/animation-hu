import { CATEGORIES } from '../animations';
import Icon from './Icon';

const SPEEDS = [0.5, 1, 1.5, 2];

/**
 * Floating bar over the 3D view: current animation, progress, play/pause, replay and speed.
 * `status` reports file animations: { loading: true } while loading, { error } if it failed.
 */
export default function NowPlaying({ animation, status, paused, speed, progressRef, onTogglePause, onReplay, onSpeed }) {
  const category = CATEGORIES.find((c) => c.id === animation.category);
  const meta = status?.error ? (
    <span className="np-error">{status.error}</span>
  ) : status?.loading ? (
    <span className="np-loading">Loading animation file…</span>
  ) : (
    category?.label
  );
  return (
    <div className="now-playing glass">
      <span className={`card-icon ${animation.category}`}>
        <Icon name={animation.category} size={20} />
      </span>

      <div className="np-info">
        <div className="np-title">
          {animation.label}
          <span className="np-from"> · {animation.from}</span>
        </div>
        <div className="np-meta">{meta}</div>
        <div className="progress">
          <div ref={progressRef} className="progress-fill" />
        </div>
      </div>

      <div className="np-controls">
        <button className="icon-btn" onClick={onReplay} title="Replay">
          <Icon name="replay" />
        </button>
        <button className="icon-btn primary" onClick={onTogglePause} title={paused ? 'Play' : 'Pause'}>
          <Icon name={paused ? 'play' : 'pause'} filled />
        </button>
        <div className="speeds" role="radiogroup" aria-label="Speed">
          {SPEEDS.map((s) => (
            <button key={s} role="radio" aria-checked={s === speed} className={s === speed ? 'active' : ''} onClick={() => onSpeed(s)}>
              {s}×
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
