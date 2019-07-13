import { gru } from '../'
import { consoleLogger } from 'typescript-log'

gru({
    logger: consoleLogger('debug'),
    lifetime: 0,
    workers: 2,
    master: () => {
        throw new Error('Failed to start')
    },
    start: () => {
        // eslint-disable-next-line no-console
        console.log('worker')
        process.exit()
    },
})
