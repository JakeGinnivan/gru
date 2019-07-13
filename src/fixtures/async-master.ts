import { gru } from '../'
import { consoleLogger } from 'typescript-log'

gru({
    logger: consoleLogger('debug'),
    lifetime: 0,
    workers: 2,
    master: () =>
        new Promise(resolve => setTimeout(resolve, 500)).then<void>(() => {
            // eslint-disable-next-line no-console
            console.log('master')
        }),
    start: () => {
        // eslint-disable-next-line no-console
        console.log('worker')
        process.exit()
    },
})
