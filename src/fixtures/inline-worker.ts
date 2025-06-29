import { gru } from '../index.js'
import { consoleLogger } from 'typescript-log'

gru({
    logger: consoleLogger('debug'),
    lifetime: 0,
    workers: 0,
    master: () => {
        console.log('master output')
    },
    start: () => {
        console.log('worker output')
    },
})
