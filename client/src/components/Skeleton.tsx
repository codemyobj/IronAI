/* Skeleton loading screens — mimic actual page layout with shimmer animation */

export function DashboardSkeleton() {
  return (
    <div className="dashboard-page">
      <div className="page-header">
        <div>
          <div className="skeleton skeleton-title" />
          <div className="skeleton skeleton-subtitle" />
        </div>
      </div>

      <div className="sk-stats">
        <div className="sk-stat-card">
          <div>
            <div className="skeleton sk-stat-label" />
            <div className="skeleton sk-stat-value" />
          </div>
          <div className="skeleton sk-ring" />
        </div>
        <div className="sk-stat-card">
          <div>
            <div className="skeleton sk-stat-label" />
            <div className="skeleton sk-stat-value" />
          </div>
        </div>
        <div className="sk-stat-card">
          <div>
            <div className="skeleton sk-stat-label" />
            <div className="skeleton sk-stat-value" />
          </div>
        </div>
      </div>

      <div className="dashboard-sections">
        <div className="sk-section">
          <div className="skeleton sk-section-header" />
          <div className="sk-quick-actions">
            <div className="skeleton sk-action-card" />
            <div className="skeleton sk-action-card" />
            <div className="skeleton sk-action-card" />
            <div className="skeleton sk-action-card" />
          </div>
        </div>
        <div className="sk-section">
          <div className="skeleton sk-section-header" />
          <div style={{ padding: '0 20px 20px' }}>
            {[1, 2, 3].map(i => (
              <div key={i} className="sk-session-item">
                <div className="sk-session-info">
                  <div className="skeleton sk-session-name" />
                  <div className="skeleton sk-session-date" />
                </div>
                <div className="skeleton sk-session-meta" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function TrainingSkeleton() {
  return (
    <div className="training-page">
      <div className="page-header">
        <div>
          <div className="skeleton skeleton-title" />
          <div className="skeleton skeleton-subtitle" />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div className="skeleton" style={{ width: 120, height: 38, borderRadius: 999 }} />
          <div className="skeleton" style={{ width: 120, height: 38, borderRadius: 999 }} />
        </div>
      </div>

      <div className="sk-programs">
        {[1, 2, 3].map(i => (
          <div key={i} className="sk-program-card">
            <div className="skeleton" style={{ height: 18, width: '60%', marginBottom: 8 }} />
            <div className="skeleton" style={{ height: 14, width: '40%' }} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function DietSkeleton() {
  return (
    <div className="diet-page">
      <div className="page-header">
        <div>
          <div className="skeleton skeleton-title" />
          <div className="skeleton skeleton-subtitle" />
        </div>
      </div>

      <div className="skeleton sk-date-picker" />

      <div className="sk-macros">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="sk-macro-item">
            <div className="skeleton" style={{ height: 24, width: 60, marginBottom: 6 }} />
            <div className="skeleton" style={{ height: 12, width: 40 }} />
          </div>
        ))}
      </div>

      <div className="meals-container">
        {[1, 2].map(g => (
          <div key={g} className="sk-meal-group">
            <div className="skeleton sk-meal-title" />
            <div className="sk-meal-items">
              {[1, 2].map(i => (
                <div key={i} className="sk-meal-item">
                  <div className="sk-meal-info">
                    <div className="skeleton sk-meal-name" />
                    <div className="skeleton sk-meal-macros" />
                  </div>
                  <div className="skeleton sk-meal-cal" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
