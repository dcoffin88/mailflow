import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from '../store/index.js';
import { api } from '../utils/api.js';

export default function TodoistTaskModal({ message, onClose }) {
  const { t } = useTranslation();
  const { addNotification } = useStore();

  const [title, setTitle] = useState(message?.subject || '');
  const [description, setDescription] = useState('');
  const [projectId, setProjectId] = useState('');
  const [selectedLabels, setSelectedLabels] = useState([]);
  const [priority, setPriority] = useState(1);
  const [dueString, setDueString] = useState('');
  const [projects, setProjects] = useState([]);
  const [labels, setLabels] = useState([]);
  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const [projs, lbls] = await Promise.all([
          api.todoist.getProjects(),
          api.todoist.getLabels(),
        ]);
        setProjects(projs);
        setLabels(lbls);
      } catch (err) {
        setLoadError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  function toggleLabel(name) {
    setSelectedLabels(prev =>
      prev.includes(name) ? prev.filter(l => l !== name) : [...prev, name]
    );
  }

  async function handleCreate() {
    if (!title.trim()) return;
    setCreating(true);
    setError('');
    try {
      const task = await api.todoist.createTask({
        content: title.trim(),
        description: description.trim() || undefined,
        project_id: projectId || undefined,
        labels: selectedLabels.length ? selectedLabels : undefined,
        priority: priority > 1 ? priority : undefined,
        due_string: dueString.trim() || undefined,
      });
      addNotification({
        title: t('todoist.taskCreated'),
        body: title.trim(),
        actionLabel: t('todoist.openTask'),
        onAction: () => window.open(task.url, '_blank', 'noopener'),
      });
      onClose();
    } catch (err) {
      setError(err.message);
      setCreating(false);
    }
  }

  const inputStyle = {
    padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)',
    background: 'var(--bg-primary)', color: 'var(--text-primary)',
    fontSize: 14, outline: 'none', width: '100%', boxSizing: 'border-box',
  };

  const labelStyle = { fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)' };

  const priorities = [
    { value: 4, label: t('todoist.priorityUrgent') },
    { value: 3, label: t('todoist.priorityHigh') },
    { value: 2, label: t('todoist.priorityMedium') },
    { value: 1, label: t('todoist.priorityNormal') },
  ];

  return (
    <div
      onClick={e => e.target === e.currentTarget && onClose()}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 3000, padding: 24,
      }}
    >
      <div style={{
        background: 'var(--bg-secondary)', border: '1px solid var(--border)',
        borderRadius: 14, width: '100%', maxWidth: 480,
        boxShadow: 'var(--shadow-modal)', overflow: 'hidden',
        maxHeight: 'calc(100vh - 48px)', display: 'flex', flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 18px', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2">
              <circle cx="12" cy="12" r="9"/>
              <polyline points="9 12 11 14 15 10"/>
            </svg>
            <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>
              {t('todoist.title')}
            </span>
            <span style={{
              fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
              background: 'rgba(99,102,241,0.15)', color: 'var(--accent)',
              textTransform: 'uppercase', letterSpacing: '0.06em',
            }}>
              {t('todoist.betaLabel')}
            </span>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 4, display: 'flex' }}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: 18, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Title */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <label style={labelStyle}>{t('todoist.taskTitle')}</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !creating && title.trim() && handleCreate()}
              placeholder={t('todoist.taskTitlePh')}
              autoFocus
              style={inputStyle}
            />
          </div>

          {/* Description */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <label style={labelStyle}>{t('todoist.description')}</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder={t('todoist.descriptionPh')}
              rows={3}
              style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
            />
          </div>

          {loading ? (
            <div style={{ color: 'var(--text-tertiary)', fontSize: 13, textAlign: 'center', padding: '4px 0' }}>
              {t('common.loading')}
            </div>
          ) : loadError ? (
            <div style={{ fontSize: 13, color: 'var(--red, #f87171)', padding: '8px 10px', borderRadius: 6, background: 'rgba(248,113,113,0.08)' }}>
              {loadError}
            </div>
          ) : (
            <>
              {/* Project */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <label style={labelStyle}>{t('todoist.project')}</label>
                <select
                  value={projectId}
                  onChange={e => setProjectId(e.target.value)}
                  style={{ ...inputStyle, cursor: 'pointer' }}
                >
                  <option value="">{t('todoist.inbox')}</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              {/* Labels */}
              {labels.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <label style={labelStyle}>{t('todoist.labels')}</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {labels.map(l => {
                      const active = selectedLabels.includes(l.name);
                      return (
                        <button
                          key={l.id}
                          onClick={() => toggleLabel(l.name)}
                          style={{
                            padding: '4px 10px', borderRadius: 20, fontSize: 12,
                            border: '1px solid ' + (active ? 'var(--accent)' : 'var(--border)'),
                            background: active ? 'rgba(99,102,241,0.15)' : 'var(--bg-tertiary)',
                            color: active ? 'var(--accent)' : 'var(--text-secondary)',
                            cursor: 'pointer', transition: 'all 0.1s',
                          }}
                        >
                          {l.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Priority + Due date */}
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
              <label style={labelStyle}>{t('todoist.priority')}</label>
              <select
                value={priority}
                onChange={e => setPriority(Number(e.target.value))}
                style={{ ...inputStyle, cursor: 'pointer' }}
              >
                {priorities.map(p => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
              <label style={labelStyle}>{t('todoist.dueDate')}</label>
              <input
                type="text"
                value={dueString}
                onChange={e => setDueString(e.target.value)}
                placeholder={t('todoist.dueDatePh')}
                style={inputStyle}
              />
            </div>
          </div>

          {error && (
            <div style={{ fontSize: 13, color: 'var(--red, #f87171)', padding: '8px 10px', borderRadius: 6, background: 'rgba(248,113,113,0.08)' }}>
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex', justifyContent: 'flex-end', gap: 8,
          padding: '12px 18px', borderTop: '1px solid var(--border-subtle)', flexShrink: 0,
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '7px 16px', borderRadius: 7, border: '1px solid var(--border)',
              background: 'transparent', color: 'var(--text-primary)', cursor: 'pointer', fontSize: 13,
            }}
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={handleCreate}
            disabled={creating || !title.trim()}
            style={{
              padding: '7px 16px', borderRadius: 7, border: 'none',
              background: 'var(--accent)', color: 'white',
              cursor: (creating || !title.trim()) ? 'default' : 'pointer',
              fontSize: 13, fontWeight: 500, opacity: (creating || !title.trim()) ? 0.7 : 1,
            }}
          >
            {creating ? t('todoist.creating') : t('todoist.create')}
          </button>
        </div>
      </div>
    </div>
  );
}
