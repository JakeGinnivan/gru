/**
 * Beware: replacing worker processes in a cluster can be tricky!
 *
 * The worker processes all create a HTTP server and then listen on env.PORT.
 * Node takes care of load-balancing (with essentially a round-robin strategy)
 * because the workers are part of a cluster.
 *
 * If you send SIGHUP to the master then it will launch new workers to replace
 * the active ones. The active workers are then given env.GRACE milliseconds to
 * finish responding to in-flight requests before they are killed.
 *
 * The happy path test case asserts that reloads have zero downtime. The failure
 * mode test case asserts that requests do indeed fail when the response time
 * exceeds env.GRACE milliseconds. Slow response times can be simulated by
 * increasing env.DELAY milliseconds.
 *
 * Ref https://jira.swmdigital.io/browse/SWM-4401
 */
import { gru } from '../'
import { consoleLogger } from 'typescript-log'
import fs from 'fs'
import http from 'http'
import cluster from 'cluster'
import assert from 'assert'

assert(process.env.WORKERS)
assert(process.env.GRACE)
assert(process.env.DELAY)
assert(process.env.HTTP_LOG_FILE)
assert(process.env.PORT)

gru({
    logger: consoleLogger('debug'),
    workers: Number(process.env.WORKERS),
    grace: Number(process.env.GRACE),
    start: () => {
        if (cluster.isWorker) {
            http.createServer(handler).listen(process.env.PORT)
        }
        process.on('SIGTERM', () => {
            process.exit()
        })
    },
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function handler(_: any, res: any) {
    setTimeout(() => {
        res.end('hello\r\n')
        writeLogMessage()
    }, Number(process.env.DELAY))
}

function writeLogMessage() {
    fs.appendFileSync(
        process.env.HTTP_LOG_FILE || '',
        JSON.stringify({
            pid: process.pid,
            time: Number(new Date()),
            msg: 'end request',
        }) + '\r\n',
    )
}
