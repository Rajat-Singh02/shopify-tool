export type VideoWorkerHealth = {
  ok: true;
  ffmpegRequired: true;
};

export function getVideoWorkerHealth(): VideoWorkerHealth {
  return {
    ok: true,
    ffmpegRequired: true,
  };
}
