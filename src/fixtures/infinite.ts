import { gru } from '../'
import { consoleLogger } from 'typescript-log'

gru({
    logger: consoleLogger('debug'),
    workers: 3,
    start: () => {
        console.log('worker output')
        process.exit()
    },
})
