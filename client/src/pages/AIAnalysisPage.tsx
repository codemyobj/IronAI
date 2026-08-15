import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { useTranslation } from 'react-i18next';
import { useHeader } from '../context/HeaderContext';
import apiClient from '../api';
import type { AIAnalysis } from '../types';

export default function AIAnalysisPage() {
  const { t, i18n } = useTranslation();
  const { setHeader } = useHeader();
  const [analysisResult, setAnalysisResult] = useState('');
  const [analysisType, setAnalysisType] = useState<'training' | 'diet'>('training');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [history, setHistory] = useState<AIAnalysis[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const loadHistory = async () => {
    try {
      const res = await apiClient.get('/ai/history');
      setHistory(res.data.analyses);
      setShowHistory(true);
    } catch (err: any) {
      setError(err.response?.data?.error || t('ai.loadHistoryFailed'));
    }
  };

  useEffect(() => {
    setHeader({
      title: t('ai.title'),
      subtitle: t('ai.description'),
    });
  }, [t, setHeader]);

  const handleAnalysis = async (type: 'training' | 'diet') => {
    setLoading(true);
    setError('');
    setAnalysisResult('');
    setAnalysisType(type);

    try {
      const endpoint = type === 'training' ? '/ai/training-analysis' : '/ai/diet-recommendation';
      const lang = i18n.language?.split('-')[0] || 'en';
      const res = await apiClient.post(endpoint, { lang });
      const result = type === 'training' ? res.data.analysis : res.data.recommendation;
      setAnalysisResult(result);
    } catch (err: any) {
      if (err.response?.status === 502) {
        setError(t('ai.serviceUnavailable'));
      } else {
        setError(err.response?.data?.error || t('ai.analysisFailed'));
      }
    } finally {
      setLoading(false);
    }
  };

  const getTypeLabel = (type: string) => type === 'training' ? t('ai.training') : t('ai.diet');

  return (
    <div className="ai-page">
      <div className="page-actions">
        <button className="btn btn-outline" onClick={loadHistory}>
          {t('ai.history')}
        </button>
      </div>

      {/* Action Buttons */}
      <div className="ai-actions">
        <div className="ai-action-card" onClick={() => !loading && handleAnalysis('training')}>
          <div className="ai-action-icon">
            <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M6.5 6.5h11M6.5 17.5h11M4.5 9.5v5M19.5 9.5v5M9 4.5v15M15 4.5v15"/></svg>
          </div>
          <h3>{t('ai.trainingAnalysis')}</h3>
          <p className="text-muted">
            {t('ai.trainingDesc')}
          </p>
          <button className="btn btn-primary" disabled={loading}>
            {loading && analysisType === 'training' ? t('ai.analyzing') : t('ai.analyzeTraining')}
          </button>
        </div>

        <div className="ai-action-card" onClick={() => !loading && handleAnalysis('diet')}>
          <div className="ai-action-icon">
            <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M3 11h18M5 11V8a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v3M5 11v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/></svg>
          </div>
          <h3>{t('ai.dietRecommendations')}</h3>
          <p className="text-muted">
            {t('ai.dietDesc')}
          </p>
          <button className="btn btn-primary" disabled={loading}>
            {loading && analysisType === 'diet' ? t('ai.generating') : t('ai.getDietPlan')}
          </button>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="ai-loading">
          <div className="spinner" />
          <p>
            {analysisType === 'training'
              ? t('ai.analyzingTraining')
              : t('ai.analyzingDiet')}
          </p>
          <p className="text-muted">{t('ai.waitHint')}</p>
        </div>
      )}

      {/* Error */}
      {error && <div className="alert alert-error">{error}</div>}

      {/* Result */}
      {analysisResult && (
        <div className="ai-result">
          <h2>{analysisType === 'training' ? t('ai.trainingResult') : t('ai.dietResult')}</h2>
          <div className="markdown-content">
            <ReactMarkdown>{analysisResult}</ReactMarkdown>
          </div>
        </div>
      )}

      {/* History Modal */}
      {showHistory && (
        <div className="modal-overlay" onClick={() => setShowHistory(false)}>
          <div className="modal modal-wide" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{t('ai.analysisHistory')}</h2>
              <button className="btn-close" onClick={() => setShowHistory(false)}>✕</button>
            </div>
            <div className="modal-body">
              {history.length === 0 ? (
                <p className="text-muted">{t('ai.noHistory')}</p>
              ) : (
                <div className="history-list">
                  {history.map(item => (
                    <div
                      key={item.id}
                      className="history-item"
                      onClick={() => {
                        setAnalysisResult(item.response_text);
                        setAnalysisType(item.analysis_type);
                        setShowHistory(false);
                      }}
                    >
                      <div className="history-item-header">
                        <span>{getTypeLabel(item.analysis_type)}</span>
                        <span className="text-muted">
                          {new Date(item.created_at).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-muted">
                        {item.response_text.substring(0, 150)}...
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
