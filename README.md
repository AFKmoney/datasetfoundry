# Dataset Architect

Dataset Architect is a powerful, client-side web application designed to help you aggregate, categorize, and prepare complex datasets for AI training, data analysis, or general file management. Run entirely in the browser, it ensures your data remains private and secure.

## Features

- **Multi-Source Ingestion:** Drag and drop individual files, upload archives (`.zip`, `.tar`, `.gz`), or fetch entire GitHub repositories directly by pasting a URL.
- **Auto-Categorization System:** The app automatically sorts imported files into relevant categories (e.g., Code, Data, Documents, Images) based on their extension and type.
- **Virtual File System (VFS):** Navigate your dataset through a clean, intuitive explorer interface.
- **Contextual Actions:** Right-click files in the explorer to download, clone, move between categories, or delete them.
- **Rich Previews:** Preview code, markdown, images, and other file types directly in the browser with syntax highlighting.
- **Dashboard & Statistics:** View comprehensive summary statistics of your dataset, including file counts, total storage usage, and a visual distribution chart powered by Recharts.
- **Advanced Export Pipeline:** Configure how your dataset is exported. Choose from multiple formats (`.jsonl`, `.md`, or raw files), apply file size limits, filter out binary files, and estimate token counts for LLM training.
- **Local Persistence:** Your dataset and configurations are automatically saved to your browser's local storage (via IndexedDB/LocalForage), so you won't lose your work if you refresh the page.

## Technologies Used

- **React & TypeScript:** For a robust, type-safe user interface.
- **Tailwind CSS & Framer Motion:** For modern, fluid styling and animations.
- **Recharts:** For dataset distribution visualization.
- **LocalForage:** For robust client-side storage architecture.
- **JSZip / unzlib:** For client-side archive extraction.
- **PrismJS:** For syntax-highlighted code previews.

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm run dev
   ```

3. Open `http://localhost:3000` in your browser.

## Privacy & Security

Dataset Architect processes all files locally within your browser. Files are not uploaded to any external server (unless you are explicitly fetching a remote GitHub repository, in which case the app makes a request to the repository URL).
