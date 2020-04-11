import cluster from 'cluster'
import os from 'os'
import fs from 'fs'

import { Logger, noopLogger } from 'typescript-log'
import { WorkerMap, getWorkerName } from './worker-map'

const cpuCount = os.cpus().length
const fiveMinutesMS = 5 * 60 * 1000

const DEFAULT_OPTIONS = {
    workers: cpuCount,
    lifetime: 'until-killed' as 'until-killed',
    grace: 5000,
    masterArgsWait: 5000,
}

interface GetArgsMessage {
    type: 'get-args'
    workerId: number
}

interface GetArgsResponseMessage<MasterArgs> {
    type: 'get-args-response'
    masterArgs: MasterArgs | undefined
}

type MasterMessages<MasterArgs> = GetArgsResponseMessage<MasterArgs>
type WorkerMessages = GetArgsMessage

export interface Options<MasterArgs> {
    /** Number of workers (default cpu count), if 0, starts in process. Defaults to # of cpu cores */
    workers: number
    /** ms to keep cluster alive (until-killed) */
    lifetime: number | 'until-killed'
    /** ms grace period after worker SIGTERM (default 5000) */
    grace: number
    /** Logger */
    logger?: Logger
    /** Return a promise if there is startup work before workers are started */
    master?: () => Promise<MasterArgs> | void
    /**
     * Return a promise if there is startup work before worker is considered started
     *
     * @argument masterArgs if master returns a promise this will be the resolved value
     */
    start?: (args: { id: string; masterArgs: MasterArgs | undefined }) => Promise<any> | void

    dedicatedWorkers?: {
        [name: string]: (args: {
            id: string
            masterArgs: MasterArgs | undefined
        }) => Promise<any> | void
    }
    /** ms to wait for master to become available to supply masterArgs (default 5000) */
    masterArgsWait?: number
}

let called = false

const workerMap: WorkerMap = {}

/**
 * Resolves when the current start function (master or start depending on context) has
 * finished initialising.
 * @param startOrOptions
 */
