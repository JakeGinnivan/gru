import path from 'path'
import { fileURLToPath } from 'url'
import os from 'os'
import { spawn, SpawnOptions, ChildProcess } from 'child_process'
import { consoleLogger, Levels } from 'typescript-log'

const cpuCount = os.cpus().length
const __dirname = path.dirname(fileURLToPath(import.meta.url))

const getPath = (mod: string) => path.join(__dirname, 'fixtures', mod)
const testLogger = consoleLogger((process.env.LOG_LEVEL as Levels | undefined) || 'warn')

const throwsCmd = getPath('throws')
const exitCmd = getPath('exit')
const lifetimeCmd = getPath('lifetime')
const cpusCmd = getPath('cpus')
const masterCmd = getPath('master')
const asyncMasterCmd = getPath('async-master')
const asyncMasterArgumentsCmd = getPath('async-master-arguments')
const asyncMasterFailureCmd = getPath('async-master-fail')
const asyncMasterSyncFailureCmd = getPath('async-master-fail-sync')
const asyncWorkerFailureCmd = getPath('async-worker-fail')
const gracefulCmd = getPath('graceful')
// const reloadCmd = getPath('reload')
const killCmd = getPath('kill')
const infiniteCmd = getPath('infinite')
const inlineWorkerCmd = getPath('inline-worker')
const inlineWorkerFailCmd = getPath('inline-worker-fail')
const dedicatedWorkersCmd = getPath('dedicated-workers')
const dedicatedAndGenericWorkersCmd = getPath('dedicated-and-generic-workers')
const dedicatedAndInlineWorkerCmd = getPath('dedicated-and-inline-worker')

