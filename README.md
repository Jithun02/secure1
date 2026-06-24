# Secure Password Manager

A modern, secure, and feature-rich password manager built with React, TypeScript, and AES encryption. Manage your credentials safely with an intuitive UI, browser extension autofill, and full backup/recovery support.

---

## Live Demo

[https://jithun02.github.io/secure1](https://jithun02.github.io/secure1)

---

## Features

- AES-256 encrypted local password storage
- Master password authentication with secure session management
- Password generator with strength analysis
- Browser extension for autofill (Chrome / Chromium)
- Audit dashboard — detect weak, reused, and breached passwords
- Backup and recovery with encrypted export
- Dark/light theme support
- Fully responsive UI

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + TypeScript |
| Build Tool | Vite 6 |
| Styling | Tailwind CSS 4 |
| UI Components | Radix UI + shadcn/ui |
| Backend | Express.js (Node.js) |
| Charts | Recharts |
| Animation | Framer Motion |
| Routing | React Router v7 |

---

## Prerequisites

- **Node.js** v18 or higher — [Download](https://nodejs.org)
- **npm** v9 or higher (comes with Node.js)

---

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/Jithun02/secure1.git
cd secure1
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment

```bash
cp .env.example .env
```

Open `.env` and set your values (e.g. `SECRET_KEY`).

### 4. Run the project

**Frontend + Backend together (recommended):**

```bash
npm run dev:full
```

Then open [http://localhost:5173](http://localhost:5173) in your browser.

**Frontend only:**

```bash
npm run dev
```

**Backend only:**

```bash
npm run server
```

---

## Browser Extension

1. Open your browser and navigate to `chrome://extensions/`
2. Enable **Developer Mode** (top right toggle)
3. Click **Load Unpacked**
4. Select the `extension/` folder from this project

The extension will appear in your toolbar and enable autofill on supported login pages.

---

## Build for Production

```bash
npm run build
```

Output is generated in the `dist/` folder. Serve it with any static file host.

---

## Deploy to GitHub Pages

```bash
npm run deploy
```

This builds the project and pushes the `dist/` folder to the `gh-pages` branch automatically.

---

## Project Structure

```
secure1/
├── extension/          # Chrome browser extension
│   ├── background.js
│   ├── content.js
│   ├── popup.html
│   ├── popup.js
│   └── manifest.json
├── server/             # Express.js backend
│   └── index.cjs
├── src/
│   ├── app/
│   │   ├── components/ # Reusable UI components
│   │   ├── lib/        # Utilities (encryption, backup, etc.)
│   │   ├── screens/    # Page-level components
│   │   ├── App.tsx
│   │   └── routes.ts
│   └── main.tsx
├── .env.example        # Environment variable template
├── SETUP.txt           # Quick setup reference
├── package.json
├── vite.config.ts
└── index.html
```

---

## Security

- Passwords are encrypted with AES before being stored locally
- The master password is never stored in plain text
- Sessions are cleared on logout
- No passwords are transmitted to external servers

---

## License

MIT License. See `LICENSE` for details.

---

## Author

**Jithun**  
GitHub: [@Jithun02](https://github.com/Jithun02)
