import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Plus, Pencil, Trash2, Check } from 'lucide-react';
import {
  listProfiles, getActiveProfileId, setActiveProfile,
  createProfile, renameProfile, deleteProfile, PROFILE_EVENT,
} from '../lib/profiles';

interface Props {
  /** Called after the active profile changes (or a delete reassigns it). */
  onChange: () => void;
}

export default function ProfileSwitcher({ onChange }: Props) {
  const [, bump] = useState(0);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const refresh = () => bump((n) => n + 1);
    window.addEventListener(PROFILE_EVENT, refresh);
    return () => window.removeEventListener(PROFILE_EVENT, refresh);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const profiles = listProfiles();
  const activeId = getActiveProfileId();
  const active = profiles.find((p) => p.id === activeId);

  function switchTo(id: string) {
    if (id !== activeId) { setActiveProfile(id); onChange(); }
    setOpen(false);
  }

  function addProfile() {
    const p = createProfile('New profile');
    setEditing(p.id);
    setDraft(p.name);
  }

  function commitRename(id: string) {
    if (draft.trim()) renameProfile(id, draft.trim());
    setEditing(null);
  }

  function removeProfile(id: string) {
    if (!window.confirm('Delete this profile and its trades? This cannot be undone.')) return;
    deleteProfile(id);
    onChange();
  }

  // Only show the switcher once more than one profile exists or the menu is opened.
  return (
    <div className="profile-switch" ref={ref}>
      <button className="profile-btn" onClick={() => setOpen((o) => !o)} title="Switch profile">
        <span className="profile-dot" />
        <span className="profile-name">{active?.name ?? 'Default'}</span>
        <ChevronDown size={14} />
      </button>
      {open && (
        <div className="profile-menu">
          <div className="profile-menu-head">Profiles</div>
          {profiles.map((p) => (
            <div key={p.id} className={`profile-item ${p.id === activeId ? 'active' : ''}`}>
              {editing === p.id ? (
                <input
                  className="profile-edit"
                  autoFocus
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') commitRename(p.id); if (e.key === 'Escape') setEditing(null); }}
                  onBlur={() => commitRename(p.id)}
                />
              ) : (
                <button className="profile-pick" onClick={() => switchTo(p.id)}>
                  {p.id === activeId ? <Check size={14} /> : <span className="profile-check-spacer" />}
                  {p.name}
                </button>
              )}
              <span className="profile-actions">
                <button onClick={() => { setEditing(p.id); setDraft(p.name); }} title="Rename"><Pencil size={13} /></button>
                {profiles.length > 1 && (
                  <button onClick={() => removeProfile(p.id)} title="Delete"><Trash2 size={13} /></button>
                )}
              </span>
            </div>
          ))}
          <button className="profile-add" onClick={addProfile}><Plus size={14} /> New profile</button>
        </div>
      )}
    </div>
  );
}
