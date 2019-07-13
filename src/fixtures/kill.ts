import { gru } from '../'
import { consoleLogger } from 'typescript-log'

gru({
    logger: consoleLogger('debug'),
    workers: 3,
    lifetime: 0,
    grace: 250,
    start: () => {
        // eslint-disable-next-line no-console
        console.log('ah ha ha ha')

        process.on('SIGTERM', () => {
            // eslint-disable-next-line no-console
            console.log('stayin alive')
        })
    },
})
