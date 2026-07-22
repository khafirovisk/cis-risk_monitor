import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';

export function Ai() {
  const [config, setConfig] = useState<any>(null);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.getAiSettings().then(setConfig);
  }, []);

  async function save(e: FormEvent) {
    e.preventDefault();
    setSaved(false);
    const body: any = { enabled: config.enabled, baseUrl: config.baseUrl, model: config.model };
    if (apiKeyInput.trim()) body.apiKey = apiKeyInput.trim();
    const updated = await api.updateAiSettings(body);
    setConfig(updated);
    setApiKeyInput('');
    setSaved(true);
  }

  if (!config) return null;

  return (
    <>
      <Link to="/configuracoes" className="back-btn">← Voltar a Configurações</Link>
      <h1 className="page-title">IA</h1>
      <p className="page-sub">
        Serviço de IA usado para sugerir automaticamente quais controles CIS estão associados a um risco ao
        criá-lo (compatível com a API de chat da OpenAI — funciona com OpenRouter, OpenAI direto ou outro
        provedor compatível).
      </p>
      <form onSubmit={save} className="card" style={{ maxWidth: 560 }}>
        <label className="checkbox-row" style={{ marginTop: 0 }}>
          <input
            type="checkbox"
            checked={config.enabled}
            onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
          />
          Habilitado
        </label>
        <div className="form-full">
          <label htmlFor="ai-base-url">URL base da API</label>
          <input
            className="fld"
            id="ai-base-url"
            value={config.baseUrl || ''}
            onChange={(e) => setConfig({ ...config, baseUrl: e.target.value })}
            placeholder="https://openrouter.ai/api/v1"
          />
        </div>
        <div className="form-full">
          <label htmlFor="ai-model">Modelo</label>
          <input
            className="fld"
            id="ai-model"
            value={config.model || ''}
            onChange={(e) => setConfig({ ...config, model: e.target.value })}
            placeholder="openai/gpt-4o-mini"
          />
        </div>
        <div className="form-full">
          <label htmlFor="ai-key">Chave de API {config.hasApiKey && <span className="td-muted">(já configurada — deixe em branco para manter)</span>}</label>
          <input
            className="fld"
            id="ai-key"
            type="password"
            value={apiKeyInput}
            onChange={(e) => setApiKeyInput(e.target.value)}
            placeholder={config.hasApiKey ? '••••••••••••' : 'sk-...'}
          />
        </div>
        <p className="td-muted" style={{ margin: '8px 0 0' }}>
          Se a IA não estiver habilitada/configurada, ou a chamada falhar, o risco é criado normalmente sem
          controles vinculados — você pode corrigir manualmente na edição do risco.
        </p>
        <div className="modal-actions" style={{ justifyContent: 'flex-start', marginTop: 18 }}>
          <button className="btn" type="submit">Salvar</button>
          {saved && <span className="saved-note">Configuração salva.</span>}
        </div>
      </form>
    </>
  );
}
