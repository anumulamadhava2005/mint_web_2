"use client";

import React, { useState } from 'react';
import { useFigmaStore, type ApiSource, type GlobalStateVar } from '@/lib/stores/figmaStore';

const DARK = '#141414';
const PANEL = '#1e1e1e';
const BORDER = '#2a2a2a';
const TEXT = '#ebebeb';
const MUTED = '#888';
const ACCENT = '#0d99ff';

type SubTab = 'apis' | 'state';

function ApiSourceCard({ source, onEdit, onDelete }: {
  source: ApiSource;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const methodColor: Record<string, string> = {
    GET: '#00c864', POST: '#0d99ff', PUT: '#ff9500',
    PATCH: '#f72585', DELETE: '#ff4444',
  };

  return (
    <div
      onClick={onEdit}
      style={{
        background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 8,
        padding: '12px 14px', cursor: 'pointer', display: 'flex',
        justifyContent: 'space-between', alignItems: 'center', gap: 12,
        transition: 'border-color 150ms',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = '#404040'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = BORDER; }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        <span style={{
          fontSize: 9, fontWeight: 700, letterSpacing: '0.05em',
          color: methodColor[source.method] ?? MUTED,
          background: `${methodColor[source.method] ?? MUTED}1a`,
          border: `1px solid ${methodColor[source.method] ?? MUTED}33`,
          borderRadius: 3, padding: '2px 5px', flexShrink: 0,
        }}>
          {source.method}
        </span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: TEXT, marginBottom: 2 }}>
            {`$api.${source.name}`}
          </div>
          <div style={{
            fontSize: 10, color: MUTED, overflow: 'hidden',
            textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {source.url || 'No URL set'}
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        {source.autoFetch && (
          <span style={{
            fontSize: 9, color: '#00c864', background: '#00c86415',
            border: '1px solid #00c86430', borderRadius: 3, padding: '1px 5px',
          }}>auto</span>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          style={{
            background: 'none', border: 'none', color: '#555', cursor: 'pointer',
            fontSize: 14, padding: '2px 4px', borderRadius: 3,
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#ff4444'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#555'; }}
        >×</button>
      </div>
    </div>
  );
}

function ApiSourceForm({ initial, onSave, onCancel }: {
  initial: ApiSource | null;
  onSave: (data: Omit<ApiSource, 'id'>) => void;
  onCancel: () => void;
}) {
  const blank: Omit<ApiSource, 'id'> = {
    name: '', url: '', method: 'GET', headers: {}, queryParams: {},
    authType: 'none', autoFetch: true, responsePath: '',
  };
  const [form, setForm] = useState<Omit<ApiSource, 'id'>>(initial ? { ...initial } : blank);
  const [activeFormTab, setActiveFormTab] = useState<'basic' | 'headers' | 'auth' | 'options'>('basic');
  const [headerKey, setHeaderKey] = useState('');
  const [headerVal, setHeaderVal] = useState('');
  const [paramKey, setParamKey] = useState('');
  const [paramVal, setParamVal] = useState('');

  const patch = (p: Partial<Omit<ApiSource, 'id'>>) => setForm(f => ({ ...f, ...p }));

  const inputStyle: React.CSSProperties = {
    width: '100%', background: '#0d0d0d', border: `1px solid ${BORDER}`,
    borderRadius: 4, color: TEXT, fontSize: 12, padding: '7px 10px',
    outline: 'none', boxSizing: 'border-box', fontFamily: 'Inter, sans-serif',
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 10, color: MUTED, marginBottom: 4, display: 'block',
    fontWeight: 500, textTransform: 'uppercase' as const, letterSpacing: '0.05em',
  };

  const addHeader = () => {
    if (headerKey.trim()) {
      patch({ headers: { ...form.headers, [headerKey.trim()]: headerVal } });
      setHeaderKey(''); setHeaderVal('');
    }
  };
  const addParam = () => {
    if (paramKey.trim()) {
      patch({ queryParams: { ...form.queryParams, [paramKey.trim()]: paramVal } });
      setParamKey(''); setParamVal('');
    }
  };

  const isValid = !!(form.name.trim() && form.url.trim());

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '5px 10px', background: 'none', border: 'none',
    borderBottom: active ? `2px solid ${ACCENT}` : '2px solid transparent',
    color: active ? ACCENT : MUTED, cursor: 'pointer', fontSize: 11, fontWeight: 500,
  });

  return (
    <div style={{ background: '#0d0d0d', border: `1px solid ${BORDER}`, borderRadius: 8, overflow: 'hidden' }}>
      <div style={{ display: 'flex', borderBottom: `1px solid ${BORDER}`, padding: '0 14px' }}>
        {(['basic', 'headers', 'auth', 'options'] as const).map(t => (
          <button key={t} onClick={() => setActiveFormTab(t)} style={tabStyle(activeFormTab === t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {activeFormTab === 'basic' && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 10 }}>
              <div>
                <label style={labelStyle}>Name *</label>
                <input
                  value={form.name}
                  onChange={e => patch({ name: e.target.value.replace(/\s+/g, '_') })}
                  placeholder="getUsers"
                  style={inputStyle}
                />
                <div style={{ fontSize: 10, color: '#555', marginTop: 3 }}>
                  Token: <span style={{ fontFamily: 'monospace', color: '#7bcfff' }}>{`$api.${form.name || 'name'}`}</span>
                </div>
              </div>
              <div>
                <label style={labelStyle}>Method</label>
                <select value={form.method} onChange={e => patch({ method: e.target.value as ApiSource['method'] })}
                  style={{ ...inputStyle, cursor: 'pointer' }}>
                  {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label style={labelStyle}>URL *</label>
              <input value={form.url} onChange={e => patch({ url: e.target.value })}
                placeholder="https://api.example.com/users"
                style={{ ...inputStyle, fontFamily: 'monospace', fontSize: 11 }} />
            </div>

            <div>
              <label style={labelStyle}>Response path</label>
              <input value={form.responsePath ?? ''} onChange={e => patch({ responsePath: e.target.value })}
                placeholder="data.items  (leave blank for full response)"
                style={{ ...inputStyle, fontFamily: 'monospace', fontSize: 11 }} />
              <div style={{ fontSize: 10, color: '#555', marginTop: 3 }}>
                Dot-path to unwrap nested data. Leave blank to use full response.
              </div>
            </div>

            {(form.method === 'POST' || form.method === 'PUT' || form.method === 'PATCH') && (
              <div>
                <label style={labelStyle}>Request body template (JSON)</label>
                <textarea value={form.bodyTemplate ?? ''} onChange={e => patch({ bodyTemplate: e.target.value })}
                  placeholder={'{\n  "name": "$item.name"\n}'} rows={4}
                  style={{ ...inputStyle, resize: 'vertical', fontFamily: 'monospace', fontSize: 11 }} />
              </div>
            )}

            <div>
              <label style={labelStyle}>Query params</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {Object.entries(form.queryParams).map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <span style={{ fontFamily: 'monospace', fontSize: 11, color: TEXT, flex: 1 }}>{k} = {v}</span>
                    <button onClick={() => { const { [k]: _, ...rest } = form.queryParams; patch({ queryParams: rest }); }}
                      style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: 13 }}>×</button>
                  </div>
                ))}
                <div style={{ display: 'flex', gap: 6 }}>
                  <input value={paramKey} onChange={e => setParamKey(e.target.value)} placeholder="key"
                    style={{ ...inputStyle, flex: 1, padding: '5px 8px' }} />
                  <input value={paramVal} onChange={e => setParamVal(e.target.value)} placeholder="value or $expr"
                    style={{ ...inputStyle, flex: 2, padding: '5px 8px', fontFamily: 'monospace' }} />
                  <button onClick={addParam} style={{
                    background: ACCENT, border: 'none', borderRadius: 4, color: '#fff',
                    fontSize: 11, padding: '5px 10px', cursor: 'pointer',
                  }}>+</button>
                </div>
              </div>
            </div>
          </>
        )}

        {activeFormTab === 'headers' && (
          <div>
            <label style={labelStyle}>Headers</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {Object.entries(form.headers).map(([k, v]) => (
                <div key={k} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <span style={{ fontFamily: 'monospace', fontSize: 11, color: TEXT, flex: 1 }}>{k}: {v}</span>
                  <button onClick={() => { const { [k]: _, ...rest } = form.headers; patch({ headers: rest }); }}
                    style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: 13 }}>×</button>
                </div>
              ))}
              <div style={{ display: 'flex', gap: 6 }}>
                <input value={headerKey} onChange={e => setHeaderKey(e.target.value)} placeholder="Header-Name"
                  style={{ ...inputStyle, flex: 1, padding: '5px 8px', fontFamily: 'monospace' }} />
                <input value={headerVal} onChange={e => setHeaderVal(e.target.value)} placeholder="value"
                  style={{ ...inputStyle, flex: 2, padding: '5px 8px' }} />
                <button onClick={addHeader} style={{
                  background: ACCENT, border: 'none', borderRadius: 4, color: '#fff',
                  fontSize: 11, padding: '5px 10px', cursor: 'pointer',
                }}>+</button>
              </div>
            </div>
          </div>
        )}

        {activeFormTab === 'auth' && (
          <>
            <div>
              <label style={labelStyle}>Auth type</label>
              <select value={form.authType} onChange={e => patch({ authType: e.target.value as ApiSource['authType'] })}
                style={{ ...inputStyle, cursor: 'pointer' }}>
                <option value="none">None</option>
                <option value="bearer">Bearer Token</option>
                <option value="apiKey">API Key</option>
                <option value="basic">Basic Auth</option>
              </select>
            </div>
            {form.authType === 'bearer' && (
              <div>
                <label style={labelStyle}>Bearer token (or expression)</label>
                <input value={form.authValue ?? ''} onChange={e => patch({ authValue: e.target.value })}
                  placeholder="$global.authToken" style={{ ...inputStyle, fontFamily: 'monospace', fontSize: 11 }} />
              </div>
            )}
            {form.authType === 'apiKey' && (
              <>
                <div>
                  <label style={labelStyle}>Header/param name</label>
                  <input value={form.authKeyName ?? ''} onChange={e => patch({ authKeyName: e.target.value })}
                    placeholder="X-API-Key" style={{ ...inputStyle, fontFamily: 'monospace', fontSize: 11 }} />
                </div>
                <div>
                  <label style={labelStyle}>Key value (or expression)</label>
                  <input value={form.authValue ?? ''} onChange={e => patch({ authValue: e.target.value })}
                    placeholder="$global.apiKey" style={{ ...inputStyle, fontFamily: 'monospace', fontSize: 11 }} />
                </div>
              </>
            )}
            {form.authType === 'basic' && (
              <div>
                <label style={labelStyle}>Credentials (user:pass or expression)</label>
                <input value={form.authValue ?? ''} onChange={e => patch({ authValue: e.target.value })}
                  placeholder="$global.username:$global.password" style={{ ...inputStyle, fontFamily: 'monospace', fontSize: 11 }} />
              </div>
            )}
          </>
        )}

        {activeFormTab === 'options' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 12, color: TEXT }}>Auto-fetch on mount</div>
                <div style={{ fontSize: 10, color: MUTED }}>Fetch data when the screen loads</div>
              </div>
              <button onClick={() => patch({ autoFetch: !form.autoFetch })} style={{
                width: 36, height: 20, borderRadius: 10,
                background: form.autoFetch ? ACCENT : '#333',
                border: 'none', cursor: 'pointer', position: 'relative', flexShrink: 0,
                transition: 'background 150ms',
              }}>
                <span style={{
                  position: 'absolute', top: 2, left: form.autoFetch ? 18 : 2,
                  width: 16, height: 16, borderRadius: '50%', background: '#fff',
                  transition: 'left 150ms',
                }} />
              </button>
            </div>
            <div>
              <label style={labelStyle}>Refetch interval (ms, 0 = disabled)</label>
              <input type="number" value={form.refetchInterval ?? 0}
                onChange={e => patch({ refetchInterval: parseInt(e.target.value) || 0 })}
                min={0} step={1000} style={inputStyle} />
            </div>
          </>
        )}
      </div>

      <div style={{
        display: 'flex', gap: 8, padding: '12px 16px',
        borderTop: `1px solid ${BORDER}`, justifyContent: 'flex-end',
      }}>
        <button onClick={onCancel} style={{
          background: 'none', border: `1px solid ${BORDER}`, borderRadius: 5,
          color: MUTED, fontSize: 12, padding: '6px 14px', cursor: 'pointer',
        }}>Cancel</button>
        <button onClick={() => isValid && onSave(form)} disabled={!isValid} style={{
          background: isValid ? ACCENT : '#1a1a1a', border: 'none', borderRadius: 5,
          color: isValid ? '#fff' : '#555', fontSize: 12,
          padding: '6px 14px', cursor: isValid ? 'pointer' : 'not-allowed',
        }}>
          {initial ? 'Save changes' : 'Add API source'}
        </button>
      </div>
    </div>
  );
}

