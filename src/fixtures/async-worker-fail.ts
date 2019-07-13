import { gru } from '../'
import { consoleLogger } from 'typescript-log'

gru({
    logger: consoleLogger('debug'),
    lifetime: 'until-killed',
    workers: 2,
    // eslint-disable-next-line no-console
    master: () => console.log('master'),
    start: () => {
        // eslint-disable-next-line no-console
        console.log('worker')

        return new Promise(resolve => setTimeout(resolve, 500)).then<void>(() => {
            return Promise.reject('Failed to start worker')
        })
    },
})
