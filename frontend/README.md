# FlowMind Frontend

React + Vite console for managing the FlowMind chatbot backend. Core capabilities:

- Full CRUD for bot projects (create, edit, delete) with language/threshold controls
- Intent hierarchy viewer plus follow-up aware CRUD (root + child intents)
- Per-language fallback editor with instant API updates
- Embedded chat tester for running real conversations against the selected project
- Render intent hierarchies in a collapsible tree that mirrors parent/follow-up relationships
- Surface project metadata (default language, confidence threshold) and intent details
- Auto-refresh data through React Query mutations

## Quickstart

```bash
cd frontend
npm install
npm run dev
```

The dev server runs at http://localhost:5173 and proxies `/api` requests to the FastAPI backend (http://localhost:8000).

Configure a custom backend origin by adding `VITE_API_BASE_URL` to `.env.local`:

```
VITE_API_BASE_URL=http://127.0.0.1:8000
```

## Key Files

- `src/hooks/useIntents.ts` – REST client, tree transform, mutations
- `src/components/IntentTree.tsx` – tree wrapper with selection state
- `src/components/IntentNode.tsx` – single node renderer with expand/collapse logic
- `src/components/ProjectFormModal.tsx` – create/update project modal
- `src/components/IntentFormModal.tsx` – create/update intent modal with training phrase/response editors + webhook fulfillment
- `src/components/FallbackFormModal.tsx` – edit fallback copy for supported languages
- `src/components/IntentFlowCanvas.tsx` – React Flow graph for visual editing
- `src/components/ChatTester.tsx` – chat widget for hitting `/projects/:id/chat`
- `src/components/ConfirmDialog.tsx` & `src/components/Modal.tsx` – shared overlay components
- `src/pages/IntentsPage.tsx` – layout, selectors, action toolbar, detail pane

The console targets the REST API (`/projects`, `/projects/:id/intents`, etc.). Adjust or extend the forms to add validation, translations, or richer response types as your flows evolve.
