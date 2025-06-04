import { gru } from '../'
import { consoleLogger } from 'typescript-log'

gru({
    logger: consoleLogger('debug'),
    lifetime: 0,
    workers: 2,
    master: () => Promise.reject(new Error('Failed to start')),
    start: () => {
         
        console.log('worker')
        process.exit()
    },
})
