import { getWorkerName, WorkerMap } from "./worker-map"

const testWorkMap: WorkerMap = { 'worker 1': 7, 'worker 2': 15 }

describe('getWorkerName()', () => {
  it('finds an existing workers name', async () => {
    const workerName = getWorkerName(7, testWorkMap)
    expect(workerName).toEqual('worker 1')
  })

  it('returns null for a non-existant worker name', async () => {
    const workerName = getWorkerName(4, testWorkMap)
    expect(workerName).toBeNull()
  })
})