import pm2 from 'pm2';
import { swimlaneProcessReadyEmitter } from './event-emitter.js';

export const initProcessManager = async () => {
  await new Promise<void>((resolve, reject) => {
    pm2.connect((err) => {
      if (err) {
        reject(err);
      }

      pm2.launchBus((err, bus) => {
        if (err) {
          pm2.disconnect();

          reject(err);
        }

        bus.on('swimlane:ready', (data: any) => {
          swimlaneProcessReadyEmitter.emit('swimlane:ready', data);
        });
      });

      resolve();
    });
  });

  const processDescriptionList = await new Promise<pm2.ProcessDescription[]>(
    (resolve, reject) => {
      pm2.list((err, processDescriptionList) => {
        if (err) {
          reject(err);
        }

        resolve(processDescriptionList);
      });
    },
  );

  const promiseList = processDescriptionList.map(async (value) => {
    await new Promise<void>((resolve, reject) => {
      pm2.delete(value.name, (err) => {
        if (err) {
          reject(err);
        }

        resolve();
      });
    });
  });

  await Promise.all(promiseList);
};
