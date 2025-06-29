import { gru } from '../index.js'
import { consoleLogger } from 'typescript-log'

gru({
    logger: consoleLogger('debug'),
    lifetime: 0,
    workers: 2,
    master: () => {
        throw new Error('Failed to start')
    },
    start: () => {
        console.log('worker')
        process.exit()
    },
})
