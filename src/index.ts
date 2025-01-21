import cors from 'cors';
import type { Request, Response } from 'express';
import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { RUNTIME_SWIMLANE, swimlaneMap } from './constants.js';
import { getSwimlaneInfo } from './utils/get-swimlane-info.js';
import { initProcessManager } from './utils/init-process-manager.js';

const runtimeRootPath = process.cwd();

const main = async () => {
  await initProcessManager();

  const app = express();

  app.use(cors());

  app.use(async (req, res, next) => {
    const runtime = {
      status: 'ok',
      version: process.env.VERSION,
    };

    try {
      const swimlaneName = req.get('X-Swimlane');

      if (swimlaneName === RUNTIME_SWIMLANE) {
        res.json({
          runtime,
          swimlanes: Object.fromEntries(swimlaneMap),
        });
      } else {
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
      }
    } catch (error) {
      res.json({
        runtime,
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
