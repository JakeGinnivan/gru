import { gru } from '../index.js'
import { consoleLogger } from 'typescript-log'

interface Args {
    test: number
    test2: string[]
}
gru<Args>({
    logger: consoleLogger('debug'),
    lifetime: 0,
    workers: 2,
    master: () =>
        new Promise(resolve => setTimeout(resolve, 500)).then<Args>(() => {

            console.log('master output')

            return { test: 1, test2: ['val'] }
        }),
    start: ({ masterArgs }) => {

        console.log('worker received', masterArgs)
        process.exit()
    },
})
