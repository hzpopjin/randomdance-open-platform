import request from '../utils/request';
import type { ApiResponse } from '../types/api';
import type { RoadshowPositionBoard } from '../types/roadshow';

/** 获取用户选位面板（本人可读）。 */
export function getRoadshowPositions(registrationId: number) {
  return request.get<ApiResponse<RoadshowPositionBoard>>(
    `/roadshow/registrations/${registrationId}/positions`,
  );
}

/** 抢位：锁定指定位次。 */
export function selectRoadshowPosition(registrationId: number, positionId: number) {
  return request.put<ApiResponse<{ selected: boolean; position_id: number }>>(
    `/roadshow/registrations/${registrationId}/position`,
    { position_id: positionId },
  );
}

/** 取消选位：释放当前已锁定的位次（幂等）。 */
export function cancelRoadshowPosition(registrationId: number) {
  return request.delete<ApiResponse<{ cancelled: boolean; position_id: number | null }>>(
    `/roadshow/registrations/${registrationId}/position`,
    { data: {} },
  );
}
