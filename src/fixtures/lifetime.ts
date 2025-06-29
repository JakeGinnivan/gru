import { gru } from '../index.js'
import { consoleLogger } from 'typescript-log'

gru({
    logger: consoleLogger('debug'),
    workers: 3,
    lifetime: 500,
    start: () => {
        console.log('worker')
        process.exit()
    },
})
