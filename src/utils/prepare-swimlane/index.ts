import {
  AppData,
  HandlerServiceSettings,
  getHandlerServicePackageJsonContentByModuleData,
} from '@ldsg/common';
import { generateByAppData, getAppData } from '@ldsg/utils';
import fs from 'fs-extra';
import _ from 'lodash';
import path from 'node:path';
import shell from 'shelljs';
import { swimlaneEmitter } from '../event-emitter.js';
import { getHandlerIdsByServiceRecords } from './utils/get-handler-ids-by-service-records.js';
import { startSwimlane } from './utils/start-swimlane.js';

enum SwimlaneLoadStatus {
  UNLOAD,
  LOADING,
  LOADED,
}

interface PrepareSwimlaneMapValue {
  status: SwimlaneLoadStatus;
  appData?: AppData;
}

const prepareSwimlaneMap = new Map<string, PrepareSwimlaneMapValue>();

interface PrepareSwimlaneParams {
  runtimeRootPath: string;
  swimlaneName: string;
  port: number;
  lgsgAppDataUrl: string;
  reload: boolean;
}

export const prepareSwimlane = async (params: PrepareSwimlaneParams) => {
  const { runtimeRootPath, swimlaneName, port, lgsgAppDataUrl, reload } =
    params;

  const extraAppDataPath = path.join(runtimeRootPath, 'data', 'template.json');

  const currentSwimlaneRootPath = path.join(
    runtimeRootPath,
    'swimlanes',
    swimlaneName,
  );

  if (!prepareSwimlaneMap.has(swimlaneName)) {
    prepareSwimlaneMap.set(swimlaneName, {
      status: SwimlaneLoadStatus.UNLOAD,
    });
  }

  const prepareSwimlaneMapValue = prepareSwimlaneMap.get(swimlaneName);

  const { status, appData: prevAppData } = prepareSwimlaneMapValue;

  const swimlaneLoadedEventName = `swimlane:${swimlaneName}:loaded`;

  const tagLoadingStatus = () => {
    prepareSwimlaneMap.set(swimlaneName, {
      status: SwimlaneLoadStatus.LOADING,
    });
  };

  interface TagLoadedStatusParams {
    appData: AppData;
  }

  type TagLoadedStatus = (params: TagLoadedStatusParams) => void;

  const tagLoadedStatus: TagLoadedStatus = (params) => {
    const { appData } = params;

    prepareSwimlaneMap.set(swimlaneName, {
      status: SwimlaneLoadStatus.LOADED,
      appData,
    });

    swimlaneEmitter.emit(swimlaneLoadedEventName);
  };

  switch (status) {
    case SwimlaneLoadStatus.UNLOAD: {
      tagLoadingStatus();

      console.info('load start');

      const appData = await getAppData({
        lgsgAppDataUrl,
        extraAppDataPath,
      });

      await generateByAppData({ appData, outputPath: currentSwimlaneRootPath });

      await new Promise<void>((resolve, reject) => {
        const child = shell
          .cd(currentSwimlaneRootPath)
          .exec(
            'pnpm i && pnpm i --workspace-root ./handlers/* && pnpm build',
            {
              async: true,
            },
          );

        child.stdout.on('end', (data) => {
          resolve(data);
        });

        child.stdout.on('error', (error) => {
          reject(error);
        });
      });

      await startSwimlane({
        name: swimlaneName,
        port,
        projectRootPath: currentSwimlaneRootPath,
      });

      console.info('load end');

      tagLoadedStatus({
        appData,
      });

      break;
    }

    case SwimlaneLoadStatus.LOADING: {
      console.info('wait load');

      await new Promise<void>((resolve) => {
        swimlaneEmitter.on(swimlaneLoadedEventName, () => {
          resolve();
        });
      });

      console.info('waited until the loading is complete');

      break;
    }

    case SwimlaneLoadStatus.LOADED: {
      if (!prevAppData) {
        throw new Error();
      }

      if (reload) {
        tagLoadingStatus();

        const appData = await getAppData({
          lgsgAppDataUrl,
          extraAppDataPath,
        });

        const { environmentVariables, serviceRecords: nextServiceRecords } =
          appData;

        // replace .env
        {
          const envFilePath = path.join(currentSwimlaneRootPath, '.env');

          await fs.writeFile(
            envFilePath,
            _.toPairs(environmentVariables)
              .map((value) => value.join('='))
              .join('\n'),
          );
        }

        // replace serviceRecords.json
        await fs.writeFile(
          path.join(currentSwimlaneRootPath, 'service-records.json'),
          JSON.stringify(nextServiceRecords),
        );

        // replace handler and rebuild
        {
          const { serviceRecords: prevServiceRecords } = prevAppData;

          const { handlerIds: prevHandlerIds } = getHandlerIdsByServiceRecords({
            serviceRecords: prevServiceRecords,
          });

          const { handlerIds: nextHandlerIds } = getHandlerIdsByServiceRecords({
            serviceRecords: nextServiceRecords,
          });

          const diffHandlerIds = nextHandlerIds.filter((value) => {
            return !prevHandlerIds.includes(value);
          });

          // update handler by id
          {
            const promises = diffHandlerIds.map(async (handlerId) => {
              const serviceRecord = nextServiceRecords.find(
                (value) => value.id === handlerId,
              );

              const handlerServiceSettings = _.get(
                serviceRecord,
                'settings',
              ) as HandlerServiceSettings;

              const { moduleId, moduleData } = handlerServiceSettings;

              const { code } = moduleData;

              await fs.writeFile(
                path.join(
                  currentSwimlaneRootPath,
                  'handlers',
                  handlerId,
                  'src',
                  'index.ts',
                ),
                code,
              );

              const templateJson = await fs.readJson(
                path.join(currentSwimlaneRootPath, 'data', 'template.json'),
              );

              const { reuseMainAppDependencies } = templateJson;

              const { content } =
                getHandlerServicePackageJsonContentByModuleData({
                  moduleData,
                  moduleName: moduleId,
                  reuseMainAppDependencies,
                });

              await fs.writeFile(
                path.join(
                  currentSwimlaneRootPath,
                  'handlers',
                  handlerId,
                  'package.json',
                ),
                JSON.stringify(content),
              );
            });

            await Promise.all(promises);
          }

          // rebuild
          if (diffHandlerIds.length) {
            await new Promise<void>((resolve, reject) => {
              const child = shell
                .cd(currentSwimlaneRootPath)
                .exec(
                  `pnpm ${diffHandlerIds
                    .map((value) => `--filter ${value}`)
                    .join(' ')} build`,
                  {
                    async: true,
                  },
                );

              child.stdout.on('end', (data) => {
                resolve(data);
              });

              child.stdout.on('error', (error) => {
                reject(error);
              });
            });
          }
        }

        // pm2 restart
        await startSwimlane({
          name: swimlaneName,
          port,
          projectRootPath: currentSwimlaneRootPath,
        });

        tagLoadedStatus({
          appData,
        });
      }

      break;
    }

    default: {
      break;
    }
  }
};
