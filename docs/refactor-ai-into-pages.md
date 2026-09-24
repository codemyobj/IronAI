# 重构方案：将 AI 教练能力并入「训练」与「饮食」页面

> 目标：取消独立的「AI 教练」页面与导航入口，把「训练分析」与「饮食建议」两项 AI 能力分别下沉到「训练」页和「饮食」页，作为各页面顶部的 AI 洞察模块。
> 状态：方案稿（待评审，可按文末「可调整点」微调后进入实现）

---

## 1. 背景与现状

### 1.1 当前架构（重构前）

| 入口 | 路由 | 职责 |
|------|------|------|
| 导航 tab | `/dashboard` | 仪表盘汇总 |
| 导航 tab | `/training` | 训练计划 CRUD、训练记录、图表 |
| 导航 tab | `/diet` | 饮食记录、热量/宏量、图表 |
| **导航 tab** | **`/ai-analysis`** | **独立的 AI 教练页** |
| 导航 tab | `/profile` | 个人资料 |

独立的 AI 教练页（`client/src/pages/AIAnalysisPage.tsx`）内部有两张卡片：
- **训练分析** → `POST /api/ai/training-analysis` → 返回 Markdown 文本
- **饮食建议** → `POST /api/ai/diet-recommendation` → 返回 Markdown 文本
- 历史弹窗 → `GET /api/ai/history?type=training|diet`

后端 AI 接口（`server/src/controllers/aiController.ts` + `server/src/routes/ai.ts`）已经按 `training` / `diet` 类型拆分，逻辑独立、可原样复用。

### 1.2 痛点
- 用户要在「训练」页管数据，再跳到「AI 教练」页看分析，割裂、路径深。
- AI 能力被「孤立成一个频道」，与业务数据分离，使用率低。
- 导航 5 个 tab 偏拥挤。

### 1.3 依赖关系（已核实，删除零风险）
- `AIAnalysisPage` 仅被 `App.tsx` 引用，全仓库无其它引用。
- 无 `AIAnalysisPage.test.tsx` 测试文件。
- 类型 `AIAnalysis` 定义在 `client/src/types/index.ts:64`，继续复用。

---

## 2. 目标架构（重构后）

```
导航（4 个 tab）：首页 / 训练 / 饮食 / 我的
                         │
        ┌────────────────┴────────────────┐
        ▼                                  ▼
   /training 页                      /diet 页
   ├─ [AI 训练分析卡片]               ├─ [AI 饮食建议卡片]
   │   · 进页自动展示最近一次分析        │   · 进页自动展示最近一次建议
   │   · 「重新分析」按钮               │   · 「获取饮食计划」按钮
   │   · 可展开历史列表                 │   · 可展开历史列表
   ├─ 训练计划 CRUD                    ├─ 饮食记录 CRUD
   ├─ 训练记录 / 图表                  ├─ 热量 / 宏量 / 图表
   └─ ...                             └─ ...
```

后端 **不改动**（接口已经按类型拆分）。前端去掉独立页面，新增一个可复用的 AI 面板组件，分别挂到两个页面顶部。

---

## 3. 详细改动清单

### 3.1 删除独立 AI 教练页
- **删除** `client/src/pages/AIAnalysisPage.tsx`
- **改** `client/src/App.tsx`
  - 移除 `import AIAnalysisPage`
  - 移除路由 `<Route path="/ai-analysis" element={<AIAnalysisPage />} />`
  - 移除对 `/ai-analysis` 的 `Navigate` 兜底（如有）

### 3.2 导航精简
- **改** `client/src/components/Navbar.tsx`
  - 删除指向 `/ai-analysis` 的 `NavLink` 及其 `TabIcon name="ai"` 用法
  - 导航从 5 tab → 4 tab（首页/训练/饮食/我的），布局为 flex 自动均分，无需改 CSS 栅格

