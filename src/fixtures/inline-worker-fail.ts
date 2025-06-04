import { gru } from '../'
import { consoleLogger } from 'typescript-log'

gru({
    logger: consoleLogger('debug'),
    lifetime: 0,
    workers: 0,
    master: () => {
        console.log('master')
    },
    start: () => {
        console.log('worker')
        return Promise.reject('oops')
    },
})
