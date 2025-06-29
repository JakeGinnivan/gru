import { gru } from '../index.js'
import { consoleLogger } from 'typescript-log'

gru({
    logger: consoleLogger('debug'),
    lifetime: 0,
    workers: 2,
    master: () =>
        new Promise(resolve => setTimeout(resolve, 500)).then<void>(() => {

            console.log('master')
        }),
    start: () => {
        console.log('worker')
        process.exit()
    },
})
