import { gru } from '..'
import { consoleLogger } from 'typescript-log'

gru({
    logger: consoleLogger('debug'),
    lifetime: 0,
    workers: 0,
    master: () => {
        // eslint-disable-next-line no-console
        console.log('master output')
    },
    // eslint-disable-next-line
    start: () => { },
    dedicatedWorkers: {
        worker1: () => {
            // eslint-disable-next-line no-console
            console.log('worker1 output')
            process.exit()
        },
        worker2: () => {
            // eslint-disable-next-line no-console
            console.log('worker2 output')
            process.exit()
        },
    },
})
