import type { Request, Response } from 'express';
import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { getSwimlaneInfo, initProcessManager } from './utils/index.js';

const runtimeRootPath = process.cwd();

const main = async () => {
  const app = express();

  await initProcessManager();

  app.use(async (req, res, next) => {
    try {
      const swimlaneInfo = await getSwimlaneInfo({
        runtimeRootPath,
        req,
        res,
      });

      const { port } = swimlaneInfo;

      const proxyMiddleware = createProxyMiddleware<Request, Response>({
        target: {
          host: '127.0.0.1',
          port,
        },
        changeOrigin: false,
      });

      proxyMiddleware(req, res, next);
    } catch (error) {
      res.json({
        ready: 'ok',
        lgsgAppDataUrlStatus: 'fail',
      });
    }
  });

  const port = process.env.PORT || '3000';

  app.listen(port, () => {
    console.log(`App listening on http://localhost:${port}`);

    console.log(`GraphQL listening on http://localhost:${port}/graphql`);
  });
};

main();