function StateVarCard({ v, onEdit, onDelete }: {
  v: GlobalStateVar;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const typeColor: Record<string, string> = {
    string: '#0d99ff', number: '#00c864', boolean: '#f72585',
    object: '#ff9500', array: '#7b61ff',
  };

  return (
    <div
      onClick={onEdit}
      style={{
        background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 8,
        padding: '12px 14px', cursor: 'pointer', display: 'flex',
        justifyContent: 'space-between', alignItems: 'center', gap: 12,
        transition: 'border-color 150ms',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = '#404040'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = BORDER; }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        <span style={{
          fontSize: 9, fontWeight: 700, letterSpacing: '0.05em',
          color: typeColor[v.type] ?? MUTED,
          background: `${typeColor[v.type] ?? MUTED}1a`,
          border: `1px solid ${typeColor[v.type] ?? MUTED}33`,
          borderRadius: 3, padding: '2px 5px', flexShrink: 0,
        }}>
          {v.type.toUpperCase()}
        </span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: TEXT, marginBottom: 2 }}>
            {v.scope === 'global' ? `$global.${v.name}` : `$page.${v.name}`}
          </div>
          {v.description && (
            <div style={{ fontSize: 10, color: MUTED, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {v.description}
            </div>
          )}
        </div>
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: 14, padding: '2px 4px' }}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#ff4444'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#555'; }}
      >×</button>
    </div>
  );
}

