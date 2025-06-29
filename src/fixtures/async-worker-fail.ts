import { gru } from '../index.js'
import { consoleLogger } from 'typescript-log'

gru({
    logger: consoleLogger('debug'),
    lifetime: 'until-killed',
    workers: 2,

    master: () => console.log('master'),
    start: () => {
        console.log('worker')

        return new Promise(resolve => setTimeout(resolve, 500)).then<void>(() => {
            return Promise.reject('Failed to start worker')
        })
    },
})
