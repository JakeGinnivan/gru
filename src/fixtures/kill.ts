import { gru } from '../index.js'
import { consoleLogger } from 'typescript-log'

gru({
    logger: consoleLogger('debug'),
    workers: 3,
    lifetime: 'until-killed',
    grace: 100,
    start: () => {
        console.log('started worker')

        let sigtermCount = 0

        process.on('SIGTERM', () => {
            sigtermCount++

            if (sigtermCount === 1) {
                // Notified to kill the worker
                console.log('worker received sigterm')
            } else if (sigtermCount === 2) {
                // force killed after the grace period
                console.log('worker killed after grace period')
            } else {
                // Should never happen
                console.log(`sigterm ${sigtermCount}`)
            }
        })
    },
})
