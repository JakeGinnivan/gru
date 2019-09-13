import { gru } from '../'
import { consoleLogger } from 'typescript-log'

gru({
    logger: consoleLogger('debug'),
    workers: 3,
    start: () => {
        // eslint-disable-next-line no-console
        console.log('worker output')
        process.exit()
    },
})
