import { gru } from '../index.js'
import { consoleLogger } from 'typescript-log'

const logger = consoleLogger('debug')
gru({
    logger,
    workers: 3,
    start: () => {
        logger.info('worker output')

        process.on('SIGTERM', () => {
            logger.info('exiting worker')
            process.exit()
        })
    }
})
