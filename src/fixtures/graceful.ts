import { gru } from '../'
import { consoleLogger } from 'typescript-log'

const logger = consoleLogger('debug')
gru({
    logger,
    workers: 3,
    start: () => {
        logger.info('worker')

        process.on('SIGTERM', () => {
            logger.info('exiting worker')
            process.exit()
        })
    }
})
