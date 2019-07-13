import { gru } from '../'
import { consoleLogger } from 'typescript-log'

gru({
    logger: consoleLogger('debug'),
    lifetime: 0,
    workers: 0,
    master: () => {
        // eslint-disable-next-line no-console
        console.log('master')
    },
    start: () => {
        // eslint-disable-next-line no-console
        console.log('worker')
        return Promise.reject('oops')
    },
})