// Required to remove invisible characters from the output
// eg characters meant to colourize terminal output
function strictSanitize(input: string) {
    return input
        // eslint-disable-next-line no-control-regex
        .replace(/\x1B\[[0-9;]*m/g, '')  // Remove ANSI escape codes
        .replace(/[^a-zA-Z0-9,[]{}(): '\n]/g, '');  // Keep only desired characters;
}

describe('with no start function', () => {
    it('throws an error', async () => {
        const result = await run(throwsCmd, {})
        expect(result.stdout).toContain('Start function required')
    })
})

it('can run a worker inline', async () => {
    const result = await run(inlineWorkerCmd, {})
    expect(result.stdout).toBe(`master output
worker output
`)
})

it('can run dedicated workers', async () => {
    const result = await run(dedicatedWorkersCmd, {})

    // Dedicated worker start-up order is not guaranteed as inter-process communication is required
    expect(result.stdout).toContain('master output')
    expect(result.stdout).toContain('worker1 output')
    expect(result.stdout).toContain('worker2 output')
})

it('can run both dedicated and generic workers', async () => {
    const result = await run(dedicatedAndGenericWorkersCmd, {})

    expect(result.stdout).toContain('master output')
    expect(result.stdout).toContain('worker1 output')
    expect(result.stdout).toContain('worker2 output')

    const starts = result.stdout.match(/generic worker output$/gm)
    expect(starts).toHaveLength(3)
})

it('can run both dedicated and an inline worker', async () => {
    const result = await run(dedicatedAndInlineWorkerCmd, {})

    expect(result.stdout).toContain('master output')
    expect(result.stdout).toContain('worker1 output')
    expect(result.stdout).toContain('worker2 output')

    const starts = result.stdout.match(/inline generic worker output$/gm)
    expect(starts).toHaveLength(1)
})

it('exits when inline worker fails to start', async () => {
    const result = await run(inlineWorkerFailCmd, {})
    const output = strictSanitize(result.stdout.trim());
    expect(output).toBe(`master
worker
ERROR { err: 'oops' } Inline worker failed to start, exiting`)
})

describe('with a start function and 3 workers', () => {
    describe('with lifetime of 0', () => {
        it('starts 3 workers that immediately exit', async () => {
            const result = await run(exitCmd, {})
            const starts = result.stdout.match(/worker$/gm)

            expect(starts).toHaveLength(3)
        })
    })

    describe('with lifetime of 500ms', () => {
        it('starts 3 workers repeatedly', async () => {
            const result = await run(lifetimeCmd, {})
            const starts = result.stdout.match(/worker$/gm)

            expect(starts && starts.length).toBeGreaterThan(3)
        })

        it('keeps workers running for at least 500ms', async () => {
            const result = await run(lifetimeCmd, {})
            expect(result.endTime - result.startTime).toBeGreaterThan(500)
        })
    })

    describe('with no lifetime specified', () => {
        it('starts 3 workers repeatedly', async () => {
            const result = await run(infiniteCmd, {}, (child) =>
                setTimeout(() => {
                    child.kill()
                }, 2000)
            )

            const starts = result.stdout.match(/worker output$/gm)

            expect(starts && starts.length).toBeGreaterThan(3)
        })

        it('keeps workers running until killed externally', async () => {
            const result = await run(infiniteCmd, {}, (child) =>
                setTimeout(() => child.kill(), 1000),
            )

            expect(result.endTime - result.startTime - 1000).toBeLessThan(100)
        })
    })
})

describe('with no worker count specified', () => {
    it('starts one worker for each cpu', async () => {
        const result = await run(cpusCmd, {})

        const starts = result.stdout.match(/worker$/gm)

        expect(starts).toHaveLength(cpuCount)
    })
})

describe('with a master function and two workers', () => {
    it('starts one master', async () => {
        const result = await run(masterCmd, {})
        const master = result.stdout.match(/master/g)

        expect(master).toHaveLength(1)
    })

    it('starts two workers', async () => {
        const result = await run(masterCmd, {})
        const workers = result.stdout.match(/worker$/gm)

        expect(workers).toHaveLength(2)
    })
})

describe('signal handling', () => {
    describe('with 3 workers that exit gracefully', () => {
        it('starts 3 workers', async () => {
            const result = await run(gracefulCmd, {}, (child) =>
                setTimeout(() => {
                    child.kill()
                }, 1000),
            )
            const starts = result.stdout.match(/INFO worker output$/gm)

            expect(starts && starts.length).toBe(3)
        })

        it('allows the workers to shut down', async () => {
            const result = await run(gracefulCmd, {}, (child) =>
                setTimeout(() => {
                    child.kill()
                }, 1000),
            )
            const exits = result.stdout.match(/exiting/g)

            expect(exits && exits.length).toBeCloseTo(3)
        })
    })

    describe('with 3 workers that fail to exit', () => {
        it('starts 3 workers', async () => {
            const result = await run(killCmd, {}, (child) => setTimeout(() => child.kill(), 1000))
            const starts = result.stdout.match(/started worker/g)

            expect(starts).toHaveLength(3)
        })

        it('notifies the workers that they should exit', async () => {
            const result = await run(killCmd, {}, (child) => setTimeout(() => child.kill(), 400))
            const exits = result.stdout.match(/worker received sigterm/g)
            const forceKills = result.stdout.match(/worker killed after grace period/g)

            expect(exits).toHaveLength(3)
            expect(forceKills).toHaveLength(3)
        })

        it('kills the workers after 250ms grace', async () => {
            const result = await run(killCmd, {}, (child) => setTimeout(() => child.kill(), 750))
            expect(result.endTime - result.startTime - 1000).toBeLessThan(100)
        })
    })
})

describe('master initialisation', () => {
    it('waits until master has initialised before starting children', async () => {
        const result = await run(asyncMasterCmd, {})

        expect(result.stdout).toBe(`master
 INFO Starting 2 workers
worker
worker
`)
    })

    it('can pass initialisation value to workers', async () => {
        const result = await run(asyncMasterArgumentsCmd, {})

        const output = strictSanitize(result.stdout.trim());

        expect(output).toBe(strictSanitize(`master output
 INFO Starting 2 workers
worker received { test: 1, test2: [ 'val' ] }
worker received { test: 1, test2: [ 'val' ] }`))
    })

    it('exits process when master fails to initialise', async () => {
        const result = await run(asyncMasterFailureCmd, {})

        expect(result.stdout).toMatch('Master failed to start')
    })

    it('exits process when master fails to initialise synchronously', async () => {
        const result = await run(asyncMasterSyncFailureCmd, {})

        expect(result.stdout).toMatch('Master failed to start')
    })
})

describe('worker initialisation', () => {
    it('when worker fails to initialse, it is not restarted', async () => {
        const result = await run(asyncWorkerFailureCmd, {})
        const output = strictSanitize(result.stdout.trim());

        expect(output).toMatch(
            new RegExp(`master
 INFO Starting 2 workers
worker
worker
ERROR { err: 'Failed to start worker' } Worker \\d failed to start, shutting down worker
ERROR { err: 'Failed to start worker' } Worker \\d failed to start, shutting down worker`),
        )
    })
})

function run(file: string, options: SpawnOptions, spawned?: (child: ChildProcess) => void) {
    const childLogger = testLogger.child({ file })

    return new Promise<{ stdout: string; startTime: number; endTime: number }>((yea) => {
        const child = spawn('node', [file], options)

        let stdout = ''
        const startTime = Date.now()
        child.stdout?.on('data', (data) => {
            stdout += data.toString()
        })
        child.stderr?.on('data', (data) => {
            stdout += data.toString()
        })
        child.on('error', (data) => {
            childLogger.error({ data }, 'Child process error')
        })
        child.on('close', () => {
            const endTime = Date.now()
            yea({ stdout, startTime, endTime })
        })
        if (spawned) {
            spawned(child)
        }
    })
}
