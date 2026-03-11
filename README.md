# Mr. Si!ent — Creator Hub

Static YouTube channel hub deployable to GitHub Pages.

## Quick Start

1. Unzip the repository
2. Open `js/script.js` — the API key is already set:
   ```js
   var API_KEY = 'AIzaSyAEBSwFQQHGdg7EdKTWXaBvl6b6cOhFpXc';
   ```
3. Replace `assets/logo.png` with the real channel logo (512×512 PNG)

## Deploy to GitHub Pages

```bash
git init
git add .
git commit -m "Mr. Si!ent Creator Hub"
git remote add origin https://github.com/YOURUSERNAME/mr-silent-creator-hub.git
git push -u origin main
```
Then: **Settings → Pages → Source: main branch → / (root)**

## Restrict API Key (Important!)

In Google Cloud Console → APIs & Services → Credentials:
- HTTP referrers: `https://YOURUSERNAME.github.io/*`
- API restrictions: YouTube Data API v3

## Protections Included

- Right-click disabled
- DevTools detection (F12, Ctrl+Shift+I blocked)
- Keyboard shortcuts blocked (Ctrl+U, Ctrl+S, Ctrl+A, Ctrl+P)
- Copy intercept (pastes copyright notice instead)
- Debugger trap
- Domain lock (only runs on github.io / localhost)
- Anti-iframe embedding
- Console warning + override
