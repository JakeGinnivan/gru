import { gru } from '../index.js'
import { consoleLogger } from 'typescript-log'

const logger = consoleLogger('debug')
gru({
    logger,
    lifetime: 0,
    workers: 3,
    master: () => {
        console.log('master output')
    },
    start: () => {
        logger.info('generic worker output')
        process.exit()
    },
    dedicatedWorkers: {
        worker1: () => {
            console.log('worker1 output')
            process.exit()
        },
        worker2: () => {
            console.log('worker2 output')
            process.exit()
        },
    },
})
