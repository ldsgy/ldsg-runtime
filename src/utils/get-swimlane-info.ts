import { Request, Response } from 'express';
import getPort from 'get-port';
import { DEFAULT_SWIMLANE, swimlaneMap } from 'src/constants.js';
import { prepareSwimlane } from './prepare-swimlane/index.js';

interface SwimlaneInfo {
  port: number;
  lgsgAppDataUrl: string;
}

interface GetSwimlaneInfoParams {
  runtimeRootPath: string;
  req: Request;
  res: Response;
}

type GetSwimlaneInfo = (params: GetSwimlaneInfoParams) => Promise<SwimlaneInfo>;

export const getSwimlaneInfo: GetSwimlaneInfo = async (params) => {
  const { runtimeRootPath, req, res } = params;

  const swimlaneName = req.get('X-Swimlane') || DEFAULT_SWIMLANE;

  const lgsgAppDataUrl = req.get('X-Lgsg-App-Data-Url');

  let swimlaneInfo: SwimlaneInfo;

  let reload = false;

  if (swimlaneMap.has(swimlaneName)) {
    swimlaneInfo = swimlaneMap.get(swimlaneName);

    if (swimlaneInfo.lgsgAppDataUrl !== lgsgAppDataUrl) {
      reload = true;

      swimlaneMap.set(swimlaneName, {
        ...swimlaneInfo,
        lgsgAppDataUrl,
      });
    }
  } else {
    const newSwimlanePort = await getPort();

    if (!lgsgAppDataUrl) {
      throw new Error('lgsg app data url is required');
    }

    swimlaneInfo = {
      port: newSwimlanePort,
      lgsgAppDataUrl,
    };

    swimlaneMap.set(swimlaneName, swimlaneInfo);
  }

  await prepareSwimlane({
    runtimeRootPath,
    ...swimlaneInfo,
    swimlaneName,
    reload,
  });

  return swimlaneInfo;
};
