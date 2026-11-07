import Icon from './Icon';

/** Glass switch with one button per model; the active model also shows its bone count and height. */
export default function ModelPicker({ models, model, info, onSelect }) {
  return (
    <div className="model-switch glass" role="radiogroup" aria-label="Model">
      <span className="ms-label">Model</span>

      <div className="ms-options">
        {models.map((m) => {
          const active = m.id === model.id;
          return (
            <button
              key={m.id}
              role="radio"
              aria-checked={active}
              className={`ms-btn${active ? ' active' : ''}`}
              onClick={() => onSelect(m.id)}
            >
              <Icon name="model" size={15} />
              {m.label}
            </button>
          );
        })}
      </div>

      <span className="mp-stats">
        {info ? (
          <>
            <span>{info.bones} bones</span>
            <span>{info.height.toFixed(2)} m</span>
          </>
        ) : (
          <span className="mp-loading">Loading…</span>
        )}
      </span>
    </div>
  );
}
