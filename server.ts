import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json());

      // API routes FIRST
      app.post("/api/github-scrape", async (req, res) => {
        try {
          const { url } = req.body;
          // extract org or user from url
          const match = url.match(/github\.com\/([^\/]+)\/?$/);
          if (match) {
            const entity = match[1];
            let repoUrls = [];
            let r = await fetch(`https://api.github.com/users/${entity}/repos?per_page=100`);
            if (r.ok) {
               const repos = await r.json();
               repoUrls = repos.map((repo: any) => repo.html_url);
            } else {
               r = await fetch(`https://api.github.com/orgs/${entity}/repos?per_page=100`);
               if (r.ok) {
                  const repos = await r.json();
                  repoUrls = repos.map((repo: any) => repo.html_url);
               }
            }
            if (repoUrls.length > 0) {
              return res.json({ urls: repoUrls });
            } else {
              return res.status(404).json({ error: "No repositories found for this user/org" });
            }
          }
          return res.status(400).json({ error: "Could not parse GitHub user/org URL" });
        } catch (e: any) {
          res.status(500).json({ error: e.message });
        }
      });
    
      app.post("/api/github", async (req, res) => {
    try {
      const { url } = req.body;
      const match = url.match(/github\.com\/([^\/]+)\/([^\/]+)/);
      if (!match) {
        return res.status(400).json({ error: "Invalid GitHub URL" });
      }
      const owner = match[1];
      let repo = match[2];
      if (repo.endsWith('.git')) repo = repo.slice(0, -4);

      // Try main
      let response = await fetch(`https://github.com/${owner}/${repo}/archive/refs/heads/main.zip`);
      if (!response.ok) {
        response = await fetch(`https://github.com/${owner}/${repo}/archive/refs/heads/master.zip`);
      }
      if (!response.ok) {
        // Fallback to github api to get default branch
        const apiRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`);
        if (apiRes.ok) {
           const json = await apiRes.json();
           const defaultBranch = json.default_branch;
           response = await fetch(`https://github.com/${owner}/${repo}/archive/refs/heads/${defaultBranch}.zip`);
        }
      }

      if (!response.ok) {
         return res.status(404).json({ error: "Could not download repository archive." });
      }

      const buffer = await response.arrayBuffer();
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename=${repo}.zip`);
      res.send(Buffer.from(buffer));
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ error: e.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