function StateVarForm({ initial, onSave, onCancel }: {
  initial: GlobalStateVar | null;
  onSave: (data: Omit<GlobalStateVar, 'id'>) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<Omit<GlobalStateVar, 'id'>>(
    initial ? { ...initial } : { name: '', type: 'string', defaultValue: '""', scope: 'global', description: '' }
  );
  const patch = (p: Partial<Omit<GlobalStateVar, 'id'>>) => setForm(f => ({ ...f, ...p }));

  const inputStyle: React.CSSProperties = {
    width: '100%', background: '#0d0d0d', border: `1px solid ${BORDER}`,
    borderRadius: 4, color: TEXT, fontSize: 12, padding: '7px 10px',
    outline: 'none', boxSizing: 'border-box', fontFamily: 'Inter, sans-serif',
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 10, color: MUTED, marginBottom: 4, display: 'block',
    fontWeight: 500, textTransform: 'uppercase' as const, letterSpacing: '0.05em',
  };

  const isValid = form.name.trim().length > 0;

  return (
    <div style={{ background: '#0d0d0d', border: `1px solid ${BORDER}`, borderRadius: 8, overflow: 'hidden' }}>
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10 }}>
          <div>
            <label style={labelStyle}>Variable name *</label>
            <input value={form.name} onChange={e => patch({ name: e.target.value.replace(/\s+/g, '_') })}
              placeholder="currentUser" style={inputStyle} />
            <div style={{ fontSize: 10, color: '#555', marginTop: 3 }}>
              Token: <span style={{ fontFamily: 'monospace', color: '#7bcfff' }}>
                {form.scope === 'global' ? `$global.${form.name || 'name'}` : `$page.${form.name || 'name'}`}
              </span>
            </div>
          </div>
          <div>
            <label style={labelStyle}>Scope</label>
            <select value={form.scope} onChange={e => patch({ scope: e.target.value as GlobalStateVar['scope'] })}
              style={{ ...inputStyle, cursor: 'pointer' }}>
              <option value="global">Global</option>
              <option value="page">Page</option>
            </select>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 10 }}>
          <div>
            <label style={labelStyle}>Type</label>
            <select value={form.type} onChange={e => patch({ type: e.target.value as GlobalStateVar['type'] })}
              style={{ ...inputStyle, cursor: 'pointer' }}>
              <option value="string">string</option>
              <option value="number">number</option>
              <option value="boolean">boolean</option>
              <option value="object">object</option>
              <option value="array">array</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>Default value (JSON)</label>
            <input value={form.defaultValue} onChange={e => patch({ defaultValue: e.target.value })}
              placeholder={form.type === 'string' ? '"hello"' : form.type === 'boolean' ? 'false' : form.type === 'number' ? '0' : '[]'}
              style={{ ...inputStyle, fontFamily: 'monospace', fontSize: 11 }} />
          </div>
        </div>

        <div>
          <label style={labelStyle}>Description (optional)</label>
          <input value={form.description ?? ''} onChange={e => patch({ description: e.target.value })}
            placeholder="What this variable holds…" style={inputStyle} />
        </div>
      </div>

      <div style={{
        display: 'flex', gap: 8, padding: '12px 16px',
        borderTop: `1px solid ${BORDER}`, justifyContent: 'flex-end',
      }}>
        <button onClick={onCancel} style={{
          background: 'none', border: `1px solid ${BORDER}`, borderRadius: 5,
          color: MUTED, fontSize: 12, padding: '6px 14px', cursor: 'pointer',
        }}>Cancel</button>
        <button onClick={() => isValid && onSave(form)} disabled={!isValid} style={{
          background: isValid ? '#7b61ff' : '#1a1a1a', border: 'none', borderRadius: 5,
          color: isValid ? '#fff' : '#555', fontSize: 12,
          padding: '6px 14px', cursor: isValid ? 'pointer' : 'not-allowed',
        }}>{initial ? 'Save changes' : 'Add variable'}</button>
      </div>
    </div>
  );
}

