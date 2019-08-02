import cluster from 'cluster'
import os from 'os'
import fs from 'fs'

import { Logger, noopLogger } from 'typescript-log'

const cpuCount = os.cpus().length

const DEFAULT_OPTIONS = {
    workers: cpuCount,
    lifetime: 'until-killed' as 'until-killed',
    grace: 5000,
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    start: (args: { id: string; masterArgs: MasterArgs | undefined }) => Promise<any> | void
}

let called = false

/**
 * Resolves when the current start function (master or start depending on context) has
 * finished initialising.
 * @param startOrOptions
 */
export async function gru<MasterArgs = undefined>(
    startOrOptions:
        | Partial<Options<MasterArgs>> & { start: Options<MasterArgs>['start'] }
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
        const workerStart = options.start({
            id: cluster.worker.id.toString(),
            masterArgs: masterArgsInWorker,
        })

        // If the worker start function returns a promise
        // handle errors and shutdown gracefully
        if (workerStart) {
            workerStart.catch(err => {
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

    // If # of workers is set to 0, no workers will be started
    // And just run worker start function in master process
    if (options.workers === 0) {
        const workerStart = options.start({ id: 'master', masterArgs })

        if (workerStart) {
            workerStart.catch(err => {
                logger.error({ err }, `Inline worker failed to start, exiting`)
                process.exit(1)
            })
        }
    } else {
        resizeInterval()
    }

    function resizeInterval() {
        setTimeout(resizeInterval, 5 * 60 * 1000 /* 5 mins */).unref()
        resize()
    }

    function listen() {
        cluster.on('exit', workerExited)
        process.on('SIGINT', shutdown).on('SIGTERM', shutdown)
    }

    function resize() {
        const workerCount: number = Object.keys(cluster.workers).length
        const moreWorkersRequired: number = options.workers - workerCount

        if (moreWorkersRequired > 0) {
            logger.info(`Starting ${moreWorkersRequired} workers`)
            for (let i = 0; i < moreWorkersRequired; i++) {
                startWorker()
            }
        } else {
            // TODO: remove excess workers
        }
    }

    function startWorker() {
        // load environment from config file and add PATH
        const config = process.env.CONFIG_FILE
            ? JSON.parse(fs.readFileSync(process.env.CONFIG_FILE || '').toString())
            : {}
        const env = { ...process.env, ...config }

        // launch new worker
        cluster.fork(env).on('message', workerMessage)
    }

    function workerMessage(msg: WorkerMessages) {
        if (msg.type === 'get-args') {
            const worker = cluster.workers[msg.workerId]
            if (!worker) {
                return
            }

            const responseMsg: GetArgsResponseMessage<MasterArgs> = {
                type: 'get-args-response',
                masterArgs,
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

        if (!running || worker.exitedAfterDisconnect) {
            return
        }
        if (runUntil === 'until-killed' || Date.now() < runUntil) {
            logger.warn(`worker ${worker.process.pid} died (${signal || code}). restarting...`)

            // Start a new worker(s) to replace exited
            resize()
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
        return new Promise<MasterArgs | undefined>(resolve => {
            if (process.send) {
                // And a 5 second timeout
                const timeoutId = setTimeout(() => {
                    logger.warn(
                        'No response from master process for master arguments before timeout',
                    )
                    resolve(undefined)
                }, 5000)

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
    Object.keys(obj).forEach(key => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if ((obj as any)[key] === undefined) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            delete (obj as any)[key]
        }
    })

    return obj
}
