import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import apiClient from '../api';
import type { AIAnalysis } from '../types';

export default function AIAnalysisPage() {
  const [analysisResult, setAnalysisResult] = useState('');
  const [analysisType, setAnalysisType] = useState<'training' | 'diet'>('training');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [history, setHistory] = useState<AIAnalysis[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const handleAnalysis = async (type: 'training' | 'diet') => {
    setLoading(true);
    setError('');
    setAnalysisResult('');
    setAnalysisType(type);

    try {
      const endpoint = type === 'training' ? '/ai/training-analysis' : '/ai/diet-recommendation';
      const res = await apiClient.post(endpoint);
      const result = type === 'training' ? res.data.analysis : res.data.recommendation;
      setAnalysisResult(result);
    } catch (err: any) {
      if (err.response?.status === 502) {
        setError('AI service is currently unavailable. Make sure your DeepSeek API key is configured correctly in the server .env file.');
      } else {
        setError(err.response?.data?.error || 'Failed to get AI analysis. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const loadHistory = async () => {
    try {
      const res = await apiClient.get('/ai/history');
      setHistory(res.data.analyses);
      setShowHistory(true);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load history');
    }
  };

  const getTypeLabel = (type: string) => type === 'training' ? '🏋️ Training' : '🥗 Diet';

  return (
    <div className="ai-page">
      <div className="page-header">
        <h1>AI Coach</h1>
        <button className="btn btn-outline" onClick={loadHistory}>
          History
        </button>
      </div>

      <p className="text-muted">
        Get personalized, AI-powered analysis of your training data and diet patterns.
        The more data you log, the better the recommendations!
      </p>

      {/* Action Buttons */}
      <div className="ai-actions">
        <div className="ai-action-card" onClick={() => !loading && handleAnalysis('training')}>
          <div className="ai-action-icon">🏋️</div>
          <h3>Training Analysis</h3>
          <p className="text-muted">
            Analyze your training frequency, volume, muscle balance, and get a personalized weekly plan.
          </p>
          <button className="btn btn-primary" disabled={loading}>
            {loading && analysisType === 'training' ? 'Analyzing...' : 'Analyze My Training'}
          </button>
        </div>

        <div className="ai-action-card" onClick={() => !loading && handleAnalysis('diet')}>
          <div className="ai-action-icon">🥗</div>
          <h3>Diet Recommendations</h3>
          <p className="text-muted">
            Get a detailed diet assessment with macro analysis and a 3-day meal plan tailored to your goal.
          </p>
          <button className="btn btn-primary" disabled={loading}>
            {loading && analysisType === 'diet' ? 'Generating...' : 'Get Diet Plan'}
          </button>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="ai-loading">
          <div className="spinner" />
          <p>
            {analysisType === 'training'
              ? 'Analyzing your training data with AI...'
              : 'Creating personalized diet recommendations...'}
          </p>
          <p className="text-muted">This may take 10-30 seconds</p>
        </div>
      )}

      {/* Error */}
      {error && <div className="alert alert-error">{error}</div>}

      {/* Result */}
      {analysisResult && (
        <div className="ai-result">
          <h2>{analysisType === 'training' ? '🏋️ Training Analysis' : '🥗 Diet Recommendations'}</h2>
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
              <h2>Analysis History</h2>
              <button className="btn-close" onClick={() => setShowHistory(false)}>✕</button>
            </div>
            <div className="modal-body">
              {history.length === 0 ? (
                <p className="text-muted">No analyses yet. Generate your first one!</p>
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
