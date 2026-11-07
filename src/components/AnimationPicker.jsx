import { useState } from 'react';
import { CATEGORIES } from '../animations';
import Icon from './Icon';

/** Glass side panel listing every animation, with search and category filters. */
export default function AnimationPicker({ animations, selectedId, onSelect }) {
  const [category, setCategory] = useState('all');
  const [query, setQuery] = useState('');

  const q = query.trim().toLowerCase();
  const visible = animations.filter(
    (a) => (category === 'all' || a.category === category) && (!q || `${a.label} ${a.from}`.toLowerCase().includes(q)),
  );
  const groups = CATEGORIES.map((c) => ({ ...c, items: visible.filter((a) => a.category === c.id) })).filter(
    (g) => g.items.length,
  );
  const tabs = [{ id: 'all', label: 'All' }, ...CATEGORIES.filter((c) => animations.some((a) => a.category === c.id))];

  return (
    <aside className="picker glass">
      <header className="picker-header">
        <h2>Animations</h2>
        <span className="count">{animations.length}</span>
      </header>

      <label className="search">
        <Icon name="search" size={16} />
        <input type="search" placeholder="Search animations" value={query} onChange={(e) => setQuery(e.target.value)} />
      </label>

      <nav className="tabs" aria-label="Categories">
        {tabs.map((c) => (
          <button key={c.id} className={category === c.id ? 'active' : ''} onClick={() => setCategory(c.id)}>
            {c.label}
          </button>
        ))}
      </nav>

      <div className="list">
        {groups.map((group) => (
          <section key={group.id}>
            <h3>{group.label}</h3>
            {group.items.map((a) => (
              <button
                key={a.id}
                className={`card${a.id === selectedId ? ' selected' : ''}`}
                onClick={() => onSelect(a.id)}
              >
                <span className={`card-icon ${a.category}`}>
                  <Icon name={a.category} />
                </span>
                <span className="card-text">
                  <span className="card-title">{a.label}</span>
                  <span className="card-sub">{a.from}</span>
                </span>
                {a.loop === 'once' && <span className="tag">Once</span>}
                {a.url && <span className="tag file">{a.format.toUpperCase()}</span>}
              </button>
            ))}
          </section>
        ))}
        {!groups.length && <p className="empty">No animations match “{query}”.</p>}
      </div>

      <footer className="picker-hint">
        Drop <code>.fbx</code> / <code>.glb</code> files in <code>src/assets/animations/</code>
      </footer>
    </aside>
  );
}
