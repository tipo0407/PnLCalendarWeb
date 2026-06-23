import { useEffect, useState } from 'react';
import { Pencil, Trash2, Check, Merge } from 'lucide-react';
import { getCustomTags, removeCustomTag, renameCustomTag, CUSTOM_TAGS_EVENT, type TagDef } from '../lib/customTags';
import { remapTag } from '../lib/userTags';
import { MISTAKE_TAGS } from '../lib/tags';
import { EMOTIONS } from '../lib/emotions';

type Kind = 'mistake' | 'emotion';

/** Manage user-defined custom tags: rename, delete, or merge into another tag. */
export default function TagsManager() {
  const [, bump] = useState(0);
  useEffect(() => {
    const refresh = () => bump((n) => n + 1);
    window.addEventListener(CUSTOM_TAGS_EVENT, refresh);
    return () => window.removeEventListener(CUSTOM_TAGS_EVENT, refresh);
  }, []);

  const custom = getCustomTags();
  if (custom.mistakes.length === 0 && custom.emotions.length === 0) return null;

  return (
    <div className="tags-mgr">
      <div className="set-section-head">Custom tags</div>
      {custom.mistakes.length > 0 && <Group kind="mistake" label="Mistakes" tags={custom.mistakes} />}
      {custom.emotions.length > 0 && <Group kind="emotion" label="Emotions" tags={custom.emotions} />}
    </div>
  );
}

function Group({ kind, label, tags }: { kind: Kind; label: string; tags: TagDef[] }) {
  const builtins = kind === 'mistake' ? MISTAKE_TAGS : EMOTIONS;
  const allOthers = (selfKey: string) => [
    ...builtins.map((b) => ({ key: b.key, label: b.label })),
    ...tags.filter((t) => t.key !== selfKey),
  ];
  return (
    <div className="tags-group">
      <span className="tags-group-label">{label}</span>
      {tags.map((tag) => (
        <TagRow key={tag.key} kind={kind} tag={tag} others={allOthers(tag.key)} />
      ))}
    </div>
  );
}

function TagRow({ kind, tag, others }: { kind: Kind; tag: TagDef; others: { key: string; label: string }[] }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(tag.label);

  function commit() { renameCustomTag(kind, tag.key, draft); setEditing(false); }

  function merge(toKey: string) {
    if (!toKey) return;
    if (!window.confirm(`Merge “${tag.label}” into the selected tag? Trades keep the target tag.`)) return;
    remapTag(kind, tag.key, toKey);
    removeCustomTag(kind, tag.key);
  }

  return (
    <div className="tags-row">
      {editing ? (
        <input
          className="tags-edit"
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }}
          onBlur={commit}
        />
      ) : (
        <span className="tags-name">{tag.label}</span>
      )}
      <div className="tags-actions">
        {editing
          ? <button title="Save" onClick={commit}><Check size={14} /></button>
          : <button title="Rename" onClick={() => { setDraft(tag.label); setEditing(true); }}><Pencil size={13} /></button>}
        <span className="tags-merge" title="Merge into…">
          <Merge size={13} />
          <select defaultValue="" onChange={(e) => { merge(e.target.value); e.target.value = ''; }} aria-label="Merge into">
            <option value="" disabled>Merge…</option>
            {others.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
          </select>
        </span>
        <button title="Delete" onClick={() => removeCustomTag(kind, tag.key)}><Trash2 size={13} /></button>
      </div>
    </div>
  );
}
