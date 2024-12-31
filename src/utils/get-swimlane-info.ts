import { Request, Response } from 'express';
import getPort from 'get-port';
import { prepareSwimlane } from './prepare-swimlane/index.js';

const DEFAULT_SWIMLANE = 'main';

interface SwimlaneInfo {
  port: number;
  lgsgAppDataUrl: string;
}

const swimlaneMap = new Map<string, SwimlaneInfo>();

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
      res.json({
        ready: 'ok',
        lgsgAppDataUrlStatus: 'none',
      });
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
