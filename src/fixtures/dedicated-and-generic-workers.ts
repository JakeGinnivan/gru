import { gru } from '..'
import { consoleLogger } from 'typescript-log'

const logger = consoleLogger('debug')
gru({
    logger,
    lifetime: 0,
    workers: 3,
    master: () => {
        // eslint-disable-next-line no-console
        console.log('master output')
    },
    start: () => {
        logger.info('generic worker output')
        process.exit()
    },
    dedicatedWorkers: {
        worker1: () => {
            // eslint-disable-next-line no-console
            console.log('worker1 output')
            process.exit()
        },
        worker2: () => {
            // eslint-disable-next-line no-console
            console.log('worker2 output')
            process.exit()
        },
    },
})
