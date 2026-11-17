import { createContext } from 'react';

/* errors: {"items.0.github": "Must be an https:// URL"}; assets: uploaded files; reloadAssets() */
export const EditorCtx = createContext({ errors: {}, assets: [], reloadAssets: async () => {} });
