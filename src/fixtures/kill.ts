import { gru } from '../'
import { consoleLogger } from 'typescript-log'

gru({
    logger: consoleLogger('debug'),
    workers: 3,
    lifetime: 'until-killed',
    grace: 100,
    start: () => {
        console.log('ah ha ha ha')

        let sigtermCount = 0

        process.on('SIGTERM', () => {
            sigtermCount++

            if (sigtermCount === 1) {
                // Notified to kill the worker
                console.log('stayin alive')
            } else if (sigtermCount === 2) {
                // force killed after the grace period
                console.log('force killed')
            } else {
                // Should never happen
                console.log(`sigterm ${sigtermCount}`)
            }
        })
    },
})
