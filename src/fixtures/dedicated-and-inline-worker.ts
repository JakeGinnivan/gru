import { gru } from '..'
import { consoleLogger } from 'typescript-log'

const logger = consoleLogger('debug')
gru({
    logger,
    lifetime: 0,
    workers: 0,
    master: () => {
        // eslint-disable-next-line no-console
        console.log('master output')
    },
    start: () => {
        logger.info('inline generic worker output')
        // Don't call process.exit() in an inline worker as it runs within master
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
