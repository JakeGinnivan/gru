import { gru } from '../'
import { consoleLogger } from 'typescript-log'

gru({
    logger: consoleLogger('debug'),
    lifetime: 0,
    workers: 2,
    master: () => {
        console.log('master')
    },
    start: () => {
        console.log('worker')
        process.exit()
    },
})
