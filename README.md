# Dataset Architect

Dataset Architect is a comprehensive, browser-based web application tailored for building, categorizing, and exporting AI training datasets. It operates entirely client-side, ensuring full data privacy.

## Features

- **Multi-Source Ingestion:** Drag and drop files, upload archives (`.zip`, `.tar`, `.gz`), or fetch entire GitHub repositories by URL.
- **Auto-Categorization:** Automatically categorizes files into appropriate dataset groups like Code, Data, Documents, and Images.
- **LLM Token Estimation:** Utilizes `gpt-tokenizer` to accurately count BPE tokens for imported text files, making it easy to size up your dataset requirements for models like GPT-4, Llama, and Gemini.
- **Virtual File System (VFS):** Navigate and manipulate the dataset directly from a modern UI. Includes summary statistics panels for file weight, quantity, and token counts.
- **Advanced Export Pipeline:** Export ready-to-train files in `.jsonl`, `.csv`, `.md`, or raw files formats. Apply token caps, chunking rules, remove stop-words, and more.
- **Local Persistence:** Data is securely persisted in the browser via IndexedDB / LocalForage, meaning datasets seamlessly load between visits.

## Tech Stack Overview

- React + TypeScript
- Tailwind CSS & Framer Motion
- JSZip / libarchive.js (Client-Side Compression)
- gpt-tokenizer (Token Counting)
- IndexedDB (LocalForage)

## Setup

```bash
npm install
npm run dev
```
Open `http://localhost:3000` to start using Dataset Architect.
