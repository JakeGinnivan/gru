import { gru } from '..'
import { consoleLogger } from 'typescript-log'

gru({
    logger: consoleLogger('debug'),
    lifetime: 0,
    workers: 0,
    master: () => {
         
        console.log('master output')
    },
     
    start: () => { },
    dedicatedWorkers: {
        worker1: () => {
             
            console.log('worker1 output')
            process.exit()
        },
        worker2: () => {
             
            console.log('worker2 output')
            process.exit()
        },
    },
})
