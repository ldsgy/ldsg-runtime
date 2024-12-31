import { ServiceRecords } from '@ldsg/common';

interface GetHandlerIdsByServiceRecordsParams {
  serviceRecords: ServiceRecords;
}

interface GetHandlerIdsByServiceRecordsRes {
  handlerIds: string[];
}

type GetHandlerIdsByServiceRecords = (
  params: GetHandlerIdsByServiceRecordsParams,
) => GetHandlerIdsByServiceRecordsRes;

export const getHandlerIdsByServiceRecords: GetHandlerIdsByServiceRecords = (
  params,
) => {
  const { serviceRecords } = params;

  const filterRes = serviceRecords.filter((value) => {
    return value.type === 'HANDLER';
  });

  const handlerIds = filterRes.map((value) => value.id);

  const res: GetHandlerIdsByServiceRecordsRes = {
    handlerIds,
  };

  return res;
};
