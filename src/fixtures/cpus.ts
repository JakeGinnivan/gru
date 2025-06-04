import { gru } from '../'
import { consoleLogger } from 'typescript-log'

gru({
    logger: consoleLogger('debug'),
    lifetime: 0,
    start: () => {
         
        console.log('worker')
        process.exit()
    },
})