### 3.3 新增可复用 Hook（核心逻辑）
- **新增** `client/src/hooks/useAIAnalysis.ts`

  把原 `AIAnalysisPage` 里的「触发分析 / 加载历史 / 渲染结果」逻辑抽成通用 hook，按 `type` 区分训练/饮食：

  ```ts
  type AnalysisType = 'training' | 'diet';

  export function useAIAnalysis(type: AnalysisType) {
    const [result, setResult] = useState('');          // 当前展示的 Markdown
    const [latest, setLatest] = useState<AIAnalysis | null>(null); // 最近一次
    const [history, setHistory] = useState<AIAnalysis[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [showHistory, setShowHistory] = useState(false);

    // 进页面自动拉取最近一条
    const loadLatest = useCallback(async () => {
      try {
        const res = await apiClient.get('/ai/history', { params: { type, limit: 1 } });
        const list = res.data.analyses as AIAnalysis[];
        if (list.length) { setLatest(list[0]); setResult(list[0].response_text); }
      } catch { /* 静默：无历史不是错误 */ }
    }, [type]);

    const run = useCallback(async () => {
      setLoading(true); setError(''); setResult('');
      try {
        const endpoint = type === 'training' ? '/ai/training-analysis' : '/ai/diet-recommendation';
        const lang = i18n.language?.split('-')[0] || 'en';
        const res = await apiClient.post(endpoint, { lang });
        const text = type === 'training' ? res.data.analysis : res.data.recommendation;
        setResult(text);
        setLatest({ id: 0, analysis_type: type, response_text: text, created_at: new Date().toISOString() });
      } catch (err: any) {
        setError(err.response?.status === 502 ? t('ai.serviceUnavailable') : (err.response?.data?.error || t('ai.analysisFailed')));
      } finally { setLoading(false); }
    }, [type]);

    const loadHistory = useCallback(async () => {
      try {
        const res = await apiClient.get('/ai/history', { params: { type } });
        setHistory(res.data.analyses); setShowHistory(true);
      } catch (err: any) { setError(err.response?.data?.error || t('ai.loadHistoryFailed')); }
    }, [type]);

    useEffect(() => { loadLatest(); }, [loadLatest]);

    return { result, latest, history, loading, error, showHistory, setShowHistory, run, loadHistory };
  }
  ```

  > 注：为保持 hook 纯净，`t` 与 `i18n` 建议在组件层传入，或在 hook 内用 `useTranslation()`（hook 已是 React 环境，可直接调用）。上面伪代码用 `t`/`i18n` 占位。

### 3.4 新增可复用 UI 组件
- **新增** `client/src/components/AICoachPanel.tsx`

  负责渲染「AI 洞察卡片」：标题 + 触发按钮 + 加载态 + 错误提示 + Markdown 结果 + 历史展开。两个页面直接 `<AICoachPanel type="training" />` / `<AICoachPanel type="diet" />` 即可。

  ```tsx
  import { useTranslation } from 'react-i18next';
  import ReactMarkdown from 'react-markdown';
  import { useAIAnalysis } from '../hooks/useAIAnalysis';

  export default function AICoachPanel({ type }: { type: 'training' | 'diet' }) {
    const { t } = useTranslation();
    const { result, loading, error, showHistory, setShowHistory, run, loadHistory, history } = useAIAnalysis(type);

    const title = type === 'training' ? t('ai.trainingResult') : t('ai.dietResult');
    const cta   = type === 'training' ? t('ai.analyzeTraining') : t('ai.getDietPlan');
    const ctaLoading = loading ? (type === 'training' ? t('ai.analyzing') : t('ai.generating')) : cta;

    return (
      <section className="ai-panel">
        <div className="ai-panel-header">
          <div>
            <h2>{title}</h2>
            <p className="text-muted">{type === 'training' ? t('ai.trainingDesc') : t('ai.dietDesc')}</p>
          </div>
          <button className="btn btn-outline btn-sm" onClick={loadHistory}>{t('ai.history')}</button>
        </div>

        <button className="btn btn-primary" onClick={run} disabled={loading}>
          {ctaLoading}
        </button>

        {loading && (<div className="ai-loading"><div className="spinner" /><p>{type==='training'?t('ai.analyzingTraining'):t('ai.analyzingDiet')}</p></div>)}
        {error && <div className="alert alert-error">{error}</div>}
        {result && !loading && (
          <div className="ai-result markdown-content"><ReactMarkdown>{result}</ReactMarkdown></div>
        )}

        {showHistory && (
          <div className="ai-history">
            {history.length === 0
              ? <p className="text-muted">{t('ai.noHistory')}</p>
              : history.map(h => (
                  <button key={h.id} className="ai-history-item" onClick={() => { setResult(h.response_text); setShowHistory(false); }}>
                    <span className="text-muted">{new Date(h.created_at).toLocaleString()}</span>
                    <span>{h.response_text.substring(0, 80)}…</span>
                  </button>
                ))}
          </div>
        )}
      </section>
    );
  }
  ```

### 3.5 挂入两个页面
- **改** `client/src/pages/TrainingPage.tsx`
  - `import AICoachPanel from '../components/AICoachPanel'`
  - 在 `<div className="training-page">` 内的**最顶部**（page-actions 之前）渲染 `<AICoachPanel type="training" />`
- **改** `client/src/pages/DietPage.tsx`
  - 同理，在 `<div className="diet-page">` 顶部渲染 `<AICoachPanel type="diet" />`

  > 两个页面原有的 `page-actions`、CRUD、图表、空状态逻辑**完全不动**，只在顶部插入 AI 模块，降低回归风险。

