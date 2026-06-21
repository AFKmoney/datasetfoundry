# datasetfoundry

`datasetfoundry` is a browser-based application for building, organizing, and exporting datasets. It runs entirely client-side, so your files never leave your machine.

## Features

- **Multi-Source Ingestion:** Drag and drop files, upload archives (`.zip`, `.tar`, `.gz`), or fetch an entire GitHub repository by URL.
- **Auto-Categorization:** Automatically sorts files into groups such as Code, Data, Documents, and Images.
- **Token Counting:** Uses `gpt-tokenizer` to count BPE tokens for imported text files, making it easy to size a dataset.
- **Virtual File System (VFS):** Navigate and manipulate the dataset from a modern UI, with summary statistics for file weight, quantity, and token counts.
- **Advanced Export Pipeline:** Export in `.jsonl`, `.csv`, `.md`, or raw file formats. Apply token caps, chunking rules, stop-word removal, and more.
- **Local Persistence:** Data is stored in the browser via IndexedDB / LocalForage, so datasets reload between sessions.

## Tech Stack

- React + TypeScript
- Tailwind CSS & Framer Motion
- JSZip / libarchive.js (client-side archive handling)
- gpt-tokenizer (token counting)
- IndexedDB (LocalForage)

## Setup

```bash
npm install
npm run dev
```

Open `http://localhost:3000` to start using datasetfoundry.
