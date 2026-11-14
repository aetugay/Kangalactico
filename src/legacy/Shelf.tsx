import { GROUPS, RECORDS, isLive, type RecordDef } from './records';

interface Props {
  selectedId: string;
  spinning: boolean;
  onSelect: (r: RecordDef) => void;
}

/** Plak rafları. "Yakında" plaklar aria-disabled: ekran okuyucu yine de bulur ve okur. */
export function Shelf({ selectedId, spinning, onSelect }: Props) {
  return (
    <>
      {GROUPS.map((g) => (
        <section key={g.id} aria-labelledby={`shelf-${g.id}`} className="mb-5">
          <h2 id={`shelf-${g.id}`} className="shelf-title">
            {g.title} <span>{g.desc}</span>
          </h2>
          <ul className="shelf" role="list">
            {RECORDS.filter((r) => r.group === g.id).map((r) => {
              const live = isLive(r);
              const selected = r.id === selectedId;
              return (
                <li key={r.id}>
                  <button
                    type="button"
                    className={`record${selected && spinning ? ' spinning' : ''}`}
                    style={{ '--label': r.color } as React.CSSProperties}
                    aria-pressed={selected}
                    aria-disabled={!live}
                    aria-label={`${r.title} plağı. ${r.desc}${live ? '' : ' Yakında, henüz çalınamıyor.'}`}
                    onClick={() => onSelect(r)}
                  >
                    <span className="disc" aria-hidden="true" />
                    <b>{r.title}</b>
                    <small>{r.desc}</small>
                    <span className={`tag ${live ? 'live' : 'soon'}`} aria-hidden="true">
                      {live ? 'GERÇEK VERİ' : 'YAKINDA'}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </>
  );
}