### 3.6 i18n 调整
- **改** `client/src/i18n/{zh,en,es}.json`
  - 删除 `nav.ai`（导航不再有 AI tab）
  - 复用现有 `ai.*` 全部 key（title/description/trainingAnalysis/dietRecommendations/history/...）
  - 可选新增少量页面内 section 文案，例如：
    - `training.aiSectionTitle`（默认可复用 `ai.trainingResult`）
    - `diet.aiSectionTitle`
    - `ai.viewHistory` / `ai.collapseHistory`
  - 若不加新 key，直接用现有 `ai.*` 即可，零新增。

### 3.7 样式（CSS）
- **改** `client/src/index.css`（或对应样式文件）
  - 新增 `.ai-panel` / `.ai-panel-header` / `.ai-history` / `.ai-history-item` 等类
  - 复用既有 `.ai-result`、`.markdown-content`、`.btn`、`.spinner`、`.alert`、`.text-muted`
  - 视觉上让 AI 卡片与现有页面风格一致（参考 `ui-ux-design.html` 的设计令牌，如圆角、阴影、主色 `#8b5cf6`）

---

## 4. 后端是否需要改动

**默认：不改动。** 三个接口已满足需求：
- `POST /api/ai/training-analysis`
- `POST /api/ai/diet-recommendation`
- `GET  /api/ai/history?type=training|diet`

**可选小优化（非必须，建议做）：**
- `getHistory` 当前 `take: 20` 写死，增加 `limit` 查询参数支持（前端「进页自动加载最近一条」传 `limit=1` 更省流量）。改动仅在 `aiController.ts` 第 250-276 行与 `routes/ai.ts`。
- 若担心重复生成，可加「同日内不重复生成」的轻量去重，但非首版必需。

---

## 5. 实施步骤（建议提交顺序 / PR 拆分）

1. **抽逻辑**：新增 `hooks/useAIAnalysis.ts` + `components/AICoachPanel.tsx`（纯新增，不破坏现有）。
2. **接页面**：`TrainingPage`、`DietPage` 顶部插入 `<AICoachPanel />`。
3. **拆导航**：删除 `AIAnalysisPage.tsx`、`App.tsx` 路由、Navbar 的 AI tab、i18n `nav.ai`。
4. **补样式**：`.ai-panel` 等样式，对齐设计令牌。
5. **自测 & 回归**：
   - 训练页能看到最近一次分析 + 重新分析可用；
   - 饮食页同理；
   - 导航只剩 4 个 tab，移动端布局正常；
   - 原有 CRUD / 图表 / 空状态不受影响；
   - `pnpm --filter client build` 通过，`oxlint` 无报错。
6. **（可选）后端 limit 参数**。

---

## 6. 风险与回滚

| 风险 | 评估 | 应对 |
|------|------|------|
| 删除 AI 页影响其它模块 | 低（已核实零引用） | 保留 git 历史，随时 `git revert` |
| 两页顶部插入 AI 模块挤压原有内容 | 低 | 模块样式独立、可折叠；首屏只显示卡片头部 |
| 进页面自动请求 history 增加一次接口调用 | 低 | `limit=1` 轻量；历史为空静默处理 |
| DeepSeek 不可用（502） | 中（原已存在） | 复用原错误提示文案，不影响页面其它功能 |

---

## 7. 可调整点（评审时确认）

1. **AI 模块呈现方式**（本方案默认「顶部洞察卡片，进页自动加载最近一次 + 可重新生成」）
   - 备选：完全手动触发（不自动加载）/ 默认折叠收起。
2. **历史记录**
   - 本方案默认「显示最新一条 + 可展开历史列表」。
   - 备选：只显示最新一条 / 完全移除历史。
3. **模块位置**：默认顶部；也可放在各页底部或作为独立可切换 Tab 内嵌。
4. **是否做后端 `limit` 参数**：默认建议做，但非阻塞。

---

## 8. 改动文件汇总

| 动作 | 文件 |
|------|------|
| 删除 | `client/src/pages/AIAnalysisPage.tsx` |
| 修改 | `client/src/App.tsx` |
| 修改 | `client/src/components/Navbar.tsx` |
| 新增 | `client/src/hooks/useAIAnalysis.ts` |
| 新增 | `client/src/components/AICoachPanel.tsx` |
| 修改 | `client/src/pages/TrainingPage.tsx` |
| 修改 | `client/src/pages/DietPage.tsx` |
| 修改 | `client/src/i18n/{zh,en,es}.json` |
| 修改 | `client/src/index.css`（样式） |
| 可选修改 | `server/src/controllers/aiController.ts`、`server/src/routes/ai.ts` |
