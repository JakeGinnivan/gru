import { gru } from '..'
import { consoleLogger } from 'typescript-log'

const logger = consoleLogger('debug')
gru({
    logger,
    lifetime: 0,
    workers: 0,
    master: () => {
         
        console.log('master output')
    },
    start: () => {
        logger.info('inline generic worker output')
        // Don't call process.exit() in an inline worker as it runs within master
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
