import dotenv from 'dotenv';
import fs from 'fs-extra';
import path from 'node:path';
import pm2 from 'pm2';
import { swimlaneProcessReadyEmitter } from '../../event-emitter.js';

interface StartSwimlaneParams {
  name: string;
  port: number;
  projectRootPath: string;
}

export const startSwimlane = async (params: StartSwimlaneParams) => {
  const { name, port, projectRootPath } = params;

  const envFilePath = path.join(projectRootPath, '.env');

  let env: Record<string, string> = {};

  if (fs.exists(envFilePath)) {
    const envFileContent = await fs.readFile(envFilePath);

    env = dotenv.parse(envFileContent);
  }

  await new Promise<pm2.Proc>((resolve, reject) => {
    pm2.start(
      {
        script: path.join(projectRootPath, 'dist', 'index.js'),
        name,
        env: {
          ...env,
          PORT: String(port),
        },
      },
      (err, apps) => {
        if (err) {
          reject(err);
        }

        resolve(apps);
      },
    );
  });

  await new Promise<void>((resolve) => {
    swimlaneProcessReadyEmitter.on('swimlane:ready', (data) => {
      if (data.process.name === name) {
        resolve();
      }
    });
  });
};