export async function gru<MasterArgs = undefined>(
    startOrOptions:
        | (Partial<Options<MasterArgs>> & { start: Options<MasterArgs>['start'] })
        | (() => void),
) {
    let masterArgs: MasterArgs | undefined

    if (called) {
        throw new Error('Can only be called once')
    }
    called = true

    const options: Options<MasterArgs> =
        typeof startOrOptions === 'function'
            ? {
                ...DEFAULT_OPTIONS,
                start: startOrOptions,
            }
            : {
                ...DEFAULT_OPTIONS,
                ...deleteUndefinedKeys(startOrOptions),
            }

    const logger = options.logger || noopLogger()

    if (typeof options.start !== 'function') {
        throw new Error('Start function required')
    }

    if (cluster.isWorker) {
        const masterArgsInWorker = await getMasterArgsInWorker()

        let workerStart: null | void | Promise<any> = null

        // Is this worker a dedicated worker?
        // if dedicated, get the dedicated worker name then call the start function with that name
        if (options.dedicatedWorkers) {
            const workerName = process.env.GRU_DEDICATED_WORKER_NAME
            if (workerName) {
                logger.debug({ workerName }, `Calling start function for dedicated worker`)
                workerStart = options.dedicatedWorkers[workerName]({
                    id: cluster.worker.id.toString(),
                    masterArgs: masterArgsInWorker,
                })
            }
        }

        if (workerStart === null) {
            workerStart = options.start({
                id: cluster.worker.id.toString(),
                masterArgs: masterArgsInWorker,
            })
        }

        // If the worker start function returns a promise
        // handle errors and shutdown gracefully
        if (workerStart) {
            workerStart.catch((err) => {
                logger.error(
                    { err },
                    `Worker ${cluster.worker.id} failed to start, shutting down worker`,
                )
                cluster.worker.kill()
            })
        }
        return
    }

    // Only the master will get to this point, a worker would have returned
    let running = true
    const runUntil =
        options.lifetime === 'until-killed' ? options.lifetime : Date.now() + options.lifetime
    listen()
    if (options.master) {
        try {
            const masterInitialisation = options.master()

            if (masterInitialisation) {
                try {
                    const masterResult = await masterInitialisation
                    if (masterResult) {
                        masterArgs = masterResult
                    }
                } catch (err) {
                    // eslint-disable-next-line no-console
                    console.error(err)
                    logger.error({ err }, 'Master failed to start')
                    shutdown()
                    return
                }
            }
        } catch (err) {
            // eslint-disable-next-line no-console
            console.error(err)
            logger.error({ err }, 'Master failed to start')
            shutdown()
            return
        }
    }

    if (options.dedicatedWorkers && Object.keys(options.dedicatedWorkers).length > 0) {
        resizeDedicatedWorkers()
        setInterval(resizeDedicatedWorkers, fiveMinutesMS).unref()
    }

    // If # of workers is set to 0, no generic workers will be started
    // And just run worker start function in master process
    if (options.workers === 0) {
        const workerStart = options.start({ id: 'master', masterArgs })

        if (workerStart) {
            workerStart.catch((err) => {
                logger.error({ err }, `Inline worker failed to start, exiting`)
                process.exit(1)
            })
        }
    } else {
        resizeGenericWorkers()
        setInterval(resizeGenericWorkers, fiveMinutesMS).unref()
    }

    function listen() {
        cluster.on('exit', workerExited)
        process.on('SIGINT', shutdown).on('SIGTERM', shutdown)
    }

    function resizeGenericWorkers() {
        const totalWorkerCount: number = Object.keys(cluster.workers).length
        const dedicatedWorkerCount: number = Object.keys(workerMap).length
        const genericWorkerCount: number = totalWorkerCount - dedicatedWorkerCount

        const moreWorkersRequired: number = options.workers - genericWorkerCount
        if (moreWorkersRequired > 0) {
            logger.info(`Starting ${moreWorkersRequired} workers`)
            for (let i = 0; i < moreWorkersRequired; i++) {
                startWorker()
            }
        } else {
            // TODO: remove excess workers
        }
    }
    function resizeDedicatedWorkers() {
        if (!options.dedicatedWorkers || Object.keys(options.dedicatedWorkers).length === 0) {
            return
        }

        Object.keys(options.dedicatedWorkers).map((workerName) => {
            if (workerMap[workerName]) {
                logger.debug({ workerName }, `dedicated worker already exists`)
                return
            }
            startWorker(workerName)
        })
    }

    function startWorker(workerName?: string) {
        // load environment from config file and add PATH
        const config = process.env.CONFIG_FILE
            ? JSON.parse(fs.readFileSync(process.env.CONFIG_FILE || '').toString())
            : {}
        const env = { ...process.env, ...config }

        // launch new worker
        const worker = cluster.fork({ GRU_DEDICATED_WORKER_NAME: workerName, ...env }).on('message', workerMessage)

        if (workerName) {
            // Required so master can keep traffic of the dedicated workers
            workerMap[workerName] = worker.id
        }
    }

    function workerMessage(msg: WorkerMessages) {
        if (msg.type === 'get-args') {
            const worker = cluster.workers[msg.workerId]
            if (!worker) {
                return
            }

            const responseMsg: GetArgsResponseMessage<MasterArgs> = {
                type: 'get-args-response',
                masterArgs
            }
            worker.send(responseMsg)
        }
    }

    function shutdown() {
        running = false

        process.removeListener('SIGINT', shutdown)
        process.removeListener('SIGTERM', shutdown)

        // tslint:disable-next-line:forin
        for (const id in cluster.workers) {
            const worker = cluster.workers[id]
            if (worker) {
                worker.process.kill()
            }
        }
        setTimeout(forceKill, options.grace).unref()
    }

    function workerExited(worker: cluster.Worker, code: number, signal: string) {
        worker.removeListener('message', workerMessage)

        const workerName = getWorkerName(worker.id, workerMap)
        if (workerName) {
            logger.debug({ workerName }, `Worker exited`)
            delete workerMap[workerName]
        }

        if (!running || worker.exitedAfterDisconnect) {
            return
        }
        if (runUntil === 'until-killed' || Date.now() < runUntil) {
            logger.warn(`worker ${worker.process.pid} died (${signal || code}). restarting...`)

            // Start new worker(s) to replace exited
            resizeGenericWorkers()
            resizeDedicatedWorkers()
        }
    }

    function forceKill() {
        // tslint:disable-next-line:forin
        for (const id in cluster.workers) {
            const worker = cluster.workers[id]
            if (worker) {
                worker.kill()
            }
        }

        logger.info(
            'Node did not exit gracefully, here is the current event loop which is preventing exit. Forcing exit.',
        )
        process.exit()
    }

    function getMasterArgsInWorker() {
        return new Promise<MasterArgs | undefined>((resolve) => {
            if (process.send) {
                // And a 5 second timeout
                const timeoutId = setTimeout(() => {
                    logger.warn(
                        'No response from master process for master arguments before timeout',
                    )
                    resolve(undefined)
                }, options.masterArgsWait)

                // Setup response handler
                process.once('message', (masterMsg: MasterMessages<MasterArgs>) => {
                    clearTimeout(timeoutId)
                    resolve(masterMsg.masterArgs)
                })

                // Then send a message to master to get the arguments
                const msg: GetArgsMessage = {
                    type: 'get-args',
                    workerId: cluster.worker.id,
                }
                process.send(msg)
            } else {
                logger.warn("process.send undefined, can't send response to worker")
                resolve(undefined)
            }
        })
    }
}

function deleteUndefinedKeys<T extends object>(obj: T): T {
    Object.keys(obj).forEach((key) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if ((obj as any)[key] === undefined) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            delete (obj as any)[key]
        }
    })

    return obj
}