export default function BackendPanel() {
  const {
    apiSources, globalStateVars,
    addApiSource, updateApiSource, deleteApiSource,
    addGlobalStateVar, updateGlobalStateVar, deleteGlobalStateVar,
  } = useFigmaStore();
  const [subTab, setSubTab] = useState<SubTab>('apis');
  const [editingApi, setEditingApi] = useState<string | null>(null);
  const [editingVar, setEditingVar] = useState<string | null>(null);

  const subTabStyle = (active: boolean): React.CSSProperties => ({
    padding: '8px 16px', background: 'none', border: 'none',
    borderBottom: active ? `2px solid ${ACCENT}` : '2px solid transparent',
    color: active ? ACCENT : MUTED, cursor: 'pointer', fontSize: 12,
    fontWeight: active ? 600 : 400, transition: 'color 150ms',
  });

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      background: DARK, overflow: 'hidden',
      fontFamily: 'Inter, -apple-system, sans-serif',
    }}>
      <div style={{ display: 'flex', borderBottom: `1px solid ${BORDER}`, padding: '0 24px', flexShrink: 0 }}>
        <button onClick={() => setSubTab('apis')} style={subTabStyle(subTab === 'apis')}>
          APIs
          {apiSources.length > 0 && (
            <span style={{
              marginLeft: 6, background: ACCENT, color: '#fff',
              borderRadius: 10, fontSize: 9, padding: '1px 5px', fontWeight: 700,
            }}>{apiSources.length}</span>
          )}
        </button>
        <button onClick={() => setSubTab('state')} style={subTabStyle(subTab === 'state')}>
          State
          {globalStateVars.length > 0 && (
            <span style={{
              marginLeft: 6, background: '#7b61ff', color: '#fff',
              borderRadius: 10, fontSize: 9, padding: '1px 5px', fontWeight: 700,
            }}>{globalStateVars.length}</span>
          )}
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
        {subTab === 'apis' && (
          <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: TEXT }}>API Sources</h2>
                <p style={{ margin: '4px 0 0', fontSize: 12, color: MUTED }}>
                  Define REST endpoints. Use{' '}
                  <code style={{ fontFamily: 'monospace', color: '#7bcfff' }}>$api.name.data</code>{' '}
                  to bind their responses to layers.
                </p>
              </div>
              {editingApi !== 'new' && (
                <button onClick={() => { setEditingApi('new'); setEditingVar(null); }} style={{
                  background: ACCENT, border: 'none', borderRadius: 6,
                  color: '#fff', fontSize: 12, fontWeight: 500,
                  padding: '8px 16px', cursor: 'pointer', flexShrink: 0,
                }}>+ Add API source</button>
              )}
            </div>

            {editingApi === 'new' && (
              <ApiSourceForm
                initial={null}
                onSave={(data) => { addApiSource(data); setEditingApi(null); }}
                onCancel={() => setEditingApi(null)}
              />
            )}

            {apiSources.map(source => (
              <div key={source.id}>
                {editingApi === source.id ? (
                  <ApiSourceForm
                    initial={source}
                    onSave={(data) => { updateApiSource(source.id, data); setEditingApi(null); }}
                    onCancel={() => setEditingApi(null)}
                  />
                ) : (
                  <ApiSourceCard
                    source={source}
                    onEdit={() => setEditingApi(source.id)}
                    onDelete={() => deleteApiSource(source.id)}
                  />
                )}
              </div>
            ))}

            {apiSources.length === 0 && editingApi !== 'new' && (
              <div style={{
                textAlign: 'center', padding: '48px 24px',
                border: `2px dashed ${BORDER}`, borderRadius: 12, color: MUTED,
              }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>⚡</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: TEXT, marginBottom: 6 }}>No API sources yet</div>
                <div style={{ fontSize: 12, marginBottom: 20 }}>
                  Add an API source to fetch data and bind it to layers on your canvas.
                </div>
                <button onClick={() => setEditingApi('new')} style={{
                  background: ACCENT, border: 'none', borderRadius: 6,
                  color: '#fff', fontSize: 12, fontWeight: 500,
                  padding: '8px 16px', cursor: 'pointer',
                }}>+ Add your first API source</button>
              </div>
            )}
          </div>
        )}

        {subTab === 'state' && (
          <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: TEXT }}>Global State</h2>
                <p style={{ margin: '4px 0 0', fontSize: 12, color: MUTED }}>
                  Variables shared across screens. Use{' '}
                  <code style={{ fontFamily: 'monospace', color: '#7bcfff' }}>$global.name</code>{' '}
                  to reference them.
                </p>
              </div>
              {editingVar !== 'new' && (
                <button onClick={() => { setEditingVar('new'); setEditingApi(null); }} style={{
                  background: '#7b61ff', border: 'none', borderRadius: 6,
                  color: '#fff', fontSize: 12, fontWeight: 500,
                  padding: '8px 16px', cursor: 'pointer', flexShrink: 0,
                }}>+ Add variable</button>
              )}
            </div>

            {editingVar === 'new' && (
              <StateVarForm
                initial={null}
                onSave={(data) => { addGlobalStateVar(data); setEditingVar(null); }}
                onCancel={() => setEditingVar(null)}
              />
            )}

            {globalStateVars.map(v => (
              <div key={v.id}>
                {editingVar === v.id ? (
                  <StateVarForm
                    initial={v}
                    onSave={(data) => { updateGlobalStateVar(v.id, data); setEditingVar(null); }}
                    onCancel={() => setEditingVar(null)}
                  />
                ) : (
                  <StateVarCard
                    v={v}
                    onEdit={() => setEditingVar(v.id)}
                    onDelete={() => deleteGlobalStateVar(v.id)}
                  />
                )}
              </div>
            ))}

            {globalStateVars.length === 0 && editingVar !== 'new' && (
              <div style={{
                textAlign: 'center', padding: '48px 24px',
                border: `2px dashed ${BORDER}`, borderRadius: 12, color: MUTED,
              }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>📦</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: TEXT, marginBottom: 6 }}>No state variables yet</div>
                <div style={{ fontSize: 12, marginBottom: 20 }}>
                  Add global variables to share data between screens.
                </div>
                <button onClick={() => setEditingVar('new')} style={{
                  background: '#7b61ff', border: 'none', borderRadius: 6,
                  color: '#fff', fontSize: 12, fontWeight: 500,
                  padding: '8px 16px', cursor: 'pointer',
                }}>+ Add your first variable</button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
