export type WorkerMap = { [workerName: string]: number }

export function getWorkerName(workerId: number, workerMap: WorkerMap): string | null {
  const workerNames = Object.keys(workerMap)

  for (let i = 0; i < workerNames.length; i++) {
    if (workerMap[workerNames[i]] === workerId) {
      return workerNames[i]
    }
  }

  return null
